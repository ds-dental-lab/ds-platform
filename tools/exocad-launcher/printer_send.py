# -*- coding: utf-8 -*-
"""
출력 파일을 프린터에 보내기 (2026-10-06).

치과 PC 에서 돕니다. **같은 랜 안의** 프린터에 직접 보냅니다 —
바깥에서 프린터로 들어오는 길은 열지 않습니다.

★ 기종이 아직 미정입니다 (2026-10-06). 그래서 보내는 쪽을 **갈아 끼울 수**
  있게 해 두었습니다. 지금은 `MockPrinter` 로 전 구간을 돌려 보고,
  기계가 오면 `BambuPrinter` 로 바꾸기만 합니다. 나머지 고리는 안 바뀝니다.

★ Bambu 는 **`.3mf` 만** 출력을 걸 수 있습니다. 생 `.gcode` 는 안 받습니다.
  오르카의 `--export-3mf` 결과가 그 형식이라 변환이 없습니다.

★ 액세스 코드는 **이 PC 에만** 있습니다. 덴플로우 서버로 올리지 않습니다.
"""

from __future__ import annotations

import ftplib
import socket
import ssl
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Protocol

#: 프린터가 파일을 받는 자리 (Bambu 는 SD 카드 루트)
REMOTE_DIR = ""

#: 진행률을 몇 초마다 올릴지. 너무 자주 보내면 서버만 시끄럽습니다
REPORT_EVERY = 20


@dataclass
class Progress:
    """한 번의 알림. `percent` 가 None 이면 아직 숫자를 모릅니다"""

    percent: float | None
    note: str = ""
    done: bool = False
    failed: str | None = None


class Printer(Protocol):
    """보내는 쪽이 갖춰야 할 모습. 이것만 맞추면 갈아 끼울 수 있습니다"""

    def send(self, path: Path) -> Iterator[Progress]:
        """파일을 보내고 출력을 건 뒤, 끝날 때까지 알림을 흘립니다"""


# ---------------------------------------------------------------- 가짜 프린터


class MockPrinter:
    """
    프린터인 척합니다.

    ★ 기종이 정해지기 전에 **나머지 네 고리를 전부 확인**하려고 둡니다.
      받은 파일을 폴더에 놓고, 진행률을 흉내 내 올립니다.
    ★ 일부러 느리게 돌지 않습니다. 연결을 보려는 것이지 기다리려는 것이 아닙니다.
    """

    def __init__(self, spool: Path, seconds: float = 6.0, steps: int = 5) -> None:
        self.spool = spool
        self.seconds = seconds
        self.steps = max(1, steps)

    def send(self, path: Path) -> Iterator[Progress]:
        self.spool.mkdir(parents=True, exist_ok=True)
        target = self.spool / path.name
        target.write_bytes(path.read_bytes())
        yield Progress(None, f"보냈습니다 ({target.name}, {target.stat().st_size:,} 바이트)")

        for i in range(1, self.steps + 1):
            time.sleep(self.seconds / self.steps)
            yield Progress(i * 100 / self.steps, "출력 중")

        yield Progress(100, "출력 완료", done=True)


# ---------------------------------------------------------------- Bambu (LAN)


class _ImplicitFTPS(ftplib.FTP_TLS):
    """
    Bambu 는 **암묵적** FTPS(990) 입니다.

    ★ 파이썬 기본 FTP_TLS 는 명시적(AUTH TLS)이라 그대로는 못 붙습니다.
      붙는 순간 소켓을 감싸 줘야 합니다.
    ★ 인증서는 프린터가 스스로 서명한 것이라 검사하지 않습니다.
      같은 랜 안의 기계에 보내는 길이고, 검사하면 붙지 않습니다.
    """

    def __init__(self, *args, **kwargs) -> None:
        self._sock: socket.socket | None = None
        super().__init__(*args, **kwargs)

    @property  # type: ignore[override]
    def sock(self):
        return self._sock

    @sock.setter
    def sock(self, value) -> None:
        if value is not None and not isinstance(value, ssl.SSLSocket):
            value = self.context.wrap_socket(value)
        self._sock = value


@dataclass
class BambuPrinter:
    """
    LAN 모드의 Bambu 프린터.

    ★ **IP 를 설정에 적지 않습니다** (2026-10-06). 공유기가 빌려주는 번호라
      정전이나 재부팅으로 바뀝니다. 설정에는 **시리얼과 액세스 코드**만 두고,
      주소는 보낼 때마다 시리얼로 찾습니다 (printer_find).
    ★ `host` 는 마지막에 쓰던 주소입니다 — 방송을 못 듣는 공유기를 위한
      보조 바퀴고, 찾으면 그 값으로 갱신됩니다.
    """

    access_code: str
    serial: str
    host: str = ""
    timeout: int = 30

    def resolve(self) -> str:
        """
        지금 주소를 알아냅니다.

        시리얼로 찾기 → 안 되면 마지막에 쓰던 주소 → 그것도 없으면 실패.
        """
        from printer_find import find  # noqa: PLC0415 — 서로 부르는 것을 피합니다

        got = find(self.serial) if self.serial else None
        if got:
            self.host = got.ip
            return got.ip
        if self.host:
            return self.host
        raise OSError("프린터를 찾지 못했습니다 (켜져 있는지, 같은 와이파이인지 봐 주세요)")

    def login_test(self) -> None:
        """들어가지기만 보고 끊습니다. 「프린터 찾기」가 씁니다"""
        ftp = self._ftp(self.host or self.resolve())
        try:
            ftp.nlst()
        finally:
            try:
                ftp.quit()
            except (ftplib.all_errors, OSError):
                pass

    # --- 파일 올리기 (FTPS 990) ---

    def _ftp(self, host: str) -> _ImplicitFTPS:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")  # 프린터 펌웨어가 옛 암호를 씁니다

        ftp = _ImplicitFTPS(context=ctx, timeout=self.timeout)
        ftp.connect(host, 990)
        ftp.login("bblp", self.access_code)
        ftp.prot_p()
        return ftp

    def upload(self, path: Path) -> str:
        ftp = self._ftp(self.resolve())
        try:
            remote = f"{REMOTE_DIR}{path.name}"
            with open(path, "rb") as f:
                ftp.storbinary(f"STOR {remote}", f)
            return remote
        finally:
            try:
                ftp.quit()
            except (ftplib.all_errors, OSError):
                pass

    # --- 출력 걸고 지켜보기 (MQTT 8883) ---

    def send(self, path: Path) -> Iterator[Progress]:
        try:
            import paho.mqtt.client as mqtt  # noqa: PLC0415
        except ImportError:
            yield Progress(None, "", failed="paho-mqtt 가 없습니다 (pip install paho-mqtt)")
            return

        try:
            remote = self.upload(path)
        except Exception as e:  # noqa: BLE001 — 까닭을 그대로 올려야 합니다
            yield Progress(None, "", failed=f"프린터에 올리지 못했습니다 — {e}")
            return

        yield Progress(None, f"보냈습니다 ({remote})")

        state: dict = {"percent": None, "done": False, "failed": None, "note": ""}

        def on_message(_c, _u, msg) -> None:
            import json  # noqa: PLC0415

            try:
                data = json.loads(msg.payload.decode("utf-8", "replace")).get("print", {})
            except (ValueError, AttributeError):
                return
            if "mc_percent" in data:
                state["percent"] = float(data["mc_percent"])
            stage = data.get("gcode_state")
            if stage == "FINISH":
                state["done"] = True
            elif stage == "FAILED":
                state["failed"] = "프린터가 실패를 알렸습니다"
            if data.get("print_error"):
                state["failed"] = f"프린터 오류 {data['print_error']}"

        client = mqtt.Client()
        client.username_pw_set("bblp", self.access_code)
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)
        client.on_message = on_message

        try:
            client.connect(self.host or self.resolve(), 8883, keepalive=60)
        except Exception as e:  # noqa: BLE001
            yield Progress(None, "", failed=f"프린터에 연결하지 못했습니다 — {e}")
            return

        client.subscribe(f"device/{self.serial}/report")
        client.loop_start()

        client.publish(
            f"device/{self.serial}/request",
            __import__("json").dumps(
                {
                    "print": {
                        "sequence_id": str(int(time.time())),
                        "command": "project_file",
                        "param": "Metadata/plate_1.gcode",
                        "url": f"file:///sdcard/{remote}",
                        "timelapse": False,
                        "bed_leveling": True,
                        "use_ams": False,
                    }
                }
            ),
        )

        try:
            last = 0.0
            while not state["done"] and not state["failed"]:
                time.sleep(1)
                if time.time() - last >= REPORT_EVERY:
                    last = time.time()
                    yield Progress(state["percent"], "출력 중")
            if state["failed"]:
                yield Progress(state["percent"], "", failed=state["failed"])
            else:
                yield Progress(100, "출력 완료", done=True)
        finally:
            client.loop_stop()
            try:
                client.disconnect()
            except OSError:
                pass


def build(settings: dict, spool: Path) -> Printer:
    """
    설정에 적힌 대로 보내는 쪽을 고릅니다.

    ★ 기종을 안 적었으면 가짜입니다. 연결을 확인하는 동안의 기본값이고,
      실수로 진짜 프린터에 거는 일이 없습니다.
    """
    kind = (settings.get("printer_kind") or "mock").lower()
    if kind == "bambu":
        return BambuPrinter(
            access_code=settings.get("printer_code", ""),
            serial=settings.get("printer_serial", ""),
            # ★ 설정에 적는 값이 아니라 **지난번에 쓰던 주소**입니다.
            #   방송을 못 듣는 공유기에서만 쓰입니다.
            host=settings.get("printer_last_ip", ""),
        )
    return MockPrinter(spool)
