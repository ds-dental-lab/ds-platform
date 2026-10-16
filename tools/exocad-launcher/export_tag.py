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
    try:
        PATH.unlink()
    except OSError:
        pass


def fits(tag: dict | None, teeth: list[int]) -> bool:
    """이 크라운의 치식이 이름표와 같은가"""
    return bool(tag) and sorted(tag.get("teeth") or []) == sorted(teeth)
