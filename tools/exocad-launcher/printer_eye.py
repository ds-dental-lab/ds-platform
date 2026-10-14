# -*- coding: utf-8 -*-
r"""프린터 카메라로 **판이 비었는지** 봅니다 (2026-10-14).

    python printer_eye.py            한 장 찍어 둡니다
    python printer_eye.py empty      지금 모습을 '빈 판' 으로 기억합니다
    python printer_eye.py check      빈 판과 견줘 비었는지 말합니다

★★ **왜 — 「비웠습니다」 가 번거롭습니다.** 지금은 사람이 눌러 줘야 다음
  작업이 나갑니다. 프린터는 "뽑기가 끝났다"(FINISH)까지만 말하고 **판이
  비었는지는 말하지 않습니다** — 상태값 98개를 다 견줘 봤습니다(10-14).
  그런데 A1 mini 에는 **카메라가 있습니다**(ipcam_dev=1). 말해 달라고
  하는 대신 **보면** 됩니다.

★★★ **틀릴 때 어느 쪽으로 틀리느냐가 전부입니다.**
  확실히 비었을 때만 '비었다' 고 합니다. 조금이라도 애매하거나, 사진을
  못 찍거나, 빈 판 기준이 없으면 **'모르겠다'** 고 합니다. 그러면 지금처럼
  사람이 누릅니다. 잘 되는 날엔 단추가 사라지고, 안 되는 날엔 지금과
  같습니다 — **더 나빠질 수가 없는 구조**라야 손댈 값이 있습니다.

★★★ **아직 파이프라인에 안 붙였습니다 — 붙이면 안 됩니다** (2026-10-14).
  재 보니 이렇습니다:

      아무것도 없을 때(조명·그림자만)   0.005   ← 바탕 잡음
      큰 물건(손바닥만 한 것)           0.020
      출력 직후                        0.399   ← **판이 앞으로 나와서**

  마지막 숫자가 문제입니다. 크라운 때문이 아니라 **베드가 움직여서**
  입니다. A1 mini 는 출력이 끝나면 판을 앞으로 내보냅니다. 쉴 때·끝났을
  때·멈췄을 때 판이 **다 다른 자리**에 있습니다. 그러니 '같은 네모를
  잘라서 견준다' 가 성립하지 않습니다.

  → 제대로 하려면 **사진에서 판을 먼저 찾아 자세를 맞추고** 견줘야
    합니다(모서리나 바탕 눈금 기준). 반나절짜리 일이고, 틀리면 노즐이
    들이받는 쪽이라 시험도 꼼꼼해야 합니다. 건수가 늘어 「비웠습니다」가
    정말 성가셔질 때 하면 됩니다 — **길이 있다는 것은 확인했습니다.**

★ LAN 모드 카메라는 8883(MQTT)·990(FTPS)과 또 다른 길입니다 — **6000 번**
  포트로 TLS 를 열고, 사용자이름 `bblp` 와 접속 코드를 한 번 보낸 뒤
  JPEG 를 연달아 받습니다.
"""
from __future__ import annotations

import io
import json
import os
import socket
import ssl
import struct
import sys
from pathlib import Path

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow"
SHOTS = STATE / "프린터눈"
EMPTY = SHOTS / "빈판.jpg"

#: 프레임 머리 16바이트 중 앞 4바이트가 그림 크기입니다
HEADER = 16
#: 처음 몇 장은 버립니다 — 카메라가 밝기를 맞추는 동안 어둡게 나옵니다
WARMUP = 3


def settings() -> dict:
    return json.loads((STATE / "scan_agent.json").read_text(encoding="utf-8"))


def grab(host: str, code: str, timeout: int = 15) -> bytes:
    """JPEG 한 장. 못 받으면 OSError"""
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    with socket.create_connection((host, 6000), timeout=timeout) as raw:
        with ctx.wrap_socket(raw, server_hostname=host) as s:
            # ★ 80바이트 인사 — 길이·타입·빈칸 둘, 그다음 이름과 코드를 32칸씩
            hello = struct.pack("<IIII", 0x40, 0x3000, 0, 0)
            hello += b"bblp".ljust(32, b"\0")
            hello += code.encode().ljust(32, b"\0")
            s.sendall(hello)

            got = b""
            for _ in range(WARMUP + 1):
                while len(got) < HEADER:
                    chunk = s.recv(4096)
                    if not chunk:
                        raise OSError("카메라가 연결을 닫았습니다")
                    got += chunk
                size = struct.unpack("<I", got[:4])[0]
                if not 1000 < size < 8_000_000:
                    raise OSError(f"그림 크기가 이상합니다 ({size})")
                got = got[HEADER:]
                while len(got) < size:
                    chunk = s.recv(65536)
                    if not chunk:
                        raise OSError("그림을 다 못 받았습니다")
                    got += chunk
                frame, got = got[:size], got[size:]
            return frame


# ---------- 판이 비었는가 ----------
#
# ★★ **판만 봅니다.** 사진에는 방도 사람도 찍힙니다 (카메라가 앞을 봅니다).
#   그 부분까지 견주면 사람이 지나가기만 해도 "뭔가 있다" 가 됩니다.
#   그리고 그 그림은 **PC 밖으로 안 나갑니다** — 서버로 보내지 않습니다.
#
#: 판이 들어 있는 네모 (1680x1080 기준, 2026-10-14 실측).
#:   위는 툴헤드가 드나들어 잘라 내고, 아래는 판 앞턱까지만 봅니다.
PLATE = (170, 420, 1500, 900)

#: 밝기가 이만큼 넘게 다른 점을 '달라진 점' 으로 셉니다
PIXEL_DIFF = 38
#: 달라진 점이 이 미만이면 **비었다**
EMPTY_RATIO = 0.004
#: 이 위를 넘으면 **뭔가 있다**. 둘 사이는 '모르겠다' 입니다
BUSY_RATIO = 0.02


def _plate(jpg: bytes):
    from PIL import Image, ImageFilter  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415

    im = Image.open(io.BytesIO(jpg)).convert("L").crop(PLATE)
    # ★ 살짝 흐립니다 — 판의 거친 결과 잡티가 매번 다르게 찍힙니다
    im = im.filter(ImageFilter.GaussianBlur(2))
    a = np.asarray(im, dtype="float32")
    # ★ 밝기를 맞춥니다. 조명이 바뀌어도 '달라졌다' 고 하지 않게
    return a - a.mean()


def judge(now: bytes, empty: bytes) -> tuple[str, float]:
    """('비었다'|'있다'|'모르겠다', 달라진 비율)"""
    import numpy as np  # noqa: PLC0415

    a, b = _plate(now), _plate(empty)
    if a.shape != b.shape:
        return "모르겠다", 1.0
    ratio = float((np.abs(a - b) > PIXEL_DIFF).mean())
    if ratio < EMPTY_RATIO:
        return "비었다", ratio
    if ratio > BUSY_RATIO:
        return "있다", ratio
    return "모르겠다", ratio


def check(host: str, code: str) -> tuple[str, float]:
    """★ 못 찍거나 기준이 없으면 **'모르겠다'** 입니다 — 사람이 누릅니다"""
    if not EMPTY.is_file():
        return "모르겠다", 0.0
    try:
        now = grab(host, code)
    except (OSError, struct.error):
        return "모르겠다", 0.0
    return judge(now, EMPTY.read_bytes())


def main() -> int:
    what = sys.argv[1] if len(sys.argv) > 1 else "shot"
    cfg = settings()
    host = cfg.get("printer_last_ip")
    code = cfg.get("printer_code")
    if not host or not code:
        print("프린터 주소나 접속 코드가 없습니다")
        return 1

    SHOTS.mkdir(parents=True, exist_ok=True)
    try:
        jpg = grab(host, code)
    except (OSError, struct.error) as e:
        print(f"카메라를 못 봤습니다 — {e}")
        return 1

    if what == "check":
        if not EMPTY.is_file():
            print("빈 판 기준이 없습니다 — 판을 비우고 `python printer_eye.py empty`")
            return 1
        (SHOTS / "지금.jpg").write_bytes(jpg)
        says, ratio = judge(jpg, EMPTY.read_bytes())
        print(f"{says} (달라진 비율 {ratio:.4f})")
        return 0

    out = EMPTY if what == "empty" else SHOTS / "지금.jpg"
    out.write_bytes(jpg)
    print(f"찍었습니다: {out} ({len(jpg):,} 바이트)")
    if what == "empty":
        print("이 모습을 '빈 판' 으로 기억했습니다")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
