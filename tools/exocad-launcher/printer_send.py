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

#: 파일을 다 보낸 뒤 '잘 받았다' 인사를 몇 초까지 기다릴지 (2026-10-08).
#: 밤부는 안 돌려줍니다 — 그만큼 기다리다 그냥 끊습니다.
SHUTDOWN_WAIT = 3

# ---------- 기다림의 한계 (2026-10-08) ----------
#
# ★★ 전에는 **아무 시한이 없었습니다.** 소식이 끊기면 영원히 기다렸고,
#   그 PC 는 다음 작업도 안 집어갔습니다. 치과 와이파이가 1초 끊기면
#   그날 출력이 거기서 끝나는 구조였습니다.

#: 명령을 보낸 뒤 **우리 파일이** 돌기 시작하는 것을 이만큼 기다립니다.
#: 안 바뀌면 프린터가 명령을 안 받은 것입니다.
CONFIRM_SECONDS = 90

#: 프린터가 아무 말도 안 하는 시간. 이쯤이면 통로가 끊긴 것입니다.
#: (우리가 30초마다 상태를 물으니 조용한 것은 조용한 것입니다)
SILENT_SECONDS = 180

#: 소식은 오는데 층·진행률이 안 움직이는 시간.
#: ★ 첫 층이 6분 걸립니다 — 그동안 층수도 진행률도 안 움직입니다.
#:   짧게 잡으면 정상 출력을 실패로 끊습니다.
STALL_SECONDS = 20 * 60

#: 상태를 물어보는 주기. 조용함을 '정말 조용함' 으로 만들어 줍니다
ASK_EVERY = 30

#: SD 카드에 남겨 둘 파일 수 (2026-10-08).
#: ★ 전에는 **한 번도 안 지웠습니다.** 한 건에 1MB 씩 쌓이다 카드가 차면
#:   출력이 '취소' 로 떨어집니다 — 왜 그런지 알아내기 가장 어려운 자리입니다.
KEEP_FILES = 20

#: 올릴 파일을 백신이 쥐고 있을 때 다시 해 보는 횟수 (2026-10-08)
OPEN_TRIES = 3


@dataclass
class Progress:
    """한 번의 알림. `percent` 가 None 이면 아직 숫자를 모릅니다"""

    percent: float | None
    note: str = ""
    done: bool = False
    failed: str | None = None
    #: 프린터가 **우리 파일을** 돌리기 시작한 것을 확인한 순간 (2026-10-08).
    #: 여기서부터만 '출력 중' 입니다 — 보낸 것과 도는 것은 다릅니다.
    started: bool = False


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
        yield Progress(0, "출력 시작", started=True)

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

    def storbinary(self, cmd, fp, blocksize=8192, callback=None, rest=None):
        """
        파일을 보냅니다. 파이썬 기본 것을 쓰지 않습니다.

        ★★ 실물 A1 mini 에서 처음 걸린 자리입니다 (2026-10-08).
          파이썬 FTP_TLS 는 보내고 나서 데이터 통로의 TLS 를 **곱게**
          닫습니다(`conn.unwrap()` — 서로 '끝' 인사를 주고받음). 밤부
          펌웨어는 그 인사를 돌려주지 않아, 1MB 를 다 보낸 뒤 거기서
          멈춰 서 있다가 시간이 끝났습니다.
          **파일은 이미 다 간 뒤**라 더 할 일이 없습니다 — 인사를 기다리지
          않고 그냥 끊습니다.

        ★ 가짜 프린터(mock_bambu)는 규격대로 답했기 때문에 여기까지
          오지 못했습니다. 실물로 한 번 보내 봐야 알 수 있는 종류입니다.

        ★★ 그렇다고 인사를 **아예 안 하면** 규격대로 구는 쪽(가짜
          프린터)이 '226 다 받았다' 를 안 보내고 끊습니다. 그래서
          **짧게만 기다립니다** — 돌려주면 곱게 닫고, 안 돌려주면
          3초 뒤 그냥 끊습니다. 파일은 어느 쪽이든 이미 다 갔습니다.
        """
        self.voidcmd("TYPE I")
        conn = self.transfercmd(cmd, rest)
        try:
            while True:
                buf = fp.read(blocksize)
                if not buf:
                    break
                conn.sendall(buf)
                if callback:
                    callback(buf)
        finally:
            try:
                conn.settimeout(SHUTDOWN_WAIT)
                conn.unwrap()
            except (OSError, ValueError, ssl.SSLError):
                pass  # 밤부는 여기서 아무 말도 안 합니다
            try:
                conn.close()
            except OSError:
                pass
        return self.voidresp()


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
            except (*ftplib.all_errors, OSError):
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

    @staticmethod
    def safe_name(name: str) -> str:
        """
        프린터에 올릴 이름 — **영문·숫자만** 남깁니다.

        ★ 프린터 SD 카드와 펌웨어가 한글 이름을 어떻게 다루는지 믿을 수
          없습니다. 올라가고도 출력 명령에서 못 찾으면 "보냈는데 안 뽑힘"
          이 되고, 그 자리는 가장 알아내기 어렵습니다.
        ★ 실제 흐름에서는 주문 id(ASCII)로 이름이 붙지만, 사람이 손으로
          보낼 때를 대비해 여기서도 한 번 거릅니다.
        """
        safe = "".join(
            c if (c.isascii() and (c.isalnum() or c in "._-")) else "_" for c in name
        )
        # ★ 이름이 통째로 한글이면 확장자만 남습니다 — 그때는 이름을 지어 줍니다
        head, dot, tail = safe.rpartition(".")
        if not head.strip("_"):
            head = "print"
        return f"{head.strip('_')}{dot}{tail}" if dot else head.strip("_")

    def _open(self, path: Path):
        """
        파일을 엽니다. 안 열리면 몇 번 더 해 봅니다.

        ★★ 백신이 **방금 내려받은 파일을 검사하는 동안** 쥐고 있습니다
          (2026-10-08). 그 순간에 열면 거부당하고, 전에는 그 건이 그대로
          실패였습니다. 검사는 1~2초면 끝나니 기다려 보면 됩니다.
        """
        last: Exception | None = None

        for attempt in range(OPEN_TRIES):
            try:
                return open(path, "rb")
            except OSError as e:  # PermissionError 도 여기 듭니다
                last = e
                time.sleep(1 + attempt)

        raise OSError(f"파일을 열지 못했습니다 (백신이 쥐고 있을 수 있습니다) — {last}")

    def upload(self, path: Path) -> str:
        ftp = self._ftp(self.resolve())
        try:
            remote = f"{REMOTE_DIR}{self.safe_name(path.name)}"
            with self._open(path) as f:
                ftp.storbinary(f"STOR {remote}", f)
            return remote
        finally:
            try:
                ftp.quit()
            except (*ftplib.all_errors, OSError):
                pass

    # --- 프린터가 지금 무엇을 하고 있나 (MQTT 8883) ---

    #: 지금 뽑는 중이라 새 작업을 받을 수 없는 상태
    BUSY_STATES = ("RUNNING", "PAUSE", "PREPARE", "SLICING")

    def _mqtt(self):
        """보고를 듣는 통로. 끊기면 **다시 구독**합니다"""
        import json  # noqa: PLC0415
        import paho.mqtt.client as mqtt  # noqa: PLC0415

        topic = f"device/{self.serial}/report"
        ask = json.dumps({"pushing": {"sequence_id": "1", "command": "pushall"}})

        def on_connect(c, _u, _f, _rc) -> None:
            """
            ★★ 전에는 붙은 **다음에 한 번** 구독했습니다 (2026-10-08 고침).
              통로가 끊기면 paho 가 알아서 다시 붙는데, 구독은 안 돌아옵니다.
              그 뒤로는 아무 소식도 안 와서 영원히 기다렸습니다.
              여기(붙을 때마다 불리는 자리)에 두면 다시 붙어도 되살아납니다.
            """
            c.subscribe(topic)
            c.publish(f"device/{self.serial}/request", ask)

        client = mqtt.Client()
        client.username_pw_set("bblp", self.access_code)
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)
        client.on_connect = on_connect
        return client

    def status(self, seconds: float = 8.0) -> dict:
        """프린터가 말하는 지금 상태. 못 들으면 빈 칸입니다"""
        seen: dict = {}

        def on_message(_c, _u, msg) -> None:
            import json  # noqa: PLC0415

            try:
                data = json.loads(msg.payload.decode("utf-8", "replace")).get("print", {})
            except (ValueError, AttributeError):
                return
            if data:
                seen.update(data)

        client = self._mqtt()
        client.on_message = on_message
        client.connect(self.host or self.resolve(), 8883, keepalive=60)
        client.loop_start()
        try:
            time.sleep(seconds)
        finally:
            client.loop_stop()
            try:
                client.disconnect()
            except OSError:
                pass
        return seen

    @staticmethod
    def target_temps(path: Path) -> tuple[int, int] | None:
        """
        자른 파일에서 **첫 층 목표 온도**를 꺼냅니다 → (베드, 노즐).

        ★ 판 종류에 따라 베드 온도가 **다른 칸**에 적힙니다. 'Cool Plate' 면
          35도, 텍스처 PEI 면 55도 — 엉뚱한 칸을 읽으면 20도를 틀립니다.
        ★ 못 읽으면 None 입니다. 모르면서 아무 온도나 올리지 않습니다.
        """
        import json  # noqa: PLC0415
        import zipfile  # noqa: PLC0415

        bed_of = {
            "Textured PEI Plate": "textured_plate_temp_initial_layer",
            "Cool Plate": "cool_plate_temp_initial_layer",
            "Supertack Plate": "supertack_plate_temp_initial_layer",
            "Engineering Plate": "eng_plate_temp_initial_layer",
            "High Temp Plate": "hot_plate_temp_initial_layer",
        }

        def one(v) -> int:
            return int(float(v[0] if isinstance(v, list) else v))

        try:
            with zipfile.ZipFile(path) as z:
                cfg = json.loads(z.read("Metadata/project_settings.config"))
            bed = one(cfg[bed_of[cfg["curr_bed_type"]]])
            nozzle = one(cfg["nozzle_temperature_initial_layer"])
        except (OSError, KeyError, ValueError, IndexError, zipfile.BadZipFile):
            return None

        # 말이 되는 값인지 봅니다 — 잘못 읽은 값으로 노즐을 지지면 안 됩니다
        if not (0 <= bed <= 120) or not (150 <= nozzle <= 300):
            return None
        return bed, nozzle

    def warm(self, client, bed: int, nozzle: int) -> None:
        """
        **베드만** 미리 데우라고 한 줄 보냅니다 (2026-10-10).

        ★★ 왜 — 출력 명령을 받고서야 데우기 시작합니다. 시작부터 첫 층까지
          3분이 걸리는데 그 대부분이 예열입니다(판 고르기는 아니었습니다 —
          끄고 재 봤더니 초 단위까지 같았습니다).
          우리는 작업을 집어든 순간부터 곧 뽑을 것을 압니다. 파일을 올리는
          동안 데우면 그만큼 벌 수 있습니다.

        ★★ **노즐은 건드리지 않습니다** — 데웠다가 오히려 2분을 잃었습니다
          (실측). A1 mini 는 시작할 때 노즐을 **일부러 식힙니다**:
              M104 S170 ; set temp down to heatbed acceptable
              M109 S170   ← 170도까지 **내려가기를 기다림**
              M104 S140   ← 닦으려고 더 식힘
          215도로 올려 두면 거기서 내려올 때까지 기다리는데, 식는 것은
          데우는 것보다 훨씬 느립니다. 노즐 인자는 받아 두되 **안 씁니다** —
          다른 기종이 오면 그때 그 기종의 시작 코드를 보고 정합니다.

        ★ 이것은 무시당한 bed_leveling 과 **다른 통로**입니다 — 임의의 G코드를
          보내는 길(gcode_line)이라 펌웨어가 그대로 실행합니다.
        """
        import json  # noqa: PLC0415

        client.publish(
            f"device/{self.serial}/request",
            json.dumps(
                {
                    "print": {
                        "sequence_id": str(int(time.time())),
                        "command": "gcode_line",
                        "param": f"M140 S{bed}\n",
                    }
                }
            ),
        )

    def cool(self, client) -> None:
        """
        데워 놓고 안 뽑게 됐을 때 식힙니다.

        ★ 안 식히면 **노즐이 215도로 혼자 서 있습니다.** 필라멘트가 녹아
          흘러 다음 출력 첫 층을 망치고, 사람이 없는 밤이면 계속 그렇습니다.
        """
        import json  # noqa: PLC0415

        try:
            client.publish(
                f"device/{self.serial}/request",
                json.dumps(
                    {
                        "print": {
                            "sequence_id": str(int(time.time())),
                            "command": "gcode_line",
                            #: 노즐은 애초에 안 데웠습니다 (warm 참고)
                            "param": "M140 S0\n",
                        }
                    }
                ),
            )
            time.sleep(1)  # 보내고 바로 끊으면 안 나갑니다
        except OSError:
            pass

    @staticmethod
    def _is_mine(state: dict, remote: str) -> bool:
        """
        프린터가 지금 **우리가 보낸 파일**을 뽑고 있는가.

        ★★ 이것이 "안 뽑혔는데 뽑혔다고 하는 일" 을 막는 자리입니다
          (2026-10-08). 프린터는 지금 뽑는 파일 이름을 알려 줍니다 —
          실물에서 확인했습니다(subtask_name = 우리가 올린 이름).
          전에는 진행률 숫자 하나만 봤기 때문에, 누가 밤부 스튜디오로
          딴 것을 뽑고 있으면 **그 작업이 끝날 때 우리 것이 완료로**
          찍혔습니다.
        ★ 펌웨어마다 적는 칸이 다릅니다 — 아는 자리를 다 봅니다.
          확장자는 떼고 견줍니다(.gcode.3mf / .3mf / 경로가 붙기도 합니다).
        """
        want = remote.rsplit("/", 1)[-1].split(".")[0].lower()
        if not want:
            return False

        for key in ("subtask_name", "gcode_file", "task_name"):
            got = (state.get(key) or "").rsplit("/", 1)[-1].lower()
            if got and want in got:
                return True
        return False

    def send(self, path: Path, level: bool = True) -> Iterator[Progress]:
        """
        파일을 보내고 출력을 건 뒤, **우리 것이 돌고 있는 동안만** 지켜봅니다.

        나가는 길목마다 시한이 있습니다 — 조용히 영원히 기다리지 않습니다.

        ★★ `level` 은 **A1 mini 에서 듣지 않습니다** (실측 2026-10-10).
          판 고르기·토출 보정을 끄려고 거짓으로 보내 봤는데, 시작부터 첫 층까지
          **3분 01초로 초 단위까지 같았고**(켬/끔 두 번), 판 앞 턱의 그 한 줄도
          그대로 그어졌습니다. LAN 명령의 이 항목을 펌웨어가 무시합니다.

        ★ 그래서 **항상 켜 둡니다.** 끄는 길만 남겨 두면, 나중에 펌웨어가
          말을 듣기 시작하는 날 아무도 모르게 판 고르기가 빠집니다 —
          버는 것 없이 위험만 남습니다. 다음 사람이 이 길을 다시 파지 않도록
          측정값을 여기 적어 둡니다.

        ★ 그 3분은 **예열·호밍·노즐 닦기**입니다. 끌 수 있는 것이 아닙니다.
          줄이려면 한 판에 여러 개를 올려 그 3분을 나눠 쓰는 수밖에 없습니다.
        """
        try:
            import paho.mqtt.client as mqtt  # noqa: F401, PLC0415
        except ImportError:
            yield Progress(None, "", failed="paho-mqtt 가 없습니다 (pip install paho-mqtt)")
            return

        import json  # noqa: PLC0415

        # ---------- 0) 프린터가 비었는지 먼저 봅니다 ----------
        #
        # ★ 뽑는 중에 보내면 프린터는 우리 명령을 **그냥 무시**합니다.
        #   베드도 안 비어 있을 테니 보내면 안 되는 것이 맞습니다.
        try:
            before = self.status(6.0)
        except Exception as e:  # noqa: BLE001
            yield Progress(None, "", failed=f"프린터에 닿지 못했습니다 — {e}")
            return

        stage = before.get("gcode_state") or ""

        if stage in self.BUSY_STATES:
            now = (before.get("subtask_name") or "다른 작업").rsplit("/", 1)[-1]
            yield Progress(
                None,
                "",
                failed=f"프린터가 지금 다른 것을 뽑고 있습니다 ({now}) — 끝난 뒤 다시 걸어 주세요",
            )
            return

        # ---------- 1) 데우면서 올립니다 ----------
        #
        # ★ 올리기 **전에** 자리를 치웁니다. 끝난 뒤에만 치우면, 취소·실패한
        #   건들이 그대로 쌓입니다 — 카드가 차면 출력이 '취소' 로 떨어지고
        #   까닭이 어디에도 안 적힙니다.
        try:
            self.tidy()
        except Exception:  # noqa: BLE001 — 못 치워도 보내는 것이 먼저입니다
            pass

        # ★★ 올리는 동안 미리 데웁니다 (2026-10-10). 실패하면 아래에서 식힙니다.
        warmed = None
        heater = None
        temps = self.target_temps(path)

        if temps:
            try:
                heater = self._mqtt()
                heater.connect(self.host or self.resolve(), 8883, keepalive=60)
                heater.loop_start()
                time.sleep(1)  # 붙을 틈
                self.warm(heater, *temps)
                warmed = temps
                yield Progress(None, f"베드를 미리 데웁니다 ({temps[0]}°)")
            except Exception:  # noqa: BLE001 — 못 데워도 출력은 됩니다
                heater = None

        def give_up(why: str) -> Progress:
            """데워 놓고 못 뽑게 됐으면 식히고 나갑니다"""
            if heater is not None:
                if warmed:
                    self.cool(heater)
                heater.loop_stop()
                try:
                    heater.disconnect()
                except OSError:
                    pass
            return Progress(None, "", failed=why)

        try:
            remote = self.upload(path)
        except Exception as e:  # noqa: BLE001 — 까닭을 그대로 올려야 합니다
            yield give_up(f"프린터에 올리지 못했습니다 — {e}")
            return

        yield Progress(None, f"보냈습니다 ({remote})")

        # ---------- 2) 출력 명령 ----------
        state: dict = {}
        heard: dict = {"at": time.time()}

        def on_message(_c, _u, msg) -> None:
            try:
                data = json.loads(msg.payload.decode("utf-8", "replace")).get("print", {})
            except (ValueError, AttributeError):
                return
            if data:
                state.update(data)
                heard["at"] = time.time()

        client = self._mqtt()
        client.on_message = on_message

        try:
            client.connect(self.host or self.resolve(), 8883, keepalive=60)
        except Exception as e:  # noqa: BLE001
            yield give_up(f"프린터에 연결하지 못했습니다 — {e}")
            return

        client.loop_start()

        # 예열용 연결은 할 일을 마쳤습니다 (온도는 프린터가 들고 있습니다)
        if heater is not None:
            heater.loop_stop()
            try:
                heater.disconnect()
            except OSError:
                pass
            heater = None

        client.publish(
            f"device/{self.serial}/request",
            json.dumps(
                {
                    "print": {
                        "sequence_id": str(int(time.time())),
                        "command": "project_file",
                        "param": "Metadata/plate_1.gcode",
                        "url": f"file:///sdcard/{remote}",
                        "timelapse": False,
                        #: ★ 둘 다 A1 mini 가 무시합니다 (위 설명). 그래도 적어
                        #:   보냅니다 — 다른 기종이 오면 그쪽은 들을 수 있습니다
                        "bed_leveling": level,
                        "flow_cali": level,
                        "use_ams": False,
                    }
                }
            ),
        )

        # ---------- 3) 지켜봅니다 ----------
        began = time.time()
        mine = False  # 우리 것이 돌기 시작한 것을 **본** 적이 있는가
        moved = time.time()  # 층·진행률이 마지막으로 움직인 때
        mark: tuple = ()
        told = 0.0
        asked = time.time()
        out: Progress | None = None

        try:
            while out is None:
                time.sleep(1)
                now = time.time()
                stage = state.get("gcode_state") or ""
                here = self._is_mine(state, remote)

                # 조용함 — 통로가 끊긴 것입니다
                if now - heard["at"] > SILENT_SECONDS:
                    out = Progress(
                        state.get("mc_percent"),
                        "",
                        failed="프린터 소식이 끊겼습니다 — 전원과 와이파이를 봐 주세요",
                    )
                    break

                # 우리 것이 돌기 시작했나
                if not mine:
                    if here and stage == "RUNNING":
                        mine = True
                        moved = now
                        layers = state.get("total_layer_num")
                        tail = f" · {layers}층" if layers else ""
                        yield Progress(
                            state.get("mc_percent") or 0, f"출력 시작{tail}", started=True
                        )
                    elif now - began > CONFIRM_SECONDS:
                        # ★ 보냈는데 안 뽑히는 자리. 전에는 여기서 남의 작업을
                        #   지켜보다 그것이 끝나면 우리 것을 완료로 찍었습니다.
                        out = Progress(
                            None,
                            "",
                            failed="프린터가 출력 명령을 받지 않았습니다 "
                            f"(지금 상태 {stage or '알 수 없음'}) — 프린터 화면을 봐 주세요",
                        )
                    # ★ 아직 우리 것이 아니면 '끝났다' 는 말을 **믿지 않습니다**
                    if out is not None:
                        break
                    continue

                # 여기부터는 우리 것입니다
                if state.get("print_error"):
                    out = Progress(
                        state.get("mc_percent"), "", failed=f"프린터 오류 {state['print_error']}"
                    )
                    break
                if stage == "PAUSE":
                    out = Progress(
                        state.get("mc_percent"),
                        "",
                        failed="프린터가 멈춰 섰습니다 (일시정지) — 필라멘트와 화면을 봐 주세요",
                    )
                    break
                if stage == "FAILED":
                    out = Progress(state.get("mc_percent"), "", failed="프린터가 실패를 알렸습니다")
                    break
                if stage == "FINISH":
                    out = Progress(100, "출력 완료", done=True)
                    break

                # 움직이고 있나 (층수가 더 믿을 만합니다)
                beat = (state.get("layer_num"), state.get("mc_percent"))
                if beat != mark:
                    mark, moved = beat, now
                elif now - moved > STALL_SECONDS:
                    out = Progress(
                        state.get("mc_percent"),
                        "",
                        failed="출력이 멈춰 있습니다 — 프린터를 봐 주세요",
                    )
                    break

                # 숨 쉬는 소리를 받으려고 가끔 물어봅니다
                if now - asked >= ASK_EVERY:
                    asked = now
                    client.publish(
                        f"device/{self.serial}/request",
                        json.dumps({"pushing": {"sequence_id": "2", "command": "pushall"}}),
                    )

                if now - told >= REPORT_EVERY:
                    told = now
                    layer = state.get("layer_num")
                    total = state.get("total_layer_num")
                    note = f"출력 중 {layer}/{total}층" if layer and total else "출력 중"
                    yield Progress(state.get("mc_percent"), note)
        finally:
            client.loop_stop()
            try:
                client.disconnect()
            except OSError:
                pass

        # ---------- 4) 끝났으면 SD 카드를 치웁니다 ----------
        if out is not None and out.done:
            try:
                self.tidy(remote)
            except Exception:  # noqa: BLE001 — 치우다 실패해도 출력은 성공입니다
                pass

        yield out

    # --- SD 카드 치우기 ---

    def tidy(self, printed: str = "", keep: int = KEEP_FILES) -> int:
        """
        뽑은 파일을 지우고, 오래된 것도 몇 개만 남깁니다. 지운 수를 돌려줍니다.

        ★★ 전에는 **한 번도 안 지웠습니다** (2026-10-08). 한 건에 1MB 씩
          쌓이다 카드가 차면 출력이 '취소' 로 떨어집니다 — 그 증상으로
          한참 헤맨 사람들이 있습니다. 까닭이 안 적히는 자리입니다.
        ★ 우리가 올린 것만 건드립니다. 사람이 USB 로 넣어 둔 것을 지우면
          안 됩니다 — 그래서 `.gcode.3mf` 로 끝나는 것만 봅니다.
        """
        ftp = self._ftp(self.resolve())
        gone = 0
        try:
            if printed:
                try:
                    ftp.delete(printed)
                    gone += 1
                except (*ftplib.all_errors, OSError):
                    pass

            # 남은 것 중 오래된 것부터 (시각을 모르면 건드리지 않습니다)
            #
            # ★ 실물 A1 mini 는 MLSD 를 모릅니다 — 502 로 거절합니다
            #   (2026-10-08 확인). 그때는 이름을 받아 **하나씩 MDTM** 으로
            #   시각을 묻습니다. 그쪽은 받아 줍니다(213 20261008130002).
            rows: list[tuple[str, str]] = []

            try:
                rows = [
                    (facts.get("modify", ""), name)
                    for name, facts in ftp.mlsd()
                    if name.lower().endswith(".gcode.3mf")
                ]
            except (*ftplib.all_errors, OSError, AttributeError):
                try:
                    for name in ftp.nlst():
                        if not name.lower().endswith(".gcode.3mf"):
                            continue
                        try:
                            when = ftp.sendcmd(f"MDTM {name}").split()[-1]
                        except (*ftplib.all_errors, OSError, IndexError):
                            when = ""
                        rows.append((when, name))
                except (*ftplib.all_errors, OSError):
                    return gone

            rows = [r for r in rows if r[0]]
            rows.sort()

            for _when, name in rows[: max(0, len(rows) - keep)]:
                try:
                    ftp.delete(name)
                    gone += 1
                except (*ftplib.all_errors, OSError):
                    pass
        finally:
            try:
                ftp.quit()
            except (*ftplib.all_errors, OSError):
                pass
        return gone


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
