# -*- coding: utf-8 -*-
"""
치과 PC 의 출력 역할 (2026-10-06).

덴플로우에 "출력할 것 있나요" 하고 **밖으로** 물어봅니다.
있으면 내려받아 같은 랜 안의 프린터에 보내고, 되는 대로 알려 줍니다.

    물어보기 → 내려받기 → 프린터로 → 진행률 올리기

★ **들어오는 연결이 없습니다.** 포트포워딩도 고정 IP 도 필요 없습니다.
  예전처럼 프린터를 인터넷에 내놓지 않습니다 — Bambu 의 LAN 인증은
  여덟 자리 코드 하나뿐이고 시도 횟수 제한도 없습니다.

★ 스캔 올리는 열쇠를 그대로 씁니다. 그 치과의 '스캔 올리기·출력' 말고는
  아무것도 못 합니다.

★ 조용히 실패하지 않습니다. 어디서 멈췄든 까닭을 서버로 올립니다.
  주문 화면에 그대로 뜹니다.

혼자 돌려 보기:
    python print_loop.py --once
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from printer_send import build as build_printer

BASE = __import__("os").environ.get("DENFLOW_BASE", "https://denflow.kr")  # 시험 때만 DENFLOW_BASE 로 바꿔 끼웁니다

#: 얼마에 한 번 물어볼지. 사람이 베드를 비우고 누르는 것을 기다리는 길이라
#: 급하지 않습니다. 너무 잦으면 서버만 시끄럽습니다.
POLL_SECONDS = 10

#: 내려받기가 이보다 오래 걸리면 뭔가 잘못된 것입니다
DOWNLOAD_TIMEOUT = 300


def _post(url: str, body: dict, token: str) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8", "replace"))
        except (ValueError, OSError):
            return {"ok": False, "error": f"서버가 {e.code} 로 답했습니다"}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"ok": False, "error": f"서버에 닿지 못했습니다 — {e}"}


class PrintWorker:
    """작업 하나를 끝까지 데려가는 일꾼"""

    def __init__(self, token: str, settings: dict, work_dir: Path, say=print) -> None:
        self.token = token
        self.settings = settings
        self.work_dir = work_dir
        self.say = say
        self.printer = build_printer(settings, work_dir / "보낸것")

    # --- 서버와 주고받기 ---

    def claim(self) -> dict | None:
        got = _post(f"{BASE}/api/device/print", {}, self.token)
        if not got.get("ok"):
            self.say(f"물어보기 실패: {got.get('error', '')}")
            return None
        return got.get("job")

    def report(self, job_id: str, **body) -> None:
        got = _post(f"{BASE}/api/device/print/report", {"jobId": job_id, **body}, self.token)
        if not got.get("ok"):
            self.say(f"알리기 실패: {got.get('error', '')}")

    # --- 한 건 ---

    def download(self, job: dict) -> Path:
        self.work_dir.mkdir(parents=True, exist_ok=True)
        out = self.work_dir / job["fileName"]
        with urllib.request.urlopen(job["downloadUrl"], timeout=DOWNLOAD_TIMEOUT) as r:
            out.write_bytes(r.read())
        return out

    def run_one(self, job: dict) -> None:
        job_id = job["jobId"]
        self.say(f"작업 받음 — {job['fileName']}")

        try:
            path = self.download(job)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            self.report(job_id, step="failed", reason=f"내려받지 못했습니다 — {e}")
            self.say("내려받기 실패")
            return

        self.say(f"내려받음 {path.stat().st_size:,} 바이트 — 프린터로 보냅니다")

        started = False
        try:
            for p in self.printer.send(path):
                if p.failed:
                    self.report(job_id, step="failed", reason=p.failed)
                    self.say(f"멈춤: {p.failed}")
                    return
                if p.note:
                    self.say(p.note)
                if not started:
                    # ★ 프린터가 받아 준 그 순간에만 '출력 중' 으로 옮깁니다.
                    #   보내기도 전에 옮기면 화면이 거짓말을 합니다.
                    self.report(job_id, step="printing", percent=p.percent or 0)
                    started = True
                elif p.done:
                    self.report(job_id, step="done")
                    self.say("출력 완료")
                elif p.percent is not None:
                    self.report(job_id, percent=p.percent)
        except Exception as e:  # noqa: BLE001 — 까닭을 삼키면 아무도 모릅니다
            self.report(job_id, step="failed", reason=f"보내다 멈췄습니다 — {e}")
            self.say(f"멈춤: {e}")

    # --- 돌기 ---

    def tick(self) -> bool:
        """할 일이 있었으면 True"""
        job = self.claim()
        if not job:
            return False
        self.run_one(job)
        return True

    def loop(self, stop=lambda: False) -> None:
        while not stop():
            try:
                self.tick()
            except Exception as e:  # noqa: BLE001 — 돌기는 멈추지 않습니다
                self.say(f"알 수 없는 문제: {e}")
            for _ in range(POLL_SECONDS):
                if stop():
                    return
                time.sleep(1)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="치과 PC 출력 역할")
    ap.add_argument("--once", action="store_true", help="한 번만 물어보고 끝냅니다")
    ap.add_argument("--settings", type=Path, help="scan_agent.json 자리")
    args = ap.parse_args(argv)

    path = args.settings or (Path.home() / "AppData" / "Roaming" / "DenFlow" / "scan_agent.json")
    if not path.exists():
        path = Path(__file__).with_name("scan_agent.json")
    if not path.exists():
        print("설정 파일이 없습니다. 에이전트에서 먼저 연결해 주세요.")
        return 2

    settings = json.loads(path.read_text(encoding="utf-8"))
    token = settings.get("token")
    if not token:
        print("기기 열쇠가 없습니다. 에이전트에서 연결 코드를 넣어 주세요.")
        return 2

    worker = PrintWorker(token, settings, Path(path).parent / "출력")
    if args.once:
        had = worker.tick()
        print("할 일 없음" if not had else "한 건 끝")
        return 0

    print("지켜봅니다. Ctrl+C 로 멈춥니다.")
    try:
        worker.loop()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
