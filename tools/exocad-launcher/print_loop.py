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

#: ★ 미리 데우기 (사용자 2026-10-23 "미리 데우기도 넣어줘") — **판만**, 55도(텍스처 PEI 첫 층).
#:   노즐은 안 데웁니다: A1 mini 는 시작할 때 노즐을 170·140 으로 **식히며 기다려서**
#:   미리 데우면 오히려 2분을 잃었습니다(2026-10-10 실측, printer_send.warm 참고).
WARM_BED = 55
#: 이 PC 에 남겨 둘 내려받은 출력 파일 수 (2026-10-23)
LOCAL_KEEP = 5
#: 판 온도 명령을 다시 보내는 간격 — 프린터가 꺼졌다 켜졌어도 다시 데우게
WARM_REPEAT_SECONDS = 120
#: 이만큼 데웠는데도 출력이 안 시작되면 끕니다 — 사람이 없는 밤에 판이 혼자 서 있지 않게
WARM_MAX_SECONDS = 15 * 60

#: 내려받기가 이보다 오래 걸리면 뭔가 잘못된 것입니다
DOWNLOAD_TIMEOUT = 300


def _extras(p) -> dict:
    """남은 분·층 — 아는 것만 보냅니다 (2026-10-15). 서버는 없으면 어림합니다"""
    out = {}
    for key in ("remaining", "layer", "layers"):
        v = getattr(p, key, None)
        if isinstance(v, (int, float)) and v >= 0:
            out[key] = int(v)
    return out


#: 서버가 **확실히 거절한** 말 — 다시 보내도 같습니다. 그 밖은 다시 보냅니다.
#: ★ 거꾸로 두지 않습니다(2026-10-16 점검). DB 가 잠깐 아픈 것도 400 + 문구로
#:   오는데, '닿지 못함' 만 다시 보내면 그런 것을 버렸습니다.
REJECTED = ("갈 수 없습니다", "찾지 못했습니다", "보낼 수 없습니다", "올바르지 않습니다", "연결되지 않은 기기")


def _rejected(err: str) -> bool:
    return any(w in err for w in REJECTED)


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

    def __init__(
        self, token: str, settings: dict, work_dir: Path, say=print, save=None
    ) -> None:
        self.token = token
        self.settings = settings
        self.work_dir = work_dir
        self.say = say
        #: 설정을 적어 두는 쪽. 프린터 주소가 바뀌면 기억해 둡니다
        self.save = save
        self.printer = build_printer(settings, work_dir / "보낸것")
        #: 못 보낸 단계 보고 — 연결이 돌아오면 다시 보냅니다 (2026-10-16 점검)
        self.pending: list[tuple[str, dict]] = []
        #: 미리 데우기 (2026-10-23) — 서버가 '곧 뽑을 것이 있다' 고 했는가
        self.warm_hint = False
        self.warm_since: float | None = None
        self.warm_sent = 0.0
        self.warm_gave_up = False

    def remember_host(self) -> None:
        """
        방금 쓴 프린터 주소를 적어 둡니다.

        ★★ 왜 필요한가 (2026-10-08) — 프린터는 방송으로 찾습니다. 그런데
          치과 윈도우 방화벽이 그 방송 듣기를 막으면(한 번 '취소' 를 누르면
          다음부터 묻지도 않고 막습니다) 찾을 길이 **지난번 주소**뿐입니다.
          전에는 「프린터 찾기」를 누를 때만 적어 뒀기 때문에, 공유기가
          주소를 바꾼 날 사람이 그 단추를 다시 눌러야 했습니다.
        """
        host = getattr(self.printer, "host", "")
        if not host or not self.save or self.settings.get("printer_last_ip") == host:
            return
        self.settings["printer_last_ip"] = host
        try:
            self.save(self.settings)
        except Exception as e:  # noqa: BLE001 — 적어 두지 못해도 출력은 끝났습니다
            self.say(f"프린터 주소를 적어 두지 못했습니다: {e}")

    # --- 서버와 주고받기 ---

    def claim(self) -> dict | None:
        got = _post(f"{BASE}/api/device/print", {}, self.token)
        if not got.get("ok"):
            self.say(f"물어보기 실패: {got.get('error', '')}")
            self.warm_hint = False
            return None
        self.warm_hint = bool(got.get("warm"))
        return got.get("job")

    # --- 미리 데우기 (2026-10-23) ---

    def _bed(self, temp: int) -> bool:
        """
        판 온도 한 줄을 보냅니다 — **프린터가 놀고 있을 때만**.
        다른 것을 뽑는 중에 보내면 그 출력의 판 온도를 바꿔 버립니다.
        """
        printer = self.printer
        if not hasattr(printer, "_mqtt"):
            return False  # 가짜 프린터
        try:
            state = printer.status(4.0).get("gcode_state") or ""
            if state in getattr(printer, "BUSY_STATES", ()):
                return False
            client = printer._mqtt()
            client.connect(printer.host or printer.resolve(), 8883, keepalive=30)
            client.loop_start()
            try:
                time.sleep(1)  # 붙을 틈
                if temp:
                    printer.warm(client, temp, 0)
                else:
                    printer.cool(client)
                time.sleep(1)  # 보내고 바로 끊으면 안 나갑니다
            finally:
                client.loop_stop()
                try:
                    client.disconnect()
                except OSError:
                    pass
            return True
        except Exception as e:  # noqa: BLE001 — 못 데워도 출력은 됩니다
            self.say(f"미리 데우기를 못 보냈습니다: {e}")
            return False

    def keep_warm(self) -> None:
        """
        ★ 서버가 '곧 뽑을 것' 이 있다고 하면(설계가 돌기 시작한 때부터) 판을 데워 둡니다.
          「비웠습니다」를 누른 뒤 판이 55도가 되기를 기다리던 시간(실측 26초쯤)이 사라집니다.
        ★ 15분 넘게 출력이 안 시작되면 끄고, 그 일이 끝날 때까지 다시 안 데웁니다.
        ★ 일감이 사라지면(그만두기·삭제) 바로 끕니다.
        """
        now = time.time()
        if self.warm_hint:
            if self.warm_gave_up:
                return
            if self.warm_since is None:
                self.warm_since = now
                self.say(f"곧 뽑을 것이 있어 판을 미리 데웁니다 ({WARM_BED}°)")
            if now - self.warm_since > WARM_MAX_SECONDS:
                self._bed(0)
                self.warm_gave_up = True
                self.say(f"{WARM_MAX_SECONDS // 60}분 동안 출력이 안 시작돼 판을 식힙니다")
                return
            # ★ 못 보내도 간격은 지킵니다 — 프린터가 꺼져 있으면 10초마다 같은 경고가 쌓입니다
            if now - self.warm_sent >= WARM_REPEAT_SECONDS:
                self.warm_sent = now
                self._bed(WARM_BED)
            return
        if self.warm_since is not None and not self.warm_gave_up:
            self._bed(0)
            self.say("뽑을 것이 없어져 판을 식힙니다")
        self.warm_reset()

    def warm_reset(self) -> None:
        self.warm_since = None
        self.warm_sent = 0.0
        self.warm_gave_up = False

    def report(self, job_id: str, **body) -> None:
        """
        서버에 알립니다.

        ★★ **단계 보고(출력 시작·다 나옴·실패)는 잃으면 안 됩니다** (2026-10-16 점검).
          전에는 한 번 보내고 끝이라, '다 나왔다' 를 보내는 순간 와이파이가 끊기면
          서버에는 영원히 '출력 중' 이 남고 '꺼내 주세요' 알림도 안 갔습니다.
          몇 번 다시 해 보고, 그래도 안 되면 **보관했다가** 다음 바퀴에 또 보냅니다.
        ★ 퍼센트는 한 번만 — 20초 뒤 새 숫자가 옵니다.
        """
        # ★ '이어서' 도 잃으면 안 됩니다 — 잃으면 화면에 일시 정지가 끝까지 남습니다 (2026-10-23)
        must = "step" in body or body.get("resumed") is True
        tries = 3 if must else 1
        for i in range(tries):
            got = _post(f"{BASE}/api/device/print/report", {"jobId": job_id, **body}, self.token)
            if got.get("ok"):
                return
            err = str(got.get("error", ""))
            # ★ 서버가 '그 단계로는 못 간다' 고 답한 것은 다시 보내도 같습니다
            if _rejected(err):
                self.say(f"알리기 거절: {err}")
                return
            if i < tries - 1:
                time.sleep(5 * (i + 1))
        self.say(f"알리기 실패: {err}")
        if must:
            self.pending.append((job_id, body))
            self.say("  나중에 다시 보냅니다")

    def flush(self) -> None:
        """보관해 둔 단계 보고를 다시 보냅니다 — 차례대로, 막히면 거기서 멈춤"""
        while self.pending:
            job_id, body = self.pending[0]
            got = _post(f"{BASE}/api/device/print/report", {"jobId": job_id, **body}, self.token)
            err = str(got.get("error", ""))
            if not got.get("ok") and not _rejected(err):
                return  # 아직 끊겨 있습니다
            self.pending.pop(0)
            self.say(f"보관했던 보고를 보냈습니다 ({body.get('step')})" if got.get("ok") else f"보관했던 보고가 거절됐습니다: {err}")

    # --- 한 건 ---

    def download(self, job: dict) -> Path:
        self.work_dir.mkdir(parents=True, exist_ok=True)
        out = self.work_dir / job["fileName"]
        with urllib.request.urlopen(job["downloadUrl"], timeout=DOWNLOAD_TIMEOUT) as r:
            out.write_bytes(r.read())
        self.prune_downloads(keep=LOCAL_KEEP)
        return out

    def prune_downloads(self, keep: int) -> int:
        """
        ★ 내려받은 출력 파일을 최근 몇 개만 남깁니다 (사용자 2026-10-23 "용량은 어느 정도").
          보낸 뒤에도 안 지워 한 개 1.3MB 씩 쌓였습니다(하루 시험에 31개). 우리가 내려받는
          이름 모양(…_auto.gcode.3mf)만 지웁니다. 못 지워도 출력은 계속합니다.
        """
        try:
            files = sorted(
                (f for f in self.work_dir.glob("*_auto.gcode.3mf") if f.is_file()),
                key=lambda f: f.stat().st_mtime,
            )
        except OSError:
            return 0
        gone = 0
        for f in files[: max(0, len(files) - keep)]:
            try:
                f.unlink()
                gone += 1
            except OSError:
                pass
        return gone

    def run_one(self, job: dict) -> None:
        job_id = job["jobId"]
        # ★ 다시 켜져 하던 출력을 이어서 지켜보기 (2026-10-23)
        if job.get("resume"):
            self.resume_one(job)
            return
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
                # ★ 일시 정지·이어서 (2026-10-23) — 단계는 그대로, 서버가 '일시 정지' 로 띄우고 알립니다
                if p.paused:
                    self.report(job_id, paused=p.paused, percent=p.percent if p.percent is not None else None)
                    self.say(f"일시 정지 — {p.paused}")
                    continue
                if p.resumed:
                    self.report(job_id, resumed=True, percent=p.percent, **_extras(p))
                    self.say("이어서 출력합니다")
                    continue
                if p.started and not started:
                    # ★★ 프린터가 **우리 파일을** 돌리기 시작한 것을 확인한
                    #   순간에만 '출력 중' 으로 옮깁니다 (2026-10-08).
                    #   전에는 '보냈습니다' 에서 옮겼습니다 — 보낸 것과 도는
                    #   것은 다릅니다. 프린터가 딴 것을 뽑고 있으면 우리 명령은
                    #   무시되는데 화면은 출력 중이라고 적혀 있었습니다.
                    self.report(job_id, step="printing", percent=p.percent or 0, **_extras(p))
                    started = True
                elif p.done:
                    self.report(job_id, step="done")
                    self.say("출력 완료")
                elif started and p.percent is not None:
                    self.report(job_id, percent=p.percent, **_extras(p))
        except Exception as e:  # noqa: BLE001 — 까닭을 삼키면 아무도 모릅니다
            self.report(job_id, step="failed", reason=f"보내다 멈췄습니다 — {e}")
            self.say(f"멈춤: {e}")

    def resume_one(self, job: dict) -> None:
        """
        ★ 에이전트가 업데이트·재부팅으로 다시 켜졌을 때 — 서버가 '이 기기가 하던 것' 을 돌려줍니다.
          프린터 상태만 보고 끝까지 따라가 결과를 알립니다. 이미 '출력 중' 으로 적혀 있으면
          시작 보고는 다시 하지 않습니다.
        """
        job_id = job["jobId"]
        self.say(f"다시 켜져 하던 출력을 이어서 지켜봅니다 — {job['fileName']}")
        follow = getattr(self.printer, "follow", None)
        if follow is None:
            self.report(job_id, step="failed", reason="다시 켜져 출력 결과를 모릅니다 — 출력물을 봐 주세요")
            return
        already_printing = job.get("resume") == "printing"
        try:
            for p in follow(job["fileName"]):
                if p.failed:
                    self.report(job_id, step="failed", reason=p.failed)
                    self.say(f"멈춤: {p.failed}")
                    return
                if p.paused:
                    self.report(job_id, paused=p.paused, percent=p.percent)
                    continue
                if p.resumed:
                    self.report(job_id, resumed=True, percent=p.percent, **_extras(p))
                    continue
                if p.done:
                    if not already_printing:
                        self.report(job_id, step="printing", percent=100)
                    self.report(job_id, step="done")
                    self.say("출력 완료 (다시 켜진 뒤 확인)")
                    return
                if p.started and not already_printing:
                    self.report(job_id, step="printing", percent=p.percent or 0, **_extras(p))
                    already_printing = True
                elif p.percent is not None:
                    self.report(job_id, percent=p.percent, **_extras(p))
        except Exception as e:  # noqa: BLE001
            self.report(job_id, step="failed", reason=f"이어서 지켜보다 멈췄습니다 — {e}")

    # --- 돌기 ---

    def tick(self) -> bool:
        """할 일이 있었으면 True"""
        self.flush()
        job = self.claim()
        if not job:
            self.keep_warm()
            return False
        # ★ 출력이 시작되면 데우기는 출력 파일이 이어받습니다 — 끄지 않고 표시만 지웁니다
        self.warm_reset()
        self.run_one(job)
        self.remember_host()
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

    def save(cfg: dict) -> None:
        path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")

    worker = PrintWorker(token, settings, Path(path).parent / "출력", save=save)
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
