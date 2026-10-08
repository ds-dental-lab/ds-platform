# -*- coding: utf-8 -*-
"""
프린터를 **시리얼로** 찾습니다 (2026-10-06).

★ 왜 IP 를 설정에 적지 않는가 (사용자 물음 — "정전 같은걸로 IP가
  바뀌게 되버리면 어떻게하나?"):
  IP 는 공유기가 빌려주는 번호라 언젠가 바뀝니다. **시리얼은 안 바뀝니다.**
  그래서 설정에는 시리얼과 액세스 코드만 두고, 주소는 쓸 때마다 알아냅니다.
  치과가 공유기를 못 건드려도 되고, 프린터를 옮겨도 그대로 돕니다.

★ 어떻게 찾는가: 같은 랜에 있는 프린터는 자기 존재를 방송합니다(SSDP).
  그 방송을 듣고 시리얼이 맞는 것의 지금 주소를 꺼냅니다. 듣기만 해도
  되지만, 기다리는 시간을 줄이려고 **먼저 불러도 봅니다**(M-SEARCH).

★ 못 찾았을 때 **왜** 못 찾았는지까지 말합니다. 치과에서 "안 돼요" 대신
  문장 하나를 전해 주실 수 있어야 고칠 수 있습니다.

★ 아직 실물 프린터로 받아보지 못했습니다 (2026-10-06, 기종 미정).
  펌웨어마다 방송 모양이 조금씩 다를 수 있어 첫 현장에서 한 번 맞춰야
  합니다 — 그래서 헤더를 통째로 들고 다닙니다(raw).
"""

from __future__ import annotations

import os
import socket
import struct
import time
from dataclasses import dataclass, field
from pathlib import Path

#: 프린터가 방송하는 곳. 두 군데를 다 듣습니다 — 펌웨어마다 다릅니다
GROUP = "239.255.255.250"
PORTS = (2021, 1990)

#: 불러 보는 글. 대답이 오면 기다리지 않아도 됩니다
M_SEARCH = (
    "M-SEARCH * HTTP/1.1\r\n"
    f"HOST: {GROUP}:2021\r\n"
    'MAN: "ssdp:discover"\r\n'
    "MX: 1\r\n"
    "ST: urn:bambulab-com:device:3dprinter:1\r\n\r\n"
).encode("ascii")


@dataclass
class Found:
    serial: str
    ip: str
    model: str = ""
    name: str = ""
    #: 받은 헤더 그대로. 첫 현장에서 모양을 맞출 때 봅니다
    raw: dict[str, str] = field(default_factory=dict)


def _parse(data: bytes, addr: tuple[str, int]) -> Found | None:
    try:
        text = data.decode("utf-8", "replace")
    except Exception:  # noqa: BLE001
        return None

    head: dict[str, str] = {}
    for line in text.splitlines()[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            head[k.strip().lower()] = v.strip()

    # 시리얼이 어디 적혀 오는지는 펌웨어마다 다릅니다 — 아는 자리를 다 봅니다
    serial = (
        head.get("usn")
        or head.get("devid.bambu.com")
        or head.get("devserial.bambu.com")
        or ""
    ).strip()
    if not serial:
        return None

    # Location 이 'http://192.168.0.50' 모양일 수 있어 주소만 뽑습니다
    ip = addr[0]
    loc = head.get("location", "")
    if loc:
        bare = loc.split("//")[-1].split("/")[0].split(":")[0]
        if bare:
            ip = bare

    return Found(
        serial=serial,
        ip=ip,
        model=head.get("devmodel.bambu.com", ""),
        name=head.get("devname.bambu.com", ""),
        raw=head,
    )


#: 들은 것을 적어 두는 곳. 안 맞을 때 이 파일만 보내 주시면 됩니다
LOG = Path(os.environ.get("APPDATA", str(Path.home()))) / "DenFlow" / "프린터찾기.txt"


def _log(lines: list[str]) -> None:
    """
    ★ 실패해도 조용히 넘어갑니다. 기록을 못 남긴다고 찾기가 멈추면 안 됩니다.
    ★ 파일이 커지지 않게 **마지막 한 번치만** 남깁니다 — 여러 번 눌러도
      직전 것만 있으면 됩니다.
    """
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        LOG.write_text(f"[{stamp}]\n" + "\n".join(lines) + "\n", encoding="utf-8")
    except OSError:
        pass


def discover(seconds: float = 4.0) -> list[Found]:
    """
    랜에 있는 프린터들을 모읍니다.

    ★ 두 포트를 다 듣습니다. 멀티캐스트를 못 받는 공유기도 있어서
      실패해도 그냥 넘어갑니다 — 한 쪽만 들려도 됩니다.
    """
    socks: list[socket.socket] = []
    for port in PORTS:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("", port))
            s.setsockopt(
                socket.IPPROTO_IP,
                socket.IP_ADD_MEMBERSHIP,
                struct.pack("4sl", socket.inet_aton(GROUP), socket.INADDR_ANY),
            )
            s.settimeout(0.4)
            socks.append(s)
        except OSError:
            continue

    if not socks:
        return []

    # 먼저 불러 봅니다 — 대답이 오면 방송을 기다릴 것 없습니다
    try:
        out = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        out.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
        out.sendto(M_SEARCH, (GROUP, 2021))
        out.close()
    except OSError:
        pass

    seen: dict[str, Found] = {}
    until = time.time() + seconds
    while time.time() < until:
        for s in socks:
            try:
                data, addr = s.recvfrom(4096)
            except (TimeoutError, OSError):
                continue
            got = _parse(data, addr)
            if got:
                seen[got.serial] = got

    # ★ 닫기 전에 포트를 적어 둡니다 (닫은 소켓은 못 읽습니다)
    ports = []
    for s in socks:
        try:
            ports.append(s.getsockname()[1])
        except OSError:
            pass
        try:
            s.close()
        except OSError:
            pass

    got = list(seen.values())

    # ★ 들은 것을 그대로 남깁니다 — 실물에서 안 맞으면 이 파일을 봅니다
    note = [f"들은 수: {len(got)}", f"연 포트: {ports}"]
    for g in got:
        note.append(f"  {g.serial} @ {g.ip} · {g.model} · {g.name}")
        note += [f"      {k}: {v}" for k, v in sorted(g.raw.items())]
    if not got:
        note.append("  (아무 방송도 못 들었습니다)")
    _log(note)

    return got


def find(serial: str, seconds: float = 4.0) -> Found | None:
    """시리얼이 맞는 프린터 하나. 대소문자는 안 가립니다"""
    want = (serial or "").strip().lower()
    if not want:
        return None
    for got in discover(seconds):
        if got.serial.lower() == want or want in got.serial.lower():
            return got
    return None


# ---------------------------------------------------------------- 점검


@dataclass
class Check:
    ok: bool
    message: str
    ip: str = ""


def self_test(settings: dict, seconds: float = 4.0) -> Check:
    """
    「프린터 찾기」 버튼이 부르는 것.

    ★ **왜 안 되는지까지** 말합니다. "안 돼요" 로는 아무것도 못 고칩니다.
    """
    serial = (settings.get("printer_serial") or "").strip()
    code = (settings.get("printer_code") or "").strip()

    if not serial:
        return Check(False, "시리얼 번호를 넣어 주세요 (프린터 설정 화면에 있습니다)")
    if not code:
        return Check(False, "액세스 코드를 넣어 주세요 (LAN 모드를 켜면 화면에 뜹니다)")

    others = discover(seconds)

    if not others:
        """
        방송을 못 들었습니다.

        ★★ 치과에서 제일 흔할 까닭은 프린터가 아니라 **윈도우 방화벽**입니다
          (2026-10-08). 방송을 들으려면 포트를 열어야 하는데, 처음에 뜨는
          "Python 의 네트워크 접근을 허용할까요" 창에서 '취소' 를 누르면
          윈도우가 그 차단을 기억합니다 — 그 뒤로는 **묻지도 않고** 조용히
          막습니다. 사람은 프린터가 고장 난 줄 압니다.
        ★ 그래서 포기하기 전에 **지난번 주소로 직접** 가 봅니다. 들어가지면
          출력은 그대로 됩니다 — 막힌 것이 방송뿐임을 알려 줍니다.
        """
        last = (settings.get("printer_last_ip") or "").strip()

        if last:
            try:
                from printer_send import BambuPrinter  # noqa: PLC0415

                BambuPrinter(
                    host=last, access_code=code, serial=serial, timeout=8
                ).login_test()
                return Check(
                    True,
                    f"지난번 주소({last})로 들어갔습니다 — 다만 프린터 방송은 "
                    "못 듣고 있습니다. 윈도우 방화벽에서 이 프로그램의 네트워크를 "
                    "허용해 주세요. 공유기가 주소를 바꾸면 못 찾게 됩니다.",
                    ip=last,
                )
            except Exception:  # noqa: BLE001 — 지난번 주소도 아니면 아래로
                pass

        return Check(
            False,
            "아무 프린터도 못 찾았습니다 — 프린터가 켜져 있는지, "
            "이 PC 와 같은 와이파이인지 봐 주세요 (손님용 망이면 안 됩니다). "
            "윈도우 방화벽이 막고 있을 수도 있습니다 — 처음 뜬 허용 창에서 "
            "'취소' 를 눌렀다면 막혀 있습니다.",
        )

    mine = next((g for g in others if g.serial.lower() == serial.lower()), None)
    if not mine:
        names = ", ".join(sorted({g.serial for g in others})[:3])
        return Check(
            False,
            f"프린터는 찾았는데 시리얼이 다릅니다 — 찾은 것: {names}",
        )

    # 찾았으면 액세스 코드까지 봅니다 — 주소만 맞고 코드가 틀리면
    # 출력을 걸 때 가서야 압니다
    try:
        from printer_send import BambuPrinter  # noqa: PLC0415

        BambuPrinter(host=mine.ip, access_code=code, serial=serial, timeout=8).login_test()
    except Exception as e:  # noqa: BLE001
        return Check(
            False,
            f"{mine.ip} 에서 찾았는데 들어가지 못했습니다 — 액세스 코드를 다시 봐 주세요 ({e})",
            ip=mine.ip,
        )

    what = (mine.model or mine.name or "프린터").strip()
    return Check(True, f"찾았습니다 — {what} · {mine.ip}", ip=mine.ip)
