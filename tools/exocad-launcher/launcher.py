# -*- coding: utf-8 -*-
"""
덴플로우 → exocad 런처. (2026-09-09, 설계서 exocad-연동-설계서.md v2)

브라우저가 `denflow://exocad/<주문ID>?t=<토큰>` 을 열면 윈도우가 이 프로그램을
띄웁니다 (install.py 가 레지스트리에 등록). 상주하지 않습니다 — 한 건 끝나면 꺼집니다.

하는 일:
  1. 덴플로우 API 에서 주문 정보(환자·치식·브릿지·스캔 주소)를 받는다
  2. 스캔 파일을 내려받는다
  3. exocad 케이스 폴더 `CAD-Data/yyyy-mm-dd_환자명/` 을 만들고
     .dentalProject 를 조립해 넣고, stl/obj/ply 는 악 이름을 맞춰 넣는다
  4. dxd 가 있으면 기존 변환기(dxd-conversion.exe)를 띄우고 사람이 두 번
     끌어다 놓도록 안내한다 (★ 1단계 — DS Core 자동화는 나중)
  5. 덴플로우에 결과를 한 번 알린다
  6. "exocad 에서 가져오기(Import)를 누르세요" 를 보여 주고 닫힌다

★ 실패해도 덴플로우의 주문은 그대로입니다. 폴더를 지우면 없던 일입니다.
★ 로그는 logs/ 에 남습니다 — 창을 닫아도 무엇이 됐는지 알 수 있게.

시험:  python launcher.py --mock mock.json    (API 대신 파일을 읽음)
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import tkinter as tk
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_project  # noqa: E402

CONFIG_PATH = HERE / "config.json"
LOG_DIR = HERE / "logs"


# ---------- 설정 ----------

def load_config() -> dict:
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    cfg.setdefault("base_url", "https://denflow.kr")
    return cfg


# ---------- 파일 이름 ----------

UPPER = re.compile(r"upperjaw|maxillar|upper|상악", re.I)
LOWER = re.compile(r"lowerjaw|mandibul|lower|하악", re.I)
BITE = re.compile(r"occlusion|bite|바이트", re.I)
MARKER = re.compile(r"marker|scanbody|scan-body", re.I)


def place_name(folder_name: str, original: str) -> str:
    """exocad 가 자동 인식하는 이름으로. 못 맞추면 원래 이름 그대로 (exocad 에서 고름)."""
    ext = Path(original).suffix.lower()
    stem = Path(original).stem
    if ext not in (".stl", ".obj", ".ply"):
        return original
    if MARKER.search(stem):
        return original  # 스캔바디·마커는 그대로 둠 — 사람이 판단
    if BITE.search(stem):
        return original
    if UPPER.search(stem):
        return f"{folder_name}-upperjaw{ext}"
    if LOWER.search(stem):
        return f"{folder_name}-lowerjaw{ext}"
    return original


def unique_folder(base: Path) -> Path:
    """이미 있으면 _2, _3 … exocad 가 열어 둔 폴더를 덮어쓰지 않습니다."""
    if not base.exists():
        return base
    n = 2
    while True:
        cand = base.with_name(f"{base.name}_{n}")
        if not cand.exists():
            return cand
        n += 1


# ---------- 화면 ----------

class Window:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("덴플로우 → exocad")
        self.root.geometry("520x360")
        self.root.attributes("-topmost", True)
        self.title = tk.Label(self.root, text="준비 중…", font=("Malgun Gothic", 13, "bold"), anchor="w")
        self.title.pack(fill="x", padx=16, pady=(14, 4))
        self.text = tk.Text(self.root, height=12, font=("Malgun Gothic", 10), state="disabled", wrap="word")
        self.text.pack(fill="both", expand=True, padx=16)
        self.btn = tk.Button(self.root, text="닫기", command=self.root.destroy, state="disabled", width=12)
        self.btn.pack(pady=10)

    def step(self, msg: str) -> None:
        self.root.after(0, self._step, msg)

    def _step(self, msg: str) -> None:
        self.title.config(text=msg)
        self._append(msg)

    def log(self, msg: str) -> None:
        self.root.after(0, self._append, msg)

    def _append(self, msg: str) -> None:
        self.text.config(state="normal")
        self.text.insert("end", msg + "\n")
        self.text.see("end")
        self.text.config(state="disabled")

    def finish(self, title: str, ok: bool) -> None:
        def _f() -> None:
            self.title.config(text=title, fg="#1a7f37" if ok else "#d93025")
            self.btn.config(state="normal")
        self.root.after(0, _f)


# ---------- 본 작업 ----------

class Job:
    def __init__(self, win: Window, cfg: dict, order_id: str | None, token: str | None, mock: Path | None) -> None:
        self.win, self.cfg, self.order_id, self.token, self.mock = win, cfg, order_id, token, mock
        self.log = logging.getLogger("launcher")

    def api(self, path: str) -> str:
        return f"{self.cfg['base_url']}/api/exocad/orders/{self.order_id}{path}?t={self.token}"

    def say(self, msg: str) -> None:
        self.log.info(msg)
        self.win.step(msg)

    def note(self, msg: str) -> None:
        self.log.info(msg)
        self.win.log("  " + msg)

    def report(self, status: str, message: str) -> None:
        if self.mock:
            return
        try:
            requests.post(self.api("/result"), json={"status": status, "message": message[:500]}, timeout=15)
        except Exception as e:  # noqa: BLE001
            self.log.warning("결과 보고 실패: %s", e)

    def run(self) -> None:
        try:
            self._run()
        except Exception as e:  # noqa: BLE001
            self.log.exception("실패")
            self.win.log(f"오류: {e}")
            self.win.finish("실패했습니다. 덴플로우 주문은 그대로입니다.", ok=False)
            self.report("failed", str(e))

    def _run(self) -> None:
        # 1. 주문 정보
        self.say("1/5 덴플로우에서 주문 정보를 받는 중")
        if self.mock:
            data = json.loads(self.mock.read_text(encoding="utf-8"))
        else:
            r = requests.get(self.api(""), timeout=30)
            if r.status_code != 200:
                raise RuntimeError(f"덴플로우가 거절했습니다 ({r.status_code}): {r.json().get('error', r.text)}")
            data = r.json()
        patient = data["patientName"]
        order_date = data["orderDate"]
        self.note(f"{data.get('orderNo', '')} · {patient} · 치아 {[t['number'] for t in data['teeth']]}")
        if data.get("unknownTypes"):
            self.note(f"★ exocad 로 못 옮긴 종류: {data['unknownTypes']} — 주문서에서 빠집니다. exocad 에서 손으로 추가하세요")
        if not data["teeth"]:
            raise RuntimeError("작업 치아가 하나도 없습니다")

        # 2. 폴더
        cad = Path(self.cfg["exocad_dir"]) / "CAD-Data"
        if not cad.is_dir():
            raise RuntimeError(f"CAD-Data 폴더가 없습니다: {cad}")
        folder = unique_folder(cad / f"{order_date}_{patient}")
        folder_name = folder.name

        # 3. 스캔 내려받기
        files = data.get("files", [])
        self.say(f"2/5 스캔 파일 {len(files)}개 내려받는 중")
        tmp = Path(tempfile.mkdtemp(prefix="denflow-"))
        got: list[Path] = []
        for f in files:
            dest = tmp / f["name"]
            if self.mock and not f["url"].startswith("http"):
                shutil.copyfile(f["url"], dest)
            else:
                with requests.get(f["url"], stream=True, timeout=60) as r:
                    r.raise_for_status()
                    with open(dest, "wb") as out:
                        for chunk in r.iter_content(1 << 20):
                            out.write(chunk)
            got.append(dest)
            self.note(f"{f['name']} ({dest.stat().st_size / 1e6:.1f} MB)")

        # 4. 주문서 + 배치
        self.say("3/5 exocad 주문서를 만드는 중")
        make_project.CAD_DATA = cad
        make_project.SAMPLE = HERE / "template.dentalProject"
        xml = make_project.build_project(
            patient_name=patient,
            teeth=data["teeth"],
            bridges=data.get("bridges", []),
            patient_id=make_project.next_patient_id(),
        )
        folder.mkdir(parents=True)
        (folder / f"{folder_name}.dentalProject").write_bytes(("﻿" + xml).encode("utf-8"))
        dxds: list[Path] = []
        for p in got:
            if p.suffix.lower() == ".dxd":
                dxds.append(p)
                continue
            target = folder / place_name(folder_name, p.name)
            shutil.move(str(p), target)
            self.note(f"{p.name} → {target.name}")
        self.note(f"폴더: {folder}")

        # 5. dxd
        if dxds:
            self.say("4/5 dxd 변환 — 변환기 창에서 두 번 끌어다 놓으세요")
            exe = Path(self.cfg.get("converter_exe", ""))
            for d in dxds:
                keep = folder / d.name
                shutil.move(str(d), keep)
                self.note(f"① {keep.name} 을 변환기 창에 끌어다 놓기")
            self.note(f"② 이어서 {folder_name}.dentalProject 를 끌어다 놓기 → ply 가 이 폴더에 들어갑니다")
            if exe.is_file():
                subprocess.Popen([str(exe)], cwd=str(exe.parent))
                self.note("변환기를 띄웠습니다")
            else:
                self.note(f"★ 변환기를 못 찾았습니다: {exe}")
        else:
            self.say("4/5 dxd 없음 — 변환 건너뜀")

        # 6. 끝
        self.say("5/5 끝. exocad DentalDB 에서 [가져오기] 를 눌러 아래 파일을 고르세요")
        self.note(str(folder / f"{folder_name}.dentalProject"))
        self.report("done", f"{folder_name}")
        self.win.finish("완료 — exocad 에서 가져오기를 누르세요", ok=True)


# ---------- 시작 ----------

def parse_launch(arg: str) -> tuple[str, str]:
    u = urlparse(arg)
    if u.scheme != "denflow" or u.netloc != "exocad":
        raise SystemExit(f"모르는 주소: {arg}")
    order_id = u.path.strip("/")
    token = parse_qs(u.query).get("t", [""])[0]
    if not order_id or not token:
        raise SystemExit("주문 ID 나 토큰이 없습니다")
    return order_id, token


def main() -> None:
    LOG_DIR.mkdir(exist_ok=True)
    logging.basicConfig(
        filename=LOG_DIR / f"{dt.date.today().isoformat()}.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        encoding="utf-8",
    )
    args = sys.argv[1:]
    mock: Path | None = None
    order_id = token = None
    if len(args) >= 2 and args[0] == "--mock":
        mock = Path(args[1])
    elif len(args) >= 1:
        order_id, token = parse_launch(args[0])
    else:
        raise SystemExit("사용: launcher.py denflow://exocad/<주문ID>?t=<토큰>  |  --mock mock.json")

    cfg = load_config()
    win = Window()
    threading.Thread(target=Job(win, cfg, order_id, token, mock).run, daemon=True).start()
    win.root.mainloop()


if __name__ == "__main__":
    main()
