# -*- coding: utf-8 -*-
"""
"일 있나" 를 버셀 대신 수파베이스에 바로 묻기 (2026-10-27).

★ 왜: Vercel Hobby 는 Fluid Active CPU 가 한 달 4시간인데, 설계 PC 가 5초·15초마다 버셀에
  묻는 것만으로 그 한도를 넘었습니다(10/27 실측 5h54m). 사용자는 첫 거래처 전까지 Hobby 로
  버티기로 했습니다. 묻기만 DB 가 답하고, **집기부터는 지금처럼 버셀 API** 로 갑니다.
★ 안전망: DB 가 "없다" 고 해도 FORCE_ASK_SECONDS 에 한 번은 버셀에 그냥 묻습니다. DB 쪽
  조건과 서버 집기 조건이 어긋나 일을 못 보는 일이 없게 — 늦어도 1분 안에는 집힙니다.
★ 열쇠: design_agent.json 의 "probe_secret". 없으면 이 길을 안 쓰고 옛길(버셀만) 그대로입니다
  — 설정 한 줄로 되돌릴 수 있습니다. 공개 키(anon)는 원래 브라우저에도 실리는 값입니다.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

SUPABASE_URL = "https://dzliwedyqkondvcwnvbh.supabase.co"
ANON_KEY = "sb_publishable_KXuEswvJ2Tg1E6jDbq2-iQ_m9fC-4D0"
#: DB 가 '없다' 고 해도 이만큼에 한 번은 버셀에 직접 묻습니다
FORCE_ASK_SECONDS = 60


def probe(secret: str | None, timeout: float = 8.0) -> dict | None:
    """{"design": bool, "reslice": bool} — 못 물었으면 None (그러면 버셀에 묻습니다)."""
    if not secret:
        return None
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/auto_print_probe",
        data=json.dumps({"p_secret": secret}).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "apikey": ANON_KEY,
            "authorization": f"Bearer {ANON_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            got = json.loads(r.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None
    if not isinstance(got, dict) or "design" not in got:
        return None
    return got


class Gate:
    """한 종류(design / reslice)에 대해 '지금 버셀에 물을까' 를 정합니다."""

    def __init__(self, kind: str, force_every: float = FORCE_ASK_SECONDS) -> None:
        self.kind = kind
        self.force_every = force_every
        self.last_ask = 0.0  # 버셀에 마지막으로 물은 때

    def should_ask(self, secret: str | None, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        if now - self.last_ask >= self.force_every:
            return True
        got = probe(secret)
        if got is None:
            return True
        return bool(got.get(self.kind))

    def asked(self, now: float | None = None) -> None:
        self.last_ask = time.time() if now is None else now


def decide(kind: str, got: dict | None, last_ask: float, now: float, force_every: float = FORCE_ASK_SECONDS) -> bool:
    """Gate.should_ask 의 순수 부분 — 시험용."""
    if now - last_ask >= force_every:
        return True
    if got is None:
        return True
    return bool(got.get(kind))
