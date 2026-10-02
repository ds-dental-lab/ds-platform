# -*- coding: utf-8 -*-
"""
치과 PC 스캔 올리미 (2026-10-02, 사용자 요청).

  구강스캐너 내보내기 폴더를 보고 있다가, **새 dxd 가 생기면** 덴플로우로 올리고
  주문 등록 창을 띄웁니다. 환자 이름과 차트번호는 dxd 안에서 읽습니다 (dxd_case).

★ 내보낼 때만 움직입니다. 프로그램이 뜬 **뒤에 생긴** 파일만 봅니다.
  옛 파일을 폴더에 복사해 넣어도 안 올립니다 — 파일 안의 스캔 시각과 케이스 번호로 거릅니다.
★ 쓰기가 끝날 때까지 기다립니다 (크기가 멈출 때까지). 반쯤 올라간 파일을 안 만듭니다.
★ 비밀번호를 저장하지 않습니다. 계정정보에서 받은 **여섯 자리 코드**로 한 번 연결하고,
  그 뒤로는 기기 열쇠만 씁니다 (scan_agent.json).
★ 파일은 덴플로우 서버를 거치지 않고 저장소로 바로 올립니다 — 150MB 짜리입니다.
"""

from __future__ import annotations

import json
import os
import threading
import time
import traceback
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

import tkinter as tk
from tkinter import filedialog

from dxd_case import read_case

HERE = Path(__file__).resolve().parent
SETTINGS = HERE / "scan_agent.json"

SITE = "https://denflow.kr"
SUPABASE_URL = "https://dzliwedyqkondvcwnvbh.supabase.co"
BUCKET = "order-files"

POLL_SECONDS = 5
SETTLE_SECONDS = 4          # 크기가 이만큼 안 변하면 다 쓴 것으로 봅니다


def load_settings() -> dict:
    try:
        return json.loads(SETTINGS.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_settings(data: dict) -> None:
    SETTINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def post_json(url: str, body: dict, token: str | None = None) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", f"Bearer {token}")

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:          # 서버가 이유를 적어 보냅니다
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "error": f"HTTP {e.code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def put_file(path: Path, storage_path: str, upload_token: str) -> bool:
    """저장소가 내준 주소로 바로 올립니다 (서명 업로드)."""
    url = f"{SUPABASE_URL}/storage/v1/object/upload/sign/{BUCKET}/{urllib.parse.quote(storage_path)}?token={upload_token}"

    with open(path, "rb") as f:
        req = urllib.request.Request(url, data=f, method="PUT")
        req.add_header("content-type", "application/octet-stream")
        req.add_header("content-length", str(path.stat().st_size))
        try:
            with urllib.request.urlopen(req, timeout=60 * 30) as res:
                return res.status in (200, 201)
        except Exception:
            return False


def settled(path: Path) -> bool:
    """쓰기가 끝났는가 — 크기가 SETTLE_SECONDS 동안 그대로면 끝난 것으로 봅니다."""
    try:
        first = path.stat().st_size
        time.sleep(SETTLE_SECONDS)
        return first > 0 and first == path.stat().st_size
    except OSError:
        return False


class Agent:
    """폴더를 보고 올리는 일. 창(App)이 이 객체를 쥐고 씁니다."""

    def __init__(self, say) -> None:
        self.say = say
        self.cfg = load_settings()
        self.seen: set[str] = set(self.cfg.get("done_cases", []))
        self.stop = threading.Event()

    # -- 연결 --
    def link(self, code: str, device_name: str) -> bool:
        result = post_json(f"{SITE}/api/device/link", {"code": code.strip(), "deviceName": device_name})
        if not result.get("ok"):
            self.say(f"연결 실패: {result.get('error', '')}")
            return False

        self.cfg["token"] = result["token"]
        self.cfg["device_id"] = result["deviceId"]
        save_settings(self.cfg)
        self.say("연결됐습니다. 이제 내보내기만 하면 올라갑니다.")
        return True

    # -- 올리기 --
    def upload(self, path: Path) -> None:
        case = read_case(path)
        if case.case_guid and case.case_guid in self.seen:
            return

        self.say(f"{path.name} — {case.patient_name or '이름 모름'} 올리는 중…")

        slot = post_json(
            f"{SITE}/api/device/scan",
            {
                "patientName": case.patient_name,
                "chartNo": case.chart_no,
                "clinicNameInFile": case.clinic_name,
                "caseGuid": case.case_guid,
                "scannedAt": case.scanned_at,
                "teeth": case.teeth,
                "fileName": path.name,
                "fileSize": path.stat().st_size,
            },
            self.cfg.get("token"),
        )

        if not slot.get("ok"):
            self.say(f"   실패: {slot.get('error', '')}")
            return

        if slot.get("already"):
            self.say("   이미 올라간 케이스입니다 — 건너뜁니다")
        else:
            if not put_file(path, slot["path"], slot["token"]):
                self.say("   올리다 끊겼습니다. 다음 차례에 다시 해 봅니다")
                return

            done = post_json(f"{SITE}/api/device/scan/done", {"scanId": slot["scanId"]}, self.cfg.get("token"))
            if not done.get("ok"):
                self.say(f"   마무리 실패: {done.get('error', '')}")
                return

            self.say("   올렸습니다. 주문 등록 창을 엽니다")

        if case.case_guid:
            self.seen.add(case.case_guid)
            self.cfg["done_cases"] = sorted(self.seen)[-500:]
            save_settings(self.cfg)

        # ★ 주문 등록 창 — 환자 이름과 이 스캔이 채워진 채로 열립니다
        webbrowser.open(f"{SITE}/clinic/orders/new?scan={slot['scanId']}")

    # -- 지켜보기 --
    def watch(self, folder: Path) -> None:
        started = time.time()
        self.say(f"{folder} 를 봅니다. 내보내기를 하면 올라갑니다.")

        while not self.stop.is_set():
            try:
                for path in sorted(folder.glob("*.dxd")):
                    if self.stop.is_set():
                        break
                    # ★ 프로그램이 뜬 뒤에 생긴 것만. 옛 파일을 복사해 넣어도 안 올립니다
                    if path.stat().st_mtime < started:
                        continue
                    if not settled(path):
                        continue
                    self.upload(path)
            except Exception:
                self.say("문제가 생겼습니다\n" + traceback.format_exc())

            self.stop.wait(POLL_SECONDS)


class App:
    def __init__(self) -> None:
        self.agent = Agent(self.say)
        self.root = tk.Tk()
        self.root.title("덴플로우 스캔 올리미")
        self.root.geometry("560x480")
        self.root.configure(bg="#FFFFFF")
        F = "Malgun Gothic"

        tk.Label(self.root, text="덴플로우 스캔 올리미", font=(F, 15, "bold"), bg="#FFFFFF", fg="#1A2130").pack(anchor="w", padx=22, pady=(18, 2))
        tk.Label(
            self.root,
            text="구강스캐너에서 내보내면 스캔이 덴플로우로 올라가고 주문 등록 창이 열립니다.",
            font=(F, 9), bg="#FFFFFF", fg="#7C8595", wraplength=500, justify="left",
        ).pack(anchor="w", padx=22)

        box = tk.Frame(self.root, bg="#FFFFFF")
        box.pack(fill="x", padx=22, pady=(14, 0))

        self.folder = tk.StringVar(value=self.agent.cfg.get("folder", ""))
        row = tk.Frame(box, bg="#FFFFFF")
        row.pack(fill="x")
        tk.Entry(row, textvariable=self.folder, font=(F, 10)).pack(side="left", fill="x", expand=True, ipady=4)
        tk.Button(row, text="내보내기 폴더", command=self.pick, font=(F, 9, "bold"), relief="flat", bg="#EEF1F5").pack(side="left", padx=(6, 0))

        self.code = tk.StringVar(value="")
        row2 = tk.Frame(box, bg="#FFFFFF")
        row2.pack(fill="x", pady=(8, 0))
        tk.Label(row2, text="연결 코드", font=(F, 10), bg="#FFFFFF").pack(side="left")
        tk.Entry(row2, textvariable=self.code, width=10, font=(F, 12, "bold")).pack(side="left", padx=(8, 8))
        tk.Button(row2, text="연결하기", command=self.link, font=(F, 9, "bold"), relief="flat", bg="#EEF1F5").pack(side="left")
        tk.Label(row2, text="치과 계정정보 → 스캐너 PC 연결", font=(F, 9), bg="#FFFFFF", fg="#98A2B3").pack(side="left", padx=(10, 0))

        self.start_btn = tk.Button(self.root, text="지켜보기 시작", command=self.start, font=(F, 11, "bold"), relief="flat", bg="#1279E8", fg="#FFFFFF")
        self.start_btn.pack(fill="x", padx=22, pady=(14, 8), ipady=6)

        self.text = tk.Text(self.root, height=12, font=(F, 9), bg="#F8F9FB", fg="#4A5567", relief="flat", state="disabled", wrap="word")
        self.text.pack(fill="both", expand=True, padx=22, pady=(0, 18))

        if self.agent.cfg.get("token"):
            self.say("이미 연결된 PC 입니다. 폴더를 고르고 '지켜보기 시작' 을 누르세요.")
        else:
            self.say("치과 계정정보에서 연결 코드를 받아 넣어 주세요.")

    def pick(self) -> None:
        picked = filedialog.askdirectory(title="구강스캐너 내보내기 폴더")
        if picked:
            self.folder.set(picked)

    def say(self, msg: str) -> None:
        def _put() -> None:
            self.text.config(state="normal")
            self.text.insert("end", msg.rstrip() + "\n")
            self.text.see("end")
            self.text.config(state="disabled")

        if hasattr(self, "root"):
            self.root.after(0, _put)
        else:
            print(msg)

    def link(self) -> None:
        threading.Thread(target=self.agent.link, args=(self.code.get(), os.environ.get("COMPUTERNAME", "스캐너 PC")), daemon=True).start()

    def start(self) -> None:
        folder = Path(self.folder.get().strip())
        if not folder.is_dir():
            self.say("내보내기 폴더를 골라 주세요")
            return
        if not self.agent.cfg.get("token"):
            self.say("먼저 연결 코드로 연결해 주세요")
            return

        self.agent.cfg["folder"] = str(folder)
        save_settings(self.agent.cfg)

        self.start_btn.config(text="지켜보는 중…", state="disabled", bg="#9FC4EE")
        threading.Thread(target=self.agent.watch, args=(folder,), daemon=True).start()

    def run(self) -> None:
        self.root.mainloop()
        self.agent.stop.set()


if __name__ == "__main__":
    App().run()
