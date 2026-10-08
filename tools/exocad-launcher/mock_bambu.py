# -*- coding: utf-8 -*-
"""
프린터인 척하는 프로그램 — **진짜 프로토콜로** 대답합니다 (2026-10-07).

    python mock_bambu.py

★★ 왜 만드는가 — `MockPrinter` 는 파일을 폴더에 복사할 뿐이라, 정작
  프린터와 말하는 코드(`printer_send.BambuPrinter`)가 **한 줄도 안 돕니다.**
  기종이 오는 날 그 코드가 처음 돌게 됩니다. 이 프로그램을 띄워 두면
  **그 코드가 지금 실제로 돕니다** — 설정에서 printer_kind 를 bambu 로
  두기만 하면 됩니다.

세 가지로 대답합니다:
    SSDP  239.255.255.250  "나 여기 있다, 시리얼 …"   → 「프린터 찾기」
    FTPS  990 (암묵적 TLS)  파일 받기                   → 올리기
    MQTT  8883 (TLS)        출력 명령 받고 진행률 흘리기 → 출력·진행률

★ **잡히는 것** — 암묵적 FTPS 래핑, 옛 암호(SECLEVEL), 파일이 끝까지
  올라가는지, MQTT 토픽 모양, 진행률 파싱(mc_percent·gcode_state),
  방송 듣기와 시리얼 대조.
★ **못 잡는 것** — 실제 펌웨어가 우리 명령을 *받아주는지*. 여기 대답은
  제가 짐작한 모양입니다. 거기서 틀리면 헤더 한 줄 고치는 일입니다.

★ 인증서는 첫 실행 때 스스로 만듭니다(자체 서명). 저장소에 넣지 않습니다.
"""

from __future__ import annotations

import argparse
import os
import socket
import ssl
import struct
import subprocess
import tempfile
import threading
import time
from pathlib import Path

GROUP = "239.255.255.250"
SSDP_PORTS = (2021, 1990)
FTPS_PORT = 990
MQTT_PORT = 8883

#: 출력이 이만큼 걸리는 척합니다 (초). 기다리려는 게 아니라 흐름을 보려는 것
FAKE_PRINT_SECONDS = 12.0

HERE = Path(__file__).resolve().parent
CERT_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / "DenFlow" / "mock"


def say(*a) -> None:
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


# ---------------------------------------------------------------- 인증서


def make_cert() -> tuple[Path, Path]:
    """
    자체 서명 인증서. 프린터도 자체 서명이라 모양이 같습니다.

    ★ 저장소에 넣지 않고 첫 실행 때 만듭니다 — 시험용 열쇠라도
      소스에 들어가면 언젠가 진짜처럼 쓰입니다.
    """
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    crt, key = CERT_DIR / "mock.crt", CERT_DIR / "mock.key"
    if crt.exists() and key.exists():
        return crt, key

    subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", str(key), "-out", str(crt), "-days", "3650",
            "-subj", "/CN=mock-bambu",
        ],
        check=True,
        capture_output=True,
    )
    say("인증서를 만들었습니다:", crt)
    return crt, key


def server_ctx() -> ssl.SSLContext:
    crt, key = make_cert()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(crt), str(key))
    # ★ 프린터 펌웨어가 옛 암호를 씁니다. 손님(우리 코드)이 SECLEVEL=1 로
    #   내려오므로 여기도 받아 줘야 손이 맞습니다.
    try:
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")
    except ssl.SSLError:
        pass
    return ctx


# ---------------------------------------------------------------- SSDP


class Beacon(threading.Thread):
    """1초마다 '나 여기 있다' 를 뿌립니다"""

    daemon = True

    def __init__(self, serial: str, ip: str, model: str, name: str) -> None:
        super().__init__()
        self.serial, self.ip, self.model, self.name = serial, ip, model, name
        self.stop = threading.Event()

    def packet(self) -> bytes:
        return (
            "NOTIFY * HTTP/1.1\r\n"
            f"HOST: {GROUP}:2021\r\n"
            "NT: urn:bambulab-com:device:3dprinter:1\r\n"
            "NTS: ssdp:alive\r\n"
            f"USN: {self.serial}\r\n"
            f"Location: {self.ip}\r\n"
            f"DevModel.bambu.com: {self.model}\r\n"
            f"DevName.bambu.com: {self.name}\r\n"
            "DevSignal.bambu.com: -40\r\n"
            "DevConnect.bambu.com: lan\r\n"
            "\r\n"
        ).encode("utf-8")

    def run(self) -> None:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
        say(f"SSDP 방송 시작 — {self.serial} @ {self.ip}")
        while not self.stop.is_set():
            for port in SSDP_PORTS:
                try:
                    s.sendto(self.packet(), (GROUP, port))
                except OSError:
                    pass
            self.stop.wait(1.0)
        s.close()


# ---------------------------------------------------------------- FTPS


class FtpsServer(threading.Thread):
    """
    암묵적 FTPS. **붙는 순간** TLS 입니다 (AUTH TLS 를 기다리지 않습니다).

    ★ 손님이 ftplib 이라 꼭 필요한 명령만 받습니다 —
      USER · PASS · PBSZ · PROT · TYPE · PASV · STOR · NLST · QUIT.
    """

    daemon = True

    def __init__(self, inbox: Path, code: str, on_file=None) -> None:
        super().__init__()
        self.inbox = inbox
        self.code = code
        self.on_file = on_file
        self.ctx = server_ctx()
        self.stop = threading.Event()

    def run(self) -> None:
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("0.0.0.0", FTPS_PORT))
        srv.listen(5)
        srv.settimeout(0.5)
        say(f"FTPS 열림 — {FTPS_PORT} (암묵적 TLS)")

        while not self.stop.is_set():
            try:
                raw, addr = srv.accept()
            except (TimeoutError, OSError):
                continue
            threading.Thread(target=self._talk, args=(raw, addr), daemon=True).start()
        srv.close()

    # --- 한 손님 ---

    def _talk(self, raw: socket.socket, addr) -> None:
        try:
            conn = self.ctx.wrap_socket(raw, server_side=True)
        except ssl.SSLError as e:
            say("FTPS 악수 실패:", e)
            raw.close()
            return

        send = lambda line: conn.sendall((line + "\r\n").encode("utf-8"))  # noqa: E731
        send("220 mock-bambu ready")

        data_sock: socket.socket | None = None
        prot_private = False
        rest = b""

        try:
            while True:
                while b"\r\n" not in rest:
                    chunk = conn.recv(4096)
                    if not chunk:
                        return
                    rest += chunk
                line, rest = rest.split(b"\r\n", 1)
                cmd = line.decode("utf-8", "replace").strip()
                verb = cmd.split(" ")[0].upper()
                arg = cmd[len(verb):].strip()

                if verb == "USER":
                    send("331 need password")
                elif verb == "PASS":
                    if arg != self.code:
                        # ★ 코드가 틀리면 **거절합니다.** 이걸 받아 주면
                        #   「프린터 찾기」의 '코드가 틀립니다' 가 영영 안 나옵니다.
                        say(f"접속 코드 틀림: {arg!r}")
                        send("530 wrong access code")
                        return
                    send("230 logged in")
                elif verb in ("PBSZ", "OPTS", "NOOP"):
                    send("200 ok")
                elif verb == "PROT":
                    prot_private = arg.upper() == "P"
                    send("200 ok")
                elif verb == "TYPE":
                    send("200 ok")
                elif verb == "SYST":
                    send("215 UNIX Type: L8")
                elif verb == "FEAT":
                    send("211-Features:\r\n PASV\r\n PBSZ\r\n PROT\r\n211 End")
                elif verb == "PWD":
                    send('257 "/"')
                elif verb == "CWD":
                    send("250 ok")
                elif verb == "PASV":
                    data_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    data_sock.bind(("0.0.0.0", 0))
                    data_sock.listen(1)
                    port = data_sock.getsockname()[1]
                    ip = conn.getsockname()[0].replace(".", ",")
                    send(f"227 Entering Passive Mode ({ip},{port >> 8},{port & 255})")
                elif verb in ("STOR", "NLST", "LIST"):
                    if data_sock is None:
                        send("425 use PASV first")
                        continue
                    send("150 ok")
                    peer, _ = data_sock.accept()
                    if prot_private:
                        peer = self.ctx.wrap_socket(peer, server_side=True)

                    if verb == "STOR":
                        name = Path(arg).name or "print.3mf"
                        out = self.inbox / name
                        got = 0
                        with open(out, "wb") as f:
                            while True:
                                b = peer.recv(65536)
                                if not b:
                                    break
                                f.write(b)
                                got += len(b)
                        say(f"받음: {name} ({got:,} 바이트)")
                        if self.on_file:
                            self.on_file(name, got)
                    else:
                        names = "\r\n".join(p.name for p in self.inbox.glob("*"))
                        peer.sendall((names + "\r\n").encode("utf-8"))

                    try:
                        peer.unwrap()
                    except (OSError, ssl.SSLError):
                        pass
                    peer.close()
                    data_sock.close()
                    data_sock = None
                    send("226 done")
                elif verb == "QUIT":
                    send("221 bye")
                    return
                else:
                    send("502 not supported")
        except (OSError, ssl.SSLError):
            pass
        finally:
            try:
                conn.close()
            except OSError:
                pass


# ---------------------------------------------------------------- MQTT


def _varint(n: int) -> bytes:
    out = b""
    while True:
        b = n % 128
        n //= 128
        out += bytes([b | (0x80 if n else 0)])
        if not n:
            return out


def _read_varint(sock) -> int:
    n, mult = 0, 1
    while True:
        b = sock.recv(1)
        if not b:
            raise ConnectionError
        n += (b[0] & 127) * mult
        if not b[0] & 0x80:
            return n
        mult *= 128


def _publish(topic: str, payload: bytes) -> bytes:
    body = struct.pack(">H", len(topic)) + topic.encode() + payload
    return bytes([0x30]) + _varint(len(body)) + body


class MqttServer(threading.Thread):
    """
    아주 작은 MQTT 중개. 우리 손님이 쓰는 것만 받습니다 —
    CONNECT · SUBSCRIBE · PUBLISH · PINGREQ · DISCONNECT (전부 QoS 0).
    """

    daemon = True

    def __init__(self, serial: str, seconds: float = FAKE_PRINT_SECONDS) -> None:
        super().__init__()
        self.serial = serial
        self.seconds = seconds
        self.ctx = server_ctx()
        self.stop = threading.Event()

    def run(self) -> None:
        srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("0.0.0.0", MQTT_PORT))
        srv.listen(5)
        srv.settimeout(0.5)
        say(f"MQTT 열림 — {MQTT_PORT} (TLS)")

        while not self.stop.is_set():
            try:
                raw, _ = srv.accept()
            except (TimeoutError, OSError):
                continue
            threading.Thread(target=self._talk, args=(raw,), daemon=True).start()
        srv.close()

    def _talk(self, raw: socket.socket) -> None:
        try:
            conn = self.ctx.wrap_socket(raw, server_side=True)
        except ssl.SSLError as e:
            say("MQTT 악수 실패:", e)
            raw.close()
            return

        printing = threading.Event()

        def progress(name: str = "") -> None:
            """
            출력하는 척하며 진행률을 흘립니다.

            ★★ **지금 뽑는 파일 이름을 같이 적습니다** (2026-10-08).
              실물 프린터가 그렇게 합니다(subtask_name). 보내는 쪽은 그
              이름으로 '내 것이 돌고 있는지' 를 가립니다 — 이름을 안 적으면
              가짜 프린터가 실물과 달라져, 여기서 통과한 코드가 현장에서
              "안 뽑혔는데 뽑혔다" 를 냅니다.
            """
            steps = 6
            for i in range(1, steps + 1):
                if printing.is_set():
                    return
                time.sleep(self.seconds / steps)
                pct = round(i * 100 / steps)
                body = (
                    '{"print":{"mc_percent":%d,"gcode_state":"%s","mc_remaining_time":%d,'
                    '"subtask_name":"%s","layer_num":%d,"total_layer_num":%d}}'
                    % (
                        pct,
                        "RUNNING" if i < steps else "FINISH",
                        steps - i,
                        name,
                        i,
                        steps,
                    )
                ).encode()
                try:
                    conn.sendall(_publish(f"device/{self.serial}/report", body))
                except OSError:
                    return
            say("출력 끝났다고 알렸습니다 (FINISH)")

        try:
            while True:
                head = conn.recv(1)
                if not head:
                    return
                kind = head[0] >> 4
                length = _read_varint(conn)
                body = b""
                while len(body) < length:
                    chunk = conn.recv(length - len(body))
                    if not chunk:
                        return
                    body += chunk

                if kind == 1:  # CONNECT
                    say("MQTT 손님이 붙었습니다")
                    conn.sendall(bytes([0x20, 0x02, 0x00, 0x00]))  # CONNACK ok
                elif kind == 8:  # SUBSCRIBE
                    pid = struct.unpack(">H", body[:2])[0]
                    tlen = struct.unpack(">H", body[2:4])[0]
                    topic = body[4:4 + tlen].decode("utf-8", "replace")
                    say("구독:", topic)
                    conn.sendall(bytes([0x90, 0x03]) + struct.pack(">H", pid) + bytes([0x00]))
                elif kind == 3:  # PUBLISH
                    tlen = struct.unpack(">H", body[:2])[0]
                    topic = body[2:2 + tlen].decode("utf-8", "replace")
                    payload = body[2 + tlen:].decode("utf-8", "replace")
                    say("명령 받음:", topic)
                    say("  ", payload[:160])
                    if "project_file" in payload:
                        # 명령에 적힌 파일 이름을 그대로 돌려줍니다
                        name = ""
                        if '"url"' in payload:
                            tail = payload.split('"url"', 1)[1]
                            if "sdcard/" in tail:
                                name = tail.split("sdcard/", 1)[1].split('"', 1)[0]
                        threading.Thread(
                            target=progress, args=(name,), daemon=True
                        ).start()
                elif kind == 12:  # PINGREQ
                    conn.sendall(bytes([0xD0, 0x00]))
                elif kind == 14:  # DISCONNECT
                    return
        except (OSError, ssl.SSLError, ConnectionError, struct.error):
            pass
        finally:
            printing.set()
            try:
                conn.close()
            except OSError:
                pass


# ---------------------------------------------------------------- 시작


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="프린터인 척하기 (Bambu LAN 모드)")
    ap.add_argument("--serial", default="01P00A000000001")
    ap.add_argument("--code", default="12345678")
    ap.add_argument("--ip", default="127.0.0.1", help="방송에 적을 주소")
    ap.add_argument("--model", default="C11")
    ap.add_argument("--name", default="모의 프린터")
    ap.add_argument("--inbox", type=Path, default=Path(tempfile.gettempdir()) / "mock-bambu")
    ap.add_argument("--seconds", type=float, default=FAKE_PRINT_SECONDS)
    args = ap.parse_args(argv)

    args.inbox.mkdir(parents=True, exist_ok=True)

    print()
    say("모의 프린터를 켭니다")
    say(f"  시리얼   {args.serial}")
    say(f"  접속코드 {args.code}")
    say(f"  받는 곳  {args.inbox}")
    print()

    parts = [
        Beacon(args.serial, args.ip, args.model, args.name),
        FtpsServer(args.inbox, args.code),
        MqttServer(args.serial, args.seconds),
    ]
    for p in parts:
        p.start()

    say("에이전트 설정에 이렇게 넣으세요:")
    say(f'  "printer_kind": "bambu", "printer_serial": "{args.serial}", '
        f'"printer_code": "{args.code}"')
    print()
    say("Ctrl+C 로 끕니다.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    for p in parts:
        p.stop.set()
    say("껐습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
