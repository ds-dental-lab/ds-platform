# -*- coding: utf-8 -*-
r"""자동 임시치아 — **폴더에 떨어지면 알아서 보냅니다** (2026-10-14).

    pythonw temp_watch.py

★★ **왜 — 여기가 마지막 사람 손이었습니다.** 덴트버드에서 받은 STL 을
  창에서 **골라** 줘야 했습니다. 다른 자리는 다 자동인데 그 한 번 때문에
  사람이 PC 앞을 못 떠납니다.

  스캔 올리기 — 자동 · 주문 등록 — 사람(의도라 그대로) ·
  덴트버드 설계 — 사람 · **STL 고르기 — 사람 ← 여기** ·
  자르기·보내기 — 자동 · 「비웠습니다」 — 사람(프린터가 신호를 안 줌) ·
  출력 — 자동

★ 고르는 재료는 **치식**입니다. 덴트버드가 `.constructionInfo` 에 적어
  주고(dentbird_case), 서버가 이미 그 값으로 주문서와 대조합니다. 같은
  재료를 막는 데 말고 **찾는 데**도 씁니다.

★★ **애매하면 안 보냅니다.** 같은 치식으로 기다리는 주문이 둘이면 멈추고
  적어 둡니다 — 반쯤 맞는 것으로 고르면 **엉뚱한 이의 크라운이 치과에서
  그대로 출력됩니다.** 그때는 사람이 창에서 고르면 됩니다(그 길은 그대로
  남아 있습니다).

★ 지켜보는 폴더는 설정에서 바꿉니다 (design_agent.json 의 `watch`).
  기본은 내려받기 폴더입니다.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow"
DESIGN_SETTINGS = STATE / "design_agent.json"
LOG = STATE / "launcher" / "임시치아-지켜보기.txt"
WORK = STATE / "임시치아"

#: 몇 초마다 폴더를 보나
POLL_SECONDS = 5
#: 파일이 **다 쓰였는지** 보는 법 — 크기가 이만큼 그대로면 다 온 것입니다.
#:   ★ 안 기다리면 내려받다 만 STL 을 자릅니다. 조용히 깨진 물건이 나옵니다.
SETTLE_SECONDS = 6
#: 뜨기 전에 있던 파일은 건드리지 않습니다 (지난 것을 지금 보내면 안 됩니다)
#:   — 뜬 뒤에 **새로 생긴 것**만 봅니다.
BACKOFF_SECONDS = 60

#: ★★★ **크라운인 것만 집습니다.** 덴트버드는 한 벌을 통째로 내놓습니다 —
#:   크라운 옆에 **상악·하악 스캔**이 같이 나옵니다:
#:
#:       2026-08-21_차정순-upperjaw.stl              ← 통짜 상악 스캔
#:       2026-08-21_차정순-upperjaw_27-27-crown.stl  ← 크라운
#:       2026-08-21_차정순-upperjaw_27.constructionInfo
#:
#:   그런데 `dentbird_case.beside()` 는 같은 폴더에서 **머리글자가 겹치는**
#:   정보 파일을 고릅니다. 그래서 통짜 상악 스캔한테도 치식 27 이 붙습니다.
#:   그대로 두면 **악궁 전체를 잘라 치과에서 출력합니다.**
#: ★ 그래서 이름에 이 낱말이 있는 것만 봅니다. 모르는 이름이면 **안 집고
#:   적어 둡니다** — 덴트버드가 이름을 바꾸면 아무 일도 안 일어나는 쪽이
#:   악궁을 뽑는 쪽보다 낫습니다. 적어 둔 것을 보고 낱말을 늘리면 됩니다.
DESIGN_WORDS = ("crown",)
#: 이 낱말이 있으면 스캔입니다 — 낱말이 겹쳐도 이쪽이 이깁니다
SCAN_WORDS = ("upperjaw", "lowerjaw", "antagonist", "preparation", "scan", "margin")


def is_design(stl: Path, words: tuple[str, ...]) -> bool:
    low = stl.stem.lower()
    if not any(w in low for w in words):
        return False
    # ★ `…-upperjaw_27-27-crown.stl` 처럼 둘 다 든 이름이 있습니다.
    #   **크라운 낱말이 뒤에** 오면 크라운입니다.
    last_design = max(low.rfind(w) for w in words if w in low)
    last_scan = max((low.rfind(w) for w in SCAN_WORDS if w in low), default=-1)
    return last_design > last_scan

seen: set[str] = set()


def say(line: str) -> None:
    text = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {line}"
    try:
        print(text, flush=True)
    except Exception:  # noqa: BLE001
        pass
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(text + "\n")
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
            text = r.read().decode("utf-8", "replace")
        try:
            return json.loads(text)
        except ValueError:
            return {"ok": False, "error": f"답이 JSON 이 아닙니다 ({text[:60]!r})"}
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8", "replace"))
        except (ValueError, OSError):
            return {"ok": False, "error": f"서버가 {e.code} 로 답했습니다"}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"ok": False, "error": f"서버에 닿지 못했습니다 — {e}"}


def settled(path: Path) -> bool:
    """다 쓰였나 — 크기가 멈췄는지 봅니다"""
    try:
        first = path.stat().st_size
    except OSError:
        return False
    time.sleep(SETTLE_SECONDS)
    try:
        return path.stat().st_size == first and first > 0
    except OSError:
        return False


def handle(stl: Path, base: str, token: str) -> None:
    from dentbird_case import check as check_case  # noqa: PLC0415
    from deliver import deliver  # noqa: PLC0415

    looked = check_case(stl)
    if not looked.ok:
        say(f"{stl.name} — 멈춤: {looked.message}")
        return
    if not looked.teeth:
        say(f"{stl.name} — 치식을 못 읽어 넘어갑니다 ({looked.message})")
        return

    say(f"{stl.name} — 치식 {'·'.join(str(t) for t in looked.teeth)}")

    got = post(f"{base}/api/device/auto-print/match", {"teeth": looked.teeth}, token)
    if not got.get("ok"):
        say(f"  주문을 못 찾았습니다: {got.get('error')}")
        return

    say(f"  주문 {got['orderId'][:8]} 로 보냅니다")
    WORK.mkdir(parents=True, exist_ok=True)
    ok = deliver(stl, got["orderId"], got["token"], WORK, 150.0, 140.0, say=lambda m: say("  " + m))
    say("  보냈습니다" if ok else "  보내지 못했습니다")


def main() -> int:
    if not DESIGN_SETTINGS.is_file():
        say(f"설계 PC 열쇠가 없습니다 — {DESIGN_SETTINGS}")
        return 1

    cfg = json.loads(DESIGN_SETTINGS.read_text(encoding="utf-8"))
    base = cfg.get("base_url", "https://denflow.kr").rstrip("/")
    token = cfg.get("token")
    watch = Path(cfg.get("watch") or (Path.home() / "Downloads"))
    words = tuple(cfg.get("design_names") or DESIGN_WORDS)

    if not token:
        say("설정에 기기 열쇠가 없습니다")
        return 1

    # ★★ 뜨기 전에 있던 것은 **이미 본 것**으로 둡니다. 안 그러면 내려받기
    #   폴더에 쌓인 지난 크라운이 켜자마자 줄줄이 출력됩니다.
    try:
        for p in watch.glob("*.stl"):
            seen.add(p.name)
    except OSError:
        pass

    say(f"지켜봅니다 — {watch} · 이미 있던 {len(seen)}개는 건너뜁니다")
    say(f"크라운으로 보는 이름: {'·'.join(words)}")

    while True:
        try:
            fresh = [p for p in watch.glob("*.stl") if p.name not in seen]
        except OSError as e:
            say(f"폴더를 못 봤습니다 — {e}")
            time.sleep(BACKOFF_SECONDS)
            continue

        for stl in sorted(fresh, key=lambda p: p.stat().st_mtime):
            seen.add(stl.name)
            if not is_design(stl, words):
                say(f"건너뜀 (크라운 이름이 아닙니다): {stl.name}")
                continue
            if not settled(stl):
                seen.discard(stl.name)  # 아직 오는 중 — 다음 바퀴에 다시
                continue
            try:
                handle(stl, base, token)
            except Exception as e:  # noqa: BLE001 — 지켜보기는 안 죽습니다
                say(f"{stl.name} — 알 수 없는 문제: {e!r}")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(main())
