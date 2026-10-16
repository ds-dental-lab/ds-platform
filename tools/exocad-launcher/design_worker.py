# -*- coding: utf-8 -*-
"""
설계 PC 일꾼 — 새 FlowTemp 주문을 알아채 덴트버드 매크로를 겁니다 (2026-10-15).

    서버에 묻기 → 잡기 → 스캔 받기·풀기 → 턱 고르기
    → 덴트버드(올리기·분석·치식 대조·생성) → 설계값 고정 → 내보내기
    → (여기서부터는 지켜보기가) 집기 → 자르기 → 주문에 올리기

★★ 사용자 중간점검 — "에이전트 하나로 디자인부터 출력까지 원격으로 되는 거 맞지?"
  아니었습니다. 새 주문을 알아채 매크로를 거는 손이 없어 제가 명령을 쳤습니다.
  이 일꾼이 그 손입니다.

★ 한 번에 하나. 덴트버드 창은 하나뿐입니다.
★ **어디서 멈추든 주문 화면에 적습니다**(design_stage='stalled' + 까닭).
  치과에는 '디자인 지연', 센터에는 까닭이 뜹니다. 멈춘 건은 서버가 다시 안
  줍니다 — 사람이 보고 「다시 걸기」 해야 합니다. 같은 데서 또 멈추며 덴트버드
  건수만 쓰는 일을 막습니다.
★ 내보낸 뒤 **올라올 때까지 지켜봅니다.** 지켜보기가 죽어 있으면 주문이
  '디자인' 칸에 영영 서 있다가, 30분 뒤 서버가 다시 내주어 건수를 또 씁니다.
  그래서 10분 안에 안 올라오면 '확인 중' 으로 세워 둡니다.

혼자 돌려 보기:
    python design_worker.py --once            # 일감 하나만
    python design_worker.py --once --no-export  # 내보내기 창 확인까지만 (건수 안 씀)
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import export_tag
from dentbird_macro import Reporter, SessionLost, Stop, export, run, session_problem
from dentbird_params import ParamError, apply_all
from dentbird_web import alive, attach, open_browser, reap_drivers
from design_scans import PickError, candidates, pick, unzip_all
from watch_common import beat, revive, single_instance

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow"
DESIGN_SETTINGS = STATE / "design_agent.json"
WORK = STATE / "설계일감"
LOG = STATE / "launcher" / "설계-일꾼.txt"

#: 얼마에 한 번 일감을 묻나
POLL_SECONDS = 30
#: 덴트버드 창이 못 쓰는 상태(로그인 풀림 등)일 때 쉬는 시간
SESSION_PAUSE_SECONDS = 300
#: 덴트버드 창이 없을 때 다시 띄워 보는 간격
REOPEN_SECONDS = 300
#: 내보낸 STL 이 주문에 올라오기를 기다리는 한도
DELIVER_WAIT_SECONDS = 600
NAME = "design_worker"


def say(line: str) -> None:
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    text = f"[{stamp}] {line}"
    print(text, flush=True)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(text + "\n")
    except OSError:
        pass
    # ★ 저장소의 _real_state.txt 에도 (2026-10-16) — 작업 도구 쪽에서는 실제 AppData 가
    #   안 보여서, 실제로 무슨 일이 있었는지 볼 길이 이것뿐입니다
    try:
        from watch_common import REAL_STATE  # noqa: PLC0415
        with REAL_STATE.open("a", encoding="utf-8") as f:
            f.write("일꾼 " + text + "\n")
    except OSError:
        pass


def post(url: str, body: dict, token: str) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
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
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        return {"ok": False, "error": f"서버에 닿지 못했습니다 — {e}"}


class Transient(Exception):
    """잠깐의 끊김 — 일감을 내려놓고 다음 바퀴에 다시 합니다 (2026-10-16 점검)"""


def download(files: list[dict], folder: Path) -> None:
    if folder.exists():
        shutil.rmtree(folder, ignore_errors=True)
    folder.mkdir(parents=True, exist_ok=True)
    for f in files:
        # ★ 이름에서 경로 조각을 떼어 냅니다 — 받은 이름으로 바깥에 쓰지 않게
        name = Path(f["name"]).name or "scan"
        try:
            with urllib.request.urlopen(f["url"], timeout=600) as r:
                (folder / name).write_bytes(r.read())
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            # ★ 스캔을 받다 끊긴 것은 주문 탓이 아닙니다 — 멈춤으로 세우지 않습니다
            raise Transient(f"스캔을 받다 끊겼습니다 — {e}") from e


#: 덴트버드 창이 못 쓰는 상태를 본 때 — 그 뒤 잠시 일감을 안 잡습니다
_session_bad_at = 0.0


def handle(job: dict, spend: bool) -> None:
    order_id, teeth = job["orderId"], job["teeth"]
    mark = Reporter(order_id, say=say)
    say(f"일감 {job['orderNo']} — 치식 {teeth}, 스캔 {len(job['files'])}개")

    try:
        # ★ 지금은 싱글 크라운만 (사용자 목표 — 싱글 하나 완벽하게, 그다음 브릿지)
        if len(teeth) != 1:
            raise Stop(f"치식이 {len(teeth)}개입니다 — 지금은 싱글 크라운만 자동으로 합니다")

        folder = WORK / order_id
        download(job["files"], folder)
        unzip_all(folder)
        prep, anta = pick(candidates(folder), teeth[0])
        say(f"작업치 {prep.name} · 대합치 {anta.name}")

        run([prep, anta], teeth, say=say, mark=mark)
        say("설계값을 맞춥니다 — 내면 · 교합/인접 · 최소 두께")
        try:
            apply_all(attach(), say=say)
        except ParamError as e:
            raise Stop(f"설계값을 못 맞췄습니다 — {e}") from e

        if spend:
            mark("exporting")
            # ★ 이름표 — 지켜보기가 이 크라운을 이 주문에 붙입니다 (2026-10-16 점검)
            export_tag.write(order_id, teeth)
        clicked = export(attach(), teeth, spend, say=say)
        if not clicked:
            mark("stalled", "시험으로 돌렸습니다 — 내보내기 직전에서 멈췄습니다 (--no-export)")
            return

        # ★ 지켜보기가 집어 올릴 때까지. 올라가면 서버가 '디자인 차례가 아니다' 라고
        #   답합니다 — 그게 다 됐다는 뜻입니다. 묻는 김에 잡은 표시도 새로 둡니다.
        until = time.time() + DELIVER_WAIT_SECONDS
        while time.time() < until:
            time.sleep(15)
            if not mark.still_designing():
                say("주문에 올라갔습니다 — 출력 대기로 넘어갑니다")
                export_tag.clear(order_id)
                return
        mark("stalled", f"내보냈는데 {DELIVER_WAIT_SECONDS // 60}분 안에 주문에 안 올라왔습니다 — 임시치아 지켜보기를 봐 주세요")
        say("내보냈는데 안 올라왔습니다 — 확인 중으로 세웁니다")
    except SessionLost as e:
        # ★ 창 탓이지 주문 탓이 아닙니다 — 내려놓고 쉽니다 (2026-10-16 점검)
        global _session_bad_at
        _session_bad_at = time.time()
        mark.release()
        say(f"덴트버드 창이 못 쓰는 상태라 일감을 내려놓습니다 — {e}")
    except Transient as e:
        mark.release()
        say(f"잠깐 끊겨 일감을 내려놓습니다 — 다음 바퀴에 다시 합니다 ({e})")
    except (Stop, PickError) as e:
        mark("stalled", str(e))
        say(f"멈춤: {e}")
    except Exception as e:  # noqa: BLE001 — 까닭을 삼키면 아무도 모릅니다
        mark("stalled", f"알 수 없는 문제 — {e}")
        say(f"멈춤(알 수 없음): {e}")


def _window_bad() -> bool:
    """일감을 잡기 **전에** 덴트버드 창이 쓸 만한지 봅니다 (2026-10-16 점검)

    ★ 잡은 뒤에 알면 그 주문이 하나씩 멈춥니다. 잡기 전에 보고, 못 쓰면 안 잡습니다.
    ★ 할 일이 있을 때만 부릅니다 — 평소에 붙으면 창이 앞으로 튀어나옵니다.
    """
    global _session_bad_at
    try:
        why = session_problem(attach())
    except Exception as e:  # noqa: BLE001
        why = f"덴트버드 창에 붙지 못했습니다 — {e}"
    if why:
        _session_bad_at = time.time()
        say(f"일감을 잠시 안 받습니다 — {why}")
        return True
    return False


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="설계 PC 일꾼 — FlowTemp 자동 설계")
    ap.add_argument("--once", action="store_true", help="일감 하나만 하고 끝냅니다")
    ap.add_argument("--no-export", action="store_true", help="내보내기 창 확인까지만 (덴트버드 건수를 안 씁니다)")
    args = ap.parse_args(argv)

    from watch_common import ensure_design_key, log_to_crash  # noqa: PLC0415
    ensure_design_key(NAME)
    log_to_crash(NAME)
    if not single_instance(NAME):
        say("이미 떠 있습니다 — 물러납니다")
        from watch_common import ALREADY_RUNNING  # noqa: PLC0415
        return ALREADY_RUNNING

    if not DESIGN_SETTINGS.is_file():
        say(f"설계 PC 열쇠가 없습니다 — {DESIGN_SETTINGS}")
        return 1
    cfg = json.loads(DESIGN_SETTINGS.read_text(encoding="utf-8"))
    base = cfg.get("base_url", "https://denflow.kr").rstrip("/")
    token = cfg.get("token")
    if not token:
        say("설정에 기기 열쇠가 없습니다")
        return 1

    # ★ 매크로가 7분씩 도는 동안에도 살아 있다는 표시를 남깁니다
    stop = threading.Event()

    def heart():
        while not stop.is_set():
            beat(NAME)
            stop.wait(30)

    threading.Thread(target=heart, daemon=True).start()
    # ★ 앞선 일꾼이 남긴 고아 크롬드라이버 — 시작프로그램의 crash.txt 를 쥐고 있을 수 있습니다
    gone = reap_drivers()
    if gone:
        say(f"남아 있던 크롬드라이버 {gone}개를 껐습니다")
    say("설계 일꾼을 켰습니다" + (" (시험 — 내보내기 안 함)" if args.no_export else ""))

    reopened = 0.0
    try:
        while True:
            # ★ 지켜보기 둘이 죽었으면 살립니다 (그쪽도 이 일꾼을 살핍니다)
            revive(NAME, say=say)
            if not alive():
                # ★ PC 를 켠 뒤 창이 없으면 직접 띄웁니다. 로그인은 전용 프로필에
                #   남아 있습니다 — 풀렸으면 사람이 한 번 해야 합니다
                if time.time() - reopened > REOPEN_SECONDS:
                    reopened = time.time()
                    say("덴트버드 전용 창이 없어 띄웁니다")
                    try:
                        open_browser("https://ai.dentbird.com/cloud/design")
                    except Exception as e:  # noqa: BLE001
                        say(f"덴트버드 창을 못 띄웠습니다 — {e}")
            elif time.time() - _session_bad_at < SESSION_PAUSE_SECONDS:
                pass  # 덴트버드 창이 돌아올 때까지 일감을 안 잡습니다
            else:
                # ★★ 잡지 않고 **묻기만** 합니다 (2026-10-16). 할 일이 있을 때만 덴트버드
                #   창을 확인합니다 — 전에는 5분마다 창에 붙어 디자이너 화면 앞으로
                #   덴트버드 창을 끌어왔습니다 ("왜 자꾸 활성화되는 거야").
                got = post(f"{base}/api/device/auto-print/next-design", {"peek": True}, token)
                if got.get("ok") and not got.get("job") and got.get("available"):
                    got = {"ok": True} if _window_bad() else post(
                        f"{base}/api/device/auto-print/next-design", {}, token)
                if not got.get("ok"):
                    say(f"일감 묻기 실패: {got.get('error')}")
                elif got.get("job"):
                    handle(got["job"], spend=not args.no_export)
                    # ★ 일감 하나에 창에 여러 번 붙으며 크롬드라이버가 남습니다 — 끝나면 치웁니다.
                    #   일꾼만 쓰는 것이라 쉬는 지금 꺼도 됩니다 (2026-10-16, 한때 5개 쌓임)
                    reap_drivers()
                    if args.once:
                        return 0
                elif args.once:
                    say("일감 없음")
                    return 0
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        return 0
    finally:
        stop.set()


if __name__ == "__main__":
    raise SystemExit(main())
