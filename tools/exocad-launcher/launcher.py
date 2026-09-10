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
import time
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

STEPS = ["주문 정보 받기", "스캔 파일 내려받기", "exocad 주문서 만들기", "dxd 변환 (DS Core)", "exocad 목록에 등록"]
TOAST_MS = 3000


class Window:
    """
    토스트만. (2026-09-10 — 사용자: "토스트 정도만, 실패했을 때만 알림창")
      - 시작: "덴플로우 → exocad · 홍길동 ORD-… 보내는 중" 3초
      - 끝:   "✓ 완료 — exocad 에서 홍길동 을 여세요" 3초
      - 실패: 알림창(이유 + [로그 열기] [닫기]) — 이것만 사람이 닫습니다
    ★ 진행 중에는 아무것도 안 떠 있습니다. 어디까지 갔는지는 logs/ 의 실행 로그가 압니다.
    ★ 창을 다 닫아도 프로세스는 남은 뒷정리(임시 환자 삭제)가 끝난 뒤 꺼집니다.
    """

    W, H = 380, 58

    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.withdraw()
        self.folder: Path | None = None
        self._case = ""
        self._toast: tk.Toplevel | None = None
        self.log_lines: list[str] = []

    def _show_toast(self, title: str, sub: str, fg: str = "#FFFFFF", ms: int = TOAST_MS) -> None:
        F = "Malgun Gothic"
        if self._toast is not None:
            try:
                self._toast.destroy()
            except Exception:  # noqa: BLE001
                pass
        t = tk.Toplevel(self.root)
        t.overrideredirect(True)
        t.attributes("-topmost", True)
        t.configure(bg="#1A2130")
        sw, sh = t.winfo_screenwidth(), t.winfo_screenheight()
        t.geometry(f"{self.W}x{self.H}+{sw - self.W - 16}+{sh - self.H - 60}")
        tk.Label(t, text=title, font=(F, 10, "bold"), bg="#1A2130", fg=fg, anchor="w").pack(fill="x", padx=14, pady=(10, 0))
        tk.Label(t, text=sub, font=(F, 9), bg="#1A2130", fg="#9AA3B2", anchor="w").pack(fill="x", padx=14)
        self._toast = t
        t.after(ms, t.destroy)

    # -- 바깥에서 부르는 것 --
    def set_case(self, patient: str, order_no: str) -> None:
        self._case = f"{patient} · {order_no}"
        self.root.after(0, lambda: self._show_toast("덴플로우 → exocad 보내는 중", self._case))

    def step(self, msg: str) -> None:
        self.log_lines.append(msg)

    def log(self, msg: str) -> None:
        self.log_lines.append(msg)

    def finish(self, title: str, ok: bool, log_dir: Path | None = None) -> None:
        def _f() -> None:
            if ok:
                self._show_toast("✓ " + title, self._case, fg="#7EE2A8")
                self.root.after(TOAST_MS + 200, self.root.quit)
            else:
                self._fail_dialog(title, log_dir)
        self.root.after(0, _f)

    def _fail_dialog(self, title: str, log_dir: Path | None) -> None:
        F = "Malgun Gothic"
        d = tk.Toplevel(self.root)
        d.title("덴플로우 → exocad 실패")
        d.configure(bg="#FFFFFF")
        d.attributes("-topmost", True)
        d.geometry("520x360")
        tk.Label(d, text="✕ " + title, font=(F, 12, "bold"), bg="#FFFFFF", fg="#D93025", anchor="w").pack(fill="x", padx=20, pady=(16, 2))
        tk.Label(d, text=self._case, font=(F, 9), bg="#FFFFFF", fg="#7C8595", anchor="w").pack(fill="x", padx=20)
        text = tk.Text(d, font=(F, 9), fg="#4A5567", bg="#F8F9FB", relief="flat", wrap="word", height=10)
        text.pack(fill="both", expand=True, padx=20, pady=(8, 0))
        text.insert("end", "\n".join(self.log_lines[-40:]))
        text.config(state="disabled")
        row = tk.Frame(d, bg="#FFFFFF")
        row.pack(fill="x", padx=20, pady=12)
        tk.Button(row, text="닫기", command=self.root.quit, width=8, relief="flat", bg="#EEF1F5", font=(F, 10)).pack(side="right")
        if log_dir:
            tk.Button(row, text="로그 열기", command=lambda: subprocess.Popen(["explorer", str(log_dir)]), width=9, relief="flat",
                      bg="#F2F7FE", fg="#1279E8", font=(F, 10, "bold")).pack(side="right", padx=(0, 8))
        if self.folder and self.folder.exists():
            tk.Button(row, text="폴더 열기", command=lambda: subprocess.Popen(["explorer", str(self.folder)]), width=9, relief="flat",
                      bg="#F2F7FE", fg="#1279E8", font=(F, 10)).pack(side="left")
        d.protocol("WM_DELETE_WINDOW", self.root.quit)

    def choose_dxd(self, files: list[dict]) -> str:
        """dxd 가 여럿이면 하나를 고르게 합니다 (사용자 요청 2026-09-10 — "내가 한 개 고르는 게 좋겠다").
           고르기 전에는 아무것도 내려받지 않습니다. 취소하면 이번 보내기는 없던 일입니다."""
        done = threading.Event()
        result: list[str] = []

        def _ask() -> None:
            F = "Malgun Gothic"
            top = tk.Toplevel(self.root)
            top.title("dxd 고르기")
            top.configure(bg="#FFFFFF")
            top.attributes("-topmost", True)
            top.grab_set()
            tk.Label(top, text="이 주문에 dxd 가 여러 개입니다. exocad 로 보낼 것을 고르세요.",
                     font=(F, 11, "bold"), bg="#FFFFFF", fg="#1A2130", anchor="w").pack(fill="x", padx=20, pady=(16, 8))
            var = tk.StringVar(value=files[0]["name"])
            for f in files:
                size = f.get("size") or 0
                label = f"{f['name']}   ({size / 1e6:.0f} MB)" if size else f["name"]
                tk.Radiobutton(top, text=label, variable=var, value=f["name"], font=(F, 10), bg="#FFFFFF",
                               activebackground="#FFFFFF", anchor="w", selectcolor="#F5F2FE").pack(fill="x", padx=24, pady=2)
            row = tk.Frame(top, bg="#FFFFFF")
            row.pack(fill="x", padx=20, pady=14)

            def ok() -> None:
                result.append(var.get())
                top.destroy()
                done.set()

            def cancel() -> None:
                top.destroy()
                done.set()

            tk.Button(row, text="이걸로 보내기", command=ok, width=12, relief="flat", bg="#6B3FD6", fg="#FFFFFF", font=(F, 10, "bold")).pack(side="right")
            tk.Button(row, text="취소", command=cancel, width=8, relief="flat", bg="#EEF1F5", fg="#1A2130", font=(F, 10)).pack(side="right", padx=(0, 8))
            top.protocol("WM_DELETE_WINDOW", cancel)

        self.root.after(0, _ask)
        done.wait()
        if not result:
            raise RuntimeError("dxd 를 고르지 않아 보내기를 취소했습니다")
        return result[0]

    def ask_dscore_account(self, save) -> None:
        """DS Core 계정을 처음 한 번 묻습니다 (사용자 지시 2026-09-10 — 사람마다 계정이 다름).
           런처 폴더의 settings.json 에만 저장되고 덴플로우에는 안 올라갑니다."""
        import tkinter.simpledialog as sd
        done = threading.Event()
        result: dict = {}

        def _ask() -> None:
            email = sd.askstring("DS Core 계정", "DS Core 이메일", parent=self.root)
            pw = sd.askstring("DS Core 계정", "DS Core 비밀번호", parent=self.root, show="*") if email else None
            if email and pw:
                result.update(email=email.strip(), password=pw)
            done.set()

        self.root.after(0, _ask)
        done.wait()
        if not result:
            raise RuntimeError("DS Core 계정이 없어 dxd 를 변환할 수 없습니다")
        save(result["email"], result["password"])


# ---------- 본 작업 ----------

class Job:
    def __init__(self, win: Window, cfg: dict, order_id: str | None, token: str | None, mock: Path | None) -> None:
        self.win, self.cfg, self.order_id, self.token, self.mock = win, cfg, order_id, token, mock
        self.log = logging.getLogger("launcher")
        self.t0 = time.time()
        self.marks: list[tuple[str, float]] = []   # (단계, 끝난 시각) — 어디가 느린지 보려고
        self.order_no = order_id or "mock"
        self.after_done = None                     # 완료 표시 뒤에 할 뒷정리 (임시 환자 삭제)

    def mark(self, name: str) -> None:
        self.marks.append((name, time.time()))

    def durations(self) -> str:
        out, prev = [], self.t0
        for name, t in self.marks:
            out.append(f"{name} {t - prev:.0f}s")
            prev = t
        return " · ".join(out) + f" · 합계 {time.time() - self.t0:.0f}s"

    def summary(self, result: str, message: str) -> None:
        """runs.csv 한 줄 — 언제·무슨 주문·결과·단계별 시간. 엑셀로 열어 보면 병목이 보입니다."""
        try:
            f = LOG_DIR / "runs.csv"
            new = not f.exists()
            with open(f, "a", encoding="utf-8-sig") as h:
                if new:
                    h.write("시각,주문,환자,결과,걸린시간(초),단계별,메모\n")
                h.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S},{self.order_no},{getattr(self, 'patient', '')},{result},{time.time() - self.t0:.0f},{self.durations()},{message.replace(',', ' ')[:200]}\n")
        except Exception:  # noqa: BLE001
            self.log.exception("runs.csv")

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
            self.log.info("시간: %s", self.durations())
        except Exception as e:  # noqa: BLE001
            self.log.exception("실패")
            self.win.log(f"오류: {e}")
            self.summary("실패", str(e))
            self.win.finish(f"실패 — {e}", ok=False, log_dir=LOG_DIR)
            self.report("failed", str(e))
            return
        # ★ 뒷정리(임시 환자 삭제)는 완료 토스트 뒤에 — 사람은 안 기다립니다
        if self.after_done:
            try:
                self.after_done()
            except Exception:  # noqa: BLE001
                self.log.exception("뒷정리 실패")
        self.win.root.after(0, self.win.root.quit)

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
        self.patient = patient
        self.order_no = data.get("orderNo", self.order_no)
        self.win.set_case(patient, self.order_no)
        self.mark("주문정보")
        self.note(f"{data.get('orderNo', '')} · {patient} · 치아 {[t['number'] for t in data['teeth']]}")
        if data.get("unknownTypes"):
            self.note(f"★ exocad 로 못 옮긴 종류: {data['unknownTypes']} — 주문서에서 빠집니다. exocad 에서 손으로 추가하세요")
        if not data["teeth"]:
            raise RuntimeError("작업 치아가 하나도 없습니다")

        # 2. 폴더
        cad = Path(self.cfg["exocad_dir"]) / "CAD-Data"
        if not cad.is_dir():
            raise RuntimeError(f"CAD-Data 폴더가 없습니다: {cad}")
        # ★ 같은 주문을 다시 보내면 **같은 폴더에 덮어씁니다** (사용자 지적 2026-09-10 —
        #   "환자명이 zz 인데 zz_2 를 확인하라니 맞지 않다"). exocad 에 이미 가져온
        #   케이스면 그 폴더의 스캔만 새것으로 바뀌어 그대로 열립니다.
        #   exocad 가 파일을 잡고 있어 못 쓸 때만 _2 로 비켜 갑니다 (아래).
        folder = cad / f"{order_date}_{patient}"
        folder_name = folder.name
        if folder.exists():
            self.note(f"같은 폴더가 있어 안의 주문서·스캔을 새로 씁니다: {folder.name}")
        self.win.folder = folder

        # 3. 스캔 내려받기 — dxd 가 여럿이면 먼저 하나 고름 (고른 것만 내려받음)
        files = data.get("files", [])
        dxd_files = [f for f in files if f["name"].lower().endswith(".dxd")]
        if len(dxd_files) > 1:
            self.say("1/5 dxd 가 여러 개 — 하나를 고르세요")
            chosen = self.win.choose_dxd(dxd_files)
            files = [f for f in files if not f["name"].lower().endswith(".dxd") or f["name"] == chosen]
            self.note(f"고른 dxd: {chosen}")
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

        self.mark("내려받기")
        # 4. 주문서 + 배치
        self.say("3/5 exocad 주문서를 만드는 중")
        make_project.CAD_DATA = cad
        make_project.SAMPLE = HERE / "template.dentalProject"
        import uuid
        import exocad_db
        project_guid = str(uuid.uuid4())
        patient_id = make_project.next_patient_id()
        # ★ exocad 는 케이스 폴더를 "등록 날짜_이름" 으로 찾습니다 (2026-09-10 확인 —
        #   날짜가 어긋나면 "이 프로젝트의 파일은 유효하지 않습니다"). 그래서 DB 의 t_date 와
        #   XML 의 DateTime 을 **폴더 날짜(주문일)** 로 맞추고 시각만 지금으로 둡니다.
        now = dt.datetime.now().astimezone()
        made_at = dt.datetime.combine(dt.date.fromisoformat(order_date), now.time(), tzinfo=now.tzinfo)
        xml = make_project.build_project(
            patient_name=patient,
            teeth=data["teeth"],
            bridges=data.get("bridges", []),
            when=made_at,
            patient_id=patient_id,
            project_guid=project_guid,
        )
        try:
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{folder_name}.dentalProject").write_bytes(("﻿" + xml).encode("utf-8"))
        except PermissionError:
            # exocad 가 열어 둔 폴더 — 비켜 갑니다
            folder = unique_folder(folder)
            folder_name = folder.name
            self.note(f"★ exocad 가 원래 폴더를 잡고 있어 {folder_name} 로 만듭니다. 케이스를 닫고 다시 보내면 원래 이름으로 갑니다")
            xml = make_project.build_project(
                patient_name=patient, teeth=data["teeth"], bridges=data.get("bridges", []),
                when=made_at, patient_id=patient_id, project_guid=project_guid,
            )
            folder.mkdir(parents=True)
            (folder / f"{folder_name}.dentalProject").write_bytes(("﻿" + xml).encode("utf-8"))
        dxds: list[Path] = []
        for p in got:
            if p.suffix.lower() == ".dxd":
                dxds.append(p)
                continue
            target = folder / place_name(folder_name, p.name)
            if target.exists():
                target.unlink()  # 지난번 보낸 같은 이름의 스캔은 새것으로
            shutil.move(str(p), target)
            self.note(f"{p.name} → {target.name}")
        self.note(f"폴더: {folder}")

        # 5. dxd → DS Core 자동 변환 (2026-09-10 — dscore.py, 사람 손 없이)
        if dxds:
            self.say("4/5 dxd 를 DS Core 에서 변환하는 중 (3~5분)")
            import dscore
            for d in dxds:
                keep = folder / d.name
                shutil.move(str(d), keep)
                try:
                    if not dscore.has_settings():
                        self.note("DS Core 계정이 없어 입력창을 띄웁니다")
                        self.win.ask_dscore_account(dscore.save_settings)
                    placed, cleanup = dscore.convert(keep, folder, folder_name, patient, data.get("orderNo", "order"), show=False, say=self.note, defer_cleanup=True)
                    self.after_done = cleanup
                    self.note(f"변환 완료: {[p.name for p in placed]}")
                except Exception as e:  # noqa: BLE001
                    self.log.exception("dscore 실패")
                    self.note(f"★ 자동 변환 실패: {e}")
                    exe = Path(self.cfg.get("converter_exe", ""))
                    self.note(f"수동으로: ① {keep.name} 을 변환기 창에, ② {folder_name}.dentalProject 를 끌어다 놓기")
                    if exe.is_file():
                        subprocess.Popen([str(exe)], cwd=str(exe.parent))
                        self.note("변환기를 띄웠습니다")
        else:
            self.say("4/5 dxd 없음 — 변환 건너뜀")

        self.mark("dxd변환")
        # 6. exocad DB 에 직접 등록 — 되면 가져오기 클릭이 필요 없습니다 (2026-09-10)
        registered = False
        try:
            work, mesial, healthy, antagonist = make_project.plan_teeth(data["teeth"], data.get("bridges", []))
            db = exocad_db.ExocadDb(cad)
            try:
                tid = db.register(
                    patient_name=patient, patient_id=patient_id, project_guid=project_guid,
                    tray_no=make_project.TRAY_NO, when=made_at,
                    teeth=exocad_db.teeth_from_plan(work, mesial, healthy, antagonist),
                )
            finally:
                db.close()
            registered = True
            self.note(f"exocad 목록에 등록했습니다 (treatment {tid})")
        except Exception as e:  # noqa: BLE001
            self.log.exception("exocad DB 등록 실패")
            self.note(f"★ exocad 목록 자동 등록 실패: {e}")

        # 7. 끝
        self.say("5/5 exocad 목록에 등록")
        self.note(str(folder / f"{folder_name}.dentalProject"))
        self.mark("등록")
        self.report("done", f"{folder_name}")
        self.summary("완료" if registered else "완료(가져오기 필요)", self.durations())
        if registered:
            self.win.finish(f"완료 — exocad 에서 '{patient}' 를 여세요", ok=True)
        else:
            self.win.finish("완료 — exocad 에서 [가져오기]로 주문서를 고르세요", ok=True)


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
    # ★ 무엇보다 먼저 "불렸다" 를 남깁니다 — 브라우저가 부르긴 했는지 가리는 흔적
    with open(LOG_DIR / "chrome-hit.txt", "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now().isoformat(timespec='seconds')} py {sys.argv[1:]}\n")
    # ★ 로그 둘: 날짜별(전부) + 실행별(이 건만, runs/ 아래). 실패하면 실행별 파일을 열면 됩니다.
    (LOG_DIR / "runs").mkdir(exist_ok=True)
    handlers = [
        logging.FileHandler(LOG_DIR / f"{dt.date.today().isoformat()}.log", encoding="utf-8"),
        logging.FileHandler(LOG_DIR / "runs" / f"{dt.datetime.now():%Y%m%d-%H%M%S}.log", encoding="utf-8"),
    ]
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", handlers=handlers)
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
    win.root.mainloop()   # quit() 은 Job 이 (뒷정리까지 끝낸 뒤) 부릅니다


if __name__ == "__main__":
    main()
