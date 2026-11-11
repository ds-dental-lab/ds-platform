# -*- coding: utf-8 -*-
"""
내보낸 크라운의 이름표 — "방금 내보낸 것은 이 주문 것" (2026-10-16 점검).

설계 일꾼이 내보내기를 누르기 **직전에** 적고, 임시치아 지켜보기가 읽습니다.

★★ 왜 — 전에는 지켜보기가 치식만 보고 주문을 찾았습니다.
  - 같은 치식으로 기다리는 FlowTemp 가 둘이면 못 고르고 멈췄습니다.
  - 지켜보기가 재시작하는 사이 크라운이 떨어지면 '켤 때 이미 있던 파일' 로
    보고 건너뛰어 **영영 안 올렸습니다.** 일꾼은 10분 기다리다 멈추고, 다시
    걸면 덴트버드 건수를 또 썼습니다.
  이름표가 있으면 둘 다 풀립니다: 주문을 바로 알고, 이름표 뒤에 생긴 파일은
  켤 때 있었어도 집습니다.

★ 오래된 이름표는 안 믿습니다(MAX_AGE). 내보내기는 몇 초면 떨어집니다.
★ 파일 하나 · JSON. 둘이 같은 PC 에서 돕니다.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

PATH = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "launcher" / "expected-export.json"

#: 이보다 오래된 이름표는 없는 것으로 봅니다
MAX_AGE = 30 * 60


def write(order_id: str, teeth: list[int]) -> None:
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_text(
        json.dumps({"orderId": order_id, "teeth": sorted(teeth), "at": time.time()}, ensure_ascii=False),
        encoding="utf-8",
    )


def read() -> dict | None:
    try:
        tag = json.loads(PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if time.time() - float(tag.get("at", 0)) > MAX_AGE:
        return None
    return tag


def clear(order_id: str | None = None) -> None:
    """지웁니다. order_id 를 주면 그 주문 것일 때만"""
    tag = read()
    if order_id and tag and tag.get("orderId") != order_id:
        return
    for p in (PATH, _refused_path()):
        try:
            p.unlink()
        except OSError:
            pass


# ---------- 지켜보기가 "이 파일은 못 올립니다" 라고 한 것 (2026-11-11) ----------
#
# ★ 왜 — 치과 첫 실전에서 덴트버드가 주문에 없는 치아를 같이 내보냈고, 지켜보기는 "치식이 서로 다릅니다" 로
#   옳게 멈췄습니다. 그런데 그 말이 지켜보기 기록에만 남아, 설계 일꾼은 10분을 다 기다린 뒤 "안 올라왔습니다"
#   라고만 적었습니다. 치과는 10분 동안 '마무리 중' 만 봤고, 센터는 서버 PC 기록을 열어 봐야 까닭을 알았습니다.
# ★ 지켜보기가 까닭을 파일에 적고, 일꾼이 기다리는 동안 그것을 읽어 **바로** 멈춥니다.
#   주문 줄에 적는 것은 일꾼 한 곳뿐입니다 — 둘이 적으면 서로 덮습니다.

def _refused_path() -> Path:
    """이름표 옆 — 부를 때마다 PATH 에서 정합니다 (시험이 PATH 만 바꿔도 따라오게)"""
    return PATH.with_name("export-refused.json")


def refuse(why: str, file_name: str = "") -> bool:
    """방금 내보낸 것을 못 올린다고 적습니다. 이름표가 없으면(사람이 손으로 내보낸 것) 안 적습니다"""
    tag = read()
    if not tag:
        return False
    try:
        if _refused_path().is_file() and json.loads(_refused_path().read_text(encoding="utf-8")).get("orderId") == tag.get("orderId"):
            return True  # 먼저 적힌 까닭을 덮지 않습니다 (파일이 둘이면 둘 다 거절됩니다)
    except (OSError, ValueError):
        pass
    try:
        _refused_path().write_text(
            json.dumps({"orderId": tag.get("orderId"), "why": why[:300], "file": file_name[-60:], "at": time.time()},
                       ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        return False
    return True


def refused(order_id: str) -> str | None:
    """이 주문의 내보내기가 거절됐으면 그 까닭"""
    try:
        got = json.loads(_refused_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if got.get("orderId") != order_id:
        return None
    return str(got.get("why") or "까닭을 못 읽었습니다")


# ---------- 지난 내보내기 치우기 (2026-11-11) ----------
#
# ★ 왜 — 덴트버드는 같은 스캔이면 같은 이름으로 내보냅니다. 멈춘 건을 다시 걸면 새 크라운이 내려받기 폴더에
#   남아 있던 **옛 정보 파일**(.constructionInfo)과 짝지어져 같은 자리에서 또 멈출 수 있습니다. 그날은
#   사람이 서버 PC 에서 손으로 지웠습니다.
# ★ 지우지 않고 옆 폴더로 옮깁니다. 사흘 지난 것만 지웁니다 — 환자 이름이 든 파일이 쌓이지 않게.

KEEP_FOLDER = "덴플로우_지난내보내기"
KEEP_SECONDS = 3 * 24 * 3600
DESIGN_NAME_WORDS = ("crown", "bridge")


def watch_dir() -> Path:
    """지켜보기가 보는 폴더 — 설계 PC 설정의 watch, 없으면 내려받기 폴더 (temp_watch.main 과 같게)"""
    try:
        cfg = json.loads((PATH.parent.parent / "design_agent.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cfg = {}
    return Path(cfg.get("watch") or (Path.home() / "Downloads"))


def sweep(folder: Path, now: float | None = None) -> int:
    """
    내보내기 **직전에** 부릅니다. 폴더에 남아 있는 지난 크라운·브릿지 STL 과 정보 파일을 옆 폴더로 옮기고,
    옆 폴더의 사흘 지난 것은 지웁니다. 옮긴 개수를 돌려줍니다. 못 옮긴 것은 그대로 둡니다(다음에 다시).
    """
    now = time.time() if now is None else now
    keep = folder / KEEP_FOLDER
    moved = 0
    try:
        old = [p for p in folder.iterdir() if p.is_file() and (
            p.suffix.lower() == ".constructioninfo"
            or (p.suffix.lower() == ".stl" and any(w in p.stem.lower() for w in DESIGN_NAME_WORDS)))]
    except OSError:
        return 0
    for p in old:
        try:
            keep.mkdir(exist_ok=True)
            p.replace(keep / p.name)
            moved += 1
        except OSError:
            pass
    try:
        for p in keep.iterdir():
            if p.is_file() and now - p.stat().st_mtime > KEEP_SECONDS:
                p.unlink()
    except OSError:
        pass
    return moved


def fits(tag: dict | None, teeth: list[int]) -> bool:
    """이 크라운의 치식이 이름표와 같은가"""
    return bool(tag) and sorted(tag.get("teeth") or []) == sorted(teeth)
