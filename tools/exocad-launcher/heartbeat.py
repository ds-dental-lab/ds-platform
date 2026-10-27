# -*- coding: utf-8 -*-
"""
1분마다 서버에 "살아 있습니다 + 지금 상태" 를 보냅니다 (2026-10-16).

    치과 에이전트 · 설계 일꾼 이 같이 씁니다. 센터의 '기기 상태' 화면에 뜹니다.

★ 왜 — 2026-10-16 설계 PC 프로그램이 한꺼번에 꺼졌는데 아무도 몰랐습니다.
  꺼진 것을 **모르는 것**이 가장 위험합니다. 서버는 3분 소식이 없으면 '꺼짐',
  영업시간에 30분이면 센터에 알림을 보냅니다.
★ 상태에는 환자 정보를 싣지 않습니다(판·프린터·폴더). 오류 문구에는 파일 이름
  등으로 환자 이름이 섞일 수 있습니다 — 그 기록은 **센터만** 봅니다(device_events
  RLS). 센터는 원래 주문에서 환자 이름을 봅니다. 부르는 쪽은 오류일 때만 report.
★ 못 보내도 본업을 막지 않습니다. 오류는 모아 두었다가(최대 50) 다음에 보냅니다.
★ 같은 오류를 10분 안에 또 보내지 않습니다 — 3초마다 실패하는 것이 표를 덮지 않게.
"""

from __future__ import annotations

import json
import socket
import threading
import time
import urllib.error
import urllib.request

#: ★ 60 → 300 (2026-10-27, 사용자 "생존 신고 같은 건 긴 텀") — 기기 셋이면 하루 864
INTERVAL_SECONDS = 300

#: 진료 시간 (KST) — 이 안에서만 FlowTemp 묻기를 빠르게 합니다 (2026-10-27).
#: ★ 왜 — Vercel 무료 한도(요청 100만/월) 안에서 "등록 뒤 설계·출력은 최대한 빨리"(사용자).
#:   치과는 밤·새벽에 스캔을 안 보냅니다. 낮 5초, 밤 60초면 하루 요청이 절반 아래로 줍니다.
BUSY_HOUR_START = 8
BUSY_HOUR_END = 21


def busy_hours(now=None) -> bool:
    """지금이 진료 시간(KST 08:00~21:00)인가 — PC 시계가 어느 시간대든 KST 로 봅니다"""
    import datetime as _dt
    t = now or _dt.datetime.now(_dt.timezone(_dt.timedelta(hours=9)))
    return BUSY_HOUR_START <= t.hour < BUSY_HOUR_END


def poll_seconds(busy: float, idle: float) -> float:
    """진료 시간이면 busy, 아니면 idle"""
    return busy if busy_hours() else idle
SAME_ERROR_SECONDS = 600
MAX_PENDING = 50

#: 기록 한 줄이 오류인지 — 에이전트·일꾼이 실제로 쓰는 말
ERROR_WORDS = ("실패", "못 ", "못했", "못 했", "멈춤", "멈췄", "오류", "끊겼", "거절")


def looks_like_error(line: str) -> bool:
    return any(w in line for w in ERROR_WORDS)


class Heartbeat:
    def __init__(self, base: str, token_of, version: str | None, collect):
        """
        token_of: 열쇠를 돌려주는 함수 (연결을 바꾸면 열쇠가 바뀔 수 있어서)
        collect:  지금 상태 dict 를 돌려주는 함수
        """
        self.base = base.rstrip("/")
        self.token_of = token_of
        self.version = version
        self.collect = collect
        self._pending: list[dict] = []
        self._last_sent: dict[str, float] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()

    def report(self, message: str, level: str = "error") -> None:
        msg = message.strip()[:300]
        if not msg:
            return
        now = time.time()
        with self._lock:
            if now - self._last_sent.get(msg, 0) < SAME_ERROR_SECONDS:
                return
            self._last_sent[msg] = now
            self._pending.append({"level": level, "message": msg})
            del self._pending[:-MAX_PENDING]

    def start(self) -> None:
        threading.Thread(target=self._loop, daemon=True).start()

    def stop(self) -> None:
        self._stop.set()

    def beat_once(self) -> bool:
        token = self.token_of()
        if not token:
            return False
        try:
            status = dict(self.collect() or {})
        except Exception as e:  # noqa: BLE001 — 상태를 못 모아도 살아 있다는 말은 갑니다
            status = {}
            self.report(f"상태를 못 모았습니다 — {e}")
        status.setdefault("host", socket.gethostname())
        with self._lock:
            events = list(self._pending)
        body = {"version": self.version, "status": status, "events": events}
        req = urllib.request.Request(
            f"{self.base}/api/device/heartbeat",
            data=json.dumps(body).encode("utf-8"),
            headers={"content-type": "application/json", "authorization": f"Bearer {token}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                ok = bool(json.loads(r.read().decode("utf-8", "replace")).get("ok"))
        except (urllib.error.URLError, TimeoutError, OSError, ValueError):
            ok = False
        if ok:
            with self._lock:
                del self._pending[: len(events)]
        return ok

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.beat_once()
            except Exception:  # noqa: BLE001 — 상태 보고가 본업을 죽이면 안 됩니다
                pass
            self._stop.wait(INTERVAL_SECONDS)
