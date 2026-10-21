# -*- coding: utf-8 -*-
"""
설치 점검 — 치과(스캐너 PC)에 에이전트를 놓는 날, 빠진 것을 한 번에 보기 (사용자 2026-10-21).

★ 왜 — 지금까지 전 구간은 우리 망·우리 프린터·우리 PC 에서만 돌았습니다. 치과에
  가면 셋이 다 바뀌고, 처음 막히는 곳은 코드가 아니라 **망·방화벽·절전·백신**입니다.
  설치 날 손으로 하나씩 보는 대신, 여기서 한 번에 검사해 빠진 것만 빨갛게 보여 줍니다.

★ 검사 하나가 멈춰도 나머지는 계속 봅니다 — 한 줄이 "검사 못 함" 으로 남을 뿐입니다.
★ 환자 정보는 하나도 안 읽습니다. 폴더는 **있는지와 파일 수**만 봅니다.
★ 치과가 읽는 글입니다 — 회사 밖 이름(설계 서비스·기공소)은 쓰지 않습니다.

    python scan_agent.py --check     창 없이 결과만 찍고 끝남
    에이전트 창의 「설치 점검」 단추   같은 검사를 창으로
"""
from __future__ import annotations

import re
import socket
import subprocess
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Callable

#: 한 줄의 결과. ok 가 None 이면 "해당 없음/정보" — 빨갛지도 파랗지도 않습니다
@dataclass
class Item:
    name: str
    ok: bool | None
    detail: str
    fix: str = ""

    @property
    def mark(self) -> str:
        return {True: "O", False: "X", None: "-"}[self.ok]


@dataclass
class Report:
    items: list[Item] = field(default_factory=list)
    at: float = field(default_factory=time.time)

    @property
    def bad(self) -> list[Item]:
        return [i for i in self.items if i.ok is False]

    @property
    def ok(self) -> bool:
        return not self.bad

    def text(self) -> str:
        """콘솔·기록용. 빠진 것부터 적습니다"""
        lines = [f"설치 점검 {time.strftime('%Y-%m-%d %H:%M', time.localtime(self.at))} — "
                 + ("빠진 것 없음" if self.ok else f"빠진 것 {len(self.bad)}")]
        for i in sorted(self.items, key=lambda x: {False: 0, None: 2, True: 1}[x.ok]):
            lines.append(f"[{i.mark}] {i.name}: {i.detail}")
            if i.fix and i.ok is False:
                lines.append(f"      → {i.fix}")
        return "\n".join(lines)


_NO_WINDOW = 0x08000000  # 창 없는 pythonw 에서 콘솔 창이 튀지 않게


def _run(cmd: list[str], timeout: float = 15) -> str:
    out = subprocess.run(
        cmd, capture_output=True, timeout=timeout, creationflags=_NO_WINDOW, stdin=subprocess.DEVNULL,
    )
    # 윈도우 명령은 한글(cp949)로 말할 때가 있습니다
    for enc in ("utf-8", "cp949"):
        try:
            return out.stdout.decode(enc)
        except UnicodeDecodeError:
            continue
    return out.stdout.decode("utf-8", "replace")


# ---------------------------------------------------------------- 순수 판단 (테스트 대상)

def parse_sleep_minutes(powercfg_text: str) -> int | None:
    """
    `powercfg /q SCHEME_CURRENT SUB_SLEEP STANDBYIDLE` 의 AC(전원 연결) 값. 초 → 분.
    0 이면 '안 함'. 못 읽으면 None.
    ★ 한글 윈도우는 "현재 AC 전원 설정 인덱스: 0x00000000", 영문은 "Current AC Power Setting Index".
    """
    m = re.search(r"AC[^\n]*?:\s*0x([0-9a-fA-F]+)", powercfg_text)
    if not m:
        return None
    return int(m.group(1), 16) // 60


def judge_antivirus(names: list[str]) -> Item:
    """백신 이름들 → 디펜더만이면 괜찮고, 남의 백신이면 흰 목록에 넣으라고 합니다"""
    clean = [n.strip() for n in names if n.strip()]
    others = [n for n in clean if "defender" not in n.lower()]
    if not clean:
        return Item("백신", None, "백신 정보를 못 읽었습니다")
    if not others:
        return Item("백신", True, "Windows Defender 만 있습니다")
    return Item(
        "백신", False, "다른 백신이 있습니다: " + ", ".join(others),
        "그 백신의 예외(허용) 목록에 에이전트 폴더와 pythonw.exe 를 넣어 주세요. 안 넣으면 어느 날 조용히 막힙니다",
    )


def judge_clock(local_now: datetime, server_now: datetime | None) -> Item:
    if server_now is None:
        return Item("PC 시계", None, "서버 시각을 못 받았습니다")
    skew = abs((local_now - server_now).total_seconds())
    if skew <= 120:
        return Item("PC 시계", True, f"서버와 {int(skew)}초 차이")
    return Item("PC 시계", False, f"서버와 {int(skew // 60)}분 차이", "윈도우 설정 → 시간 → '지금 동기화' 를 눌러 주세요. 시계가 틀리면 올리기 열쇠가 거부됩니다")


# ---------------------------------------------------------------- 검사들

def check_link(cfg: dict) -> Item:
    if cfg.get("token"):
        return Item("덴플로우 연결", True, f"{cfg.get('clinic') or '치과'} 에 연결됨")
    return Item("덴플로우 연결", False, "연결 코드가 없습니다", "덴플로우 → 계정정보 → 연결 코드를 받아 1번 칸에 넣어 주세요")


def check_site(site: str, timeout: float = 8) -> tuple[Item, datetime | None]:
    """denflow.kr 에 닿는가 + 서버 시각(Date 헤더)"""
    try:
        req = urllib.request.Request(f"{site}/api/warm", headers={"User-Agent": "denflow-agent-check"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            date = r.headers.get("Date")
            server_now = parsedate_to_datetime(date) if date else None
            return Item("인터넷 → 덴플로우", True, f"{site} 응답 {r.status}"), server_now
    except urllib.error.HTTPError as e:
        # 4xx 라도 닿은 것입니다 — 막힌 것과 다릅니다
        date = e.headers.get("Date") if e.headers else None
        return Item("인터넷 → 덴플로우", True, f"{site} 응답 {e.code}"), (parsedate_to_datetime(date) if date else None)
    except Exception as e:  # noqa: BLE001
        return Item(
            "인터넷 → 덴플로우", False, f"{site} 에 못 닿음 — {e.__class__.__name__}",
            "이 PC 가 인터넷이 되는지, 차트 업체가 망을 막아 두지 않았는지 봐 주세요",
        ), None


def check_storage(url: str, timeout: float = 8) -> Item:
    """파일 저장소(스캔이 올라가는 곳)에 닿는가. 4xx 도 닿은 것"""
    try:
        req = urllib.request.Request(f"{url}/storage/v1/", headers={"User-Agent": "denflow-agent-check"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return Item("인터넷 → 파일 저장소", True, f"응답 {r.status}")
    except urllib.error.HTTPError as e:
        return Item("인터넷 → 파일 저장소", True, f"응답 {e.code}")
    except Exception as e:  # noqa: BLE001
        return Item(
            "인터넷 → 파일 저장소", False, f"못 닿음 — {e.__class__.__name__}",
            "스캔 파일이 올라가는 곳입니다. 방화벽·필터에서 supabase.co 를 허용해 주세요",
        )


def check_folder(cfg: dict, days: int = 7) -> Item:
    folder = (cfg.get("folder") or "").strip()
    if not folder:
        return Item("스캔 폴더", False, "폴더가 정해져 있지 않습니다", "2번 칸에서 스캐너가 저장하는 폴더를 골라 주세요")
    p = Path(folder)
    if not p.is_dir():
        return Item("스캔 폴더", False, f"폴더가 없습니다: {folder}", "스캐너 프로그램의 저장 위치를 다시 확인해 주세요 (드라이브 문자가 바뀌기도 합니다)")
    try:
        since = time.time() - days * 86400
        recent = sum(1 for f in p.rglob("*") if f.is_file() and f.stat().st_mtime > since)
    except OSError as e:
        return Item("스캔 폴더", False, f"폴더를 읽을 수 없습니다 — {e.__class__.__name__}", "이 계정으로 그 폴더를 읽을 수 있어야 합니다")
    if recent == 0:
        return Item("스캔 폴더", True, f"{folder} (최근 {days}일 새 파일 없음 — 스캐너가 정말 여기에 저장하는지 확인)")
    return Item("스캔 폴더", True, f"{folder} (최근 {days}일 파일 {recent}개)")


def check_settings_dir(settings_dir: Path) -> Item:
    try:
        settings_dir.mkdir(parents=True, exist_ok=True)
        probe = settings_dir / ".write-check"
        probe.write_text("1", encoding="utf-8")
        probe.unlink()
        return Item("설정 저장", True, str(settings_dir))
    except OSError as e:
        return Item("설정 저장", False, f"{settings_dir} 에 쓸 수 없음 — {e.__class__.__name__}", "이 윈도우 계정으로 쓸 수 있는 자리여야 합니다")


def check_autostart(on: bool) -> Item:
    if on:
        return Item("자동 시작", True, "윈도우 켤 때 저절로 뜹니다")
    return Item("자동 시작", False, "꺼져 있습니다", "에이전트 창의 '윈도우 켤 때 저절로 시작' 을 켜 주세요. 재부팅 뒤 아무도 안 켜면 스캔이 안 올라갑니다")


def check_sleep(run: Callable[[list[str]], str] = _run) -> Item:
    try:
        text = run(["powercfg", "/q", "SCHEME_CURRENT", "SUB_SLEEP", "STANDBYIDLE"])
    except Exception as e:  # noqa: BLE001
        return Item("절전", None, f"못 읽음 — {e.__class__.__name__}")
    minutes = parse_sleep_minutes(text)
    if minutes is None:
        return Item("절전", None, "절전 설정을 못 읽었습니다")
    if minutes == 0:
        return Item("절전", True, "전원 연결 시 절전 안 함")
    return Item(
        "절전", False, f"전원 연결 시 {minutes}분 뒤 절전",
        "설정 → 시스템 → 전원 → 화면 및 절전 → '절전 모드' 를 '안 함' 으로. 잠들면 스캔도 출력도 멈춥니다",
    )


def check_antivirus(run: Callable[[list[str]], str] = _run) -> Item:
    try:
        text = run([
            "powershell", "-NoProfile", "-Command",
            "Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | Select-Object -ExpandProperty displayName",
        ])
    except Exception as e:  # noqa: BLE001
        return Item("백신", None, f"못 읽음 — {e.__class__.__name__}")
    return judge_antivirus(text.splitlines())


def _port_open(host: str, port: int, timeout: float = 3) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def check_printer(cfg: dict, seconds: float = 4.0) -> list[Item]:
    """
    프린터 넷. 방송으로 찾기 → 포트 8883·990 → 접속 코드(로그인) → 상태 받기.
    ★ 방송은 못 듣는데 지난 주소로는 들어가지면 **방화벽** 입니다 — 가장 흔한 경우.
    """
    if cfg.get("printer_kind") != "bambu":
        return [Item("프린터", None, "이 치과는 자동 출력을 안 씁니다 (3번 칸 꺼짐)")]
    serial = (cfg.get("printer_serial") or "").strip()
    code = (cfg.get("printer_code") or "").strip()
    if not serial or not code:
        return [Item("프린터", False, "시리얼 또는 접속 코드가 비었습니다", "프린터 화면 → 설정 → LAN 모드를 켜면 둘 다 뜹니다. 3번 칸에 넣어 주세요")]

    out: list[Item] = []
    from printer_find import discover  # noqa: PLC0415

    found = []
    try:
        found = discover(seconds)
    except Exception as e:  # noqa: BLE001
        out.append(Item("프린터 찾기(방송)", False, f"방송을 못 들음 — {e.__class__.__name__}", "윈도우 방화벽에서 이 프로그램(pythonw.exe)의 네트워크를 허용해 주세요"))
    mine = next((f for f in found if f.serial.upper() == serial.upper()), None)
    last = (cfg.get("printer_last_ip") or "").strip()

    if mine:
        host = mine.ip
        out.append(Item("프린터 찾기(방송)", True, f"{host} ({mine.model or '모델 모름'})"))
    elif found:
        host = last
        out.append(Item(
            "프린터 찾기(방송)", False,
            "프린터는 보이는데 시리얼이 다릅니다: " + ", ".join(f.serial for f in found),
            "3번 칸의 시리얼이 이 프린터 것인지 확인해 주세요",
        ))
    else:
        host = last
        out.append(Item(
            "프린터 찾기(방송)", False,
            "같은 망에서 프린터 방송이 안 들립니다" + (f" — 지난 주소 {last} 로 이어서 봅니다" if last else ""),
            "① 프린터가 켜져 있고 PC 와 같은 와이파이/공유기인지 ② 윈도우 방화벽이 이 프로그램을 막고 있지 않은지. 공유기에서 프린터 IP 를 고정해 두면 방송 없이도 됩니다",
        ))
    if not host:
        out.append(Item("프린터 포트", False, "시험할 주소가 없습니다", "먼저 방송이 들리게 하거나, 「프린터 찾기」 로 한 번 찾아 주소를 적어 두세요"))
        return out

    p1, p2 = _port_open(host, 8883), _port_open(host, 990)
    if p1 and p2:
        out.append(Item("프린터 포트 8883·990", True, f"{host} 둘 다 열림"))
    else:
        closed = [str(p) for p, ok in ((8883, p1), (990, p2)) if not ok]
        out.append(Item(
            "프린터 포트 8883·990", False, f"{host} 에서 {', '.join(closed)} 막힘",
            "PC 와 프린터 사이에 다른 공유기(이중 공유기)나 손님망(AP 격리)이 있으면 이렇게 됩니다. 같은 공유기에 붙여 주세요",
        ))
        return out

    from printer_send import BambuPrinter  # noqa: PLC0415
    printer = BambuPrinter(host=host, access_code=code, serial=serial, timeout=8)
    try:
        printer.login_test()
        out.append(Item("프린터 접속 코드", True, "파일 통로(990) 로그인 됨"))
    except Exception as e:  # noqa: BLE001
        out.append(Item(
            "프린터 접속 코드", False, f"로그인 거부 — {e.__class__.__name__}",
            "접속 코드가 바뀌었을 수 있습니다 (프린터를 초기화하거나 LAN 모드를 껐다 켜면 바뀜). 프린터 화면의 코드를 다시 적어 주세요",
        ))
        return out
    try:
        state = printer.status(seconds=5)
        if state:
            out.append(Item("프린터 상태 받기", True, f"상태 통로(8883) 응답 — {state.get('gcode_state') or '대기'}"))
        else:
            out.append(Item(
                "프린터 상태 받기", False, "로그인은 됐는데 상태가 안 옵니다",
                "프린터 펌웨어가 외부 프로그램의 제어를 막고 있을 수 있습니다. 프린터 설정에서 LAN 모드(개발자 모드)를 켜 주세요",
            ))
    except Exception as e:  # noqa: BLE001
        out.append(Item("프린터 상태 받기", False, f"상태 통로 오류 — {e.__class__.__name__}", "프린터 설정의 LAN 모드(개발자 모드)를 확인해 주세요"))
    return out


# ---------------------------------------------------------------- 한 번에

def run_all(
    cfg: dict,
    *,
    site: str,
    storage_url: str,
    settings_dir: Path,
    autostart: bool,
    say: Callable[[str], None] | None = None,
) -> Report:
    """전부 돌립니다. 하나가 멈춰도 나머지는 계속 (각 검사가 스스로 잡습니다)"""
    tell = say or (lambda _m: None)
    rep = Report()

    def add(item: Item | list[Item]) -> None:
        for i in item if isinstance(item, list) else [item]:
            rep.items.append(i)
            tell(f"[{i.mark}] {i.name}: {i.detail}")

    add(check_link(cfg))
    site_item, server_now = check_site(site)
    add(site_item)
    add(judge_clock(datetime.now(timezone.utc), server_now))
    add(check_storage(storage_url))
    add(check_folder(cfg))
    add(check_settings_dir(settings_dir))
    add(check_autostart(autostart))
    add(check_sleep())
    add(check_antivirus())
    try:
        add(check_printer(cfg))
    except Exception as e:  # noqa: BLE001
        add(Item("프린터", None, f"검사 못 함 — {e.__class__.__name__}"))
    return rep
