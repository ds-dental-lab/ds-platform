# -*- coding: utf-8 -*-
"""
dxd 안의 케이스 정보 읽기 (2026-10-02, 사용자 요청 — 치과 PC 가 내보낸 스캔을
덴플로우 의뢰창에 그대로 띄우기 위해).

★ 파일 이름을 규격화할 필요가 없습니다. dxd 는 zip 이고 그 안의 `DentalCase.xml`
  (UTF-16LE) 에 환자 이름·차트번호·치과 이름·스캔 시각·케이스 번호가 들어 있습니다.
  실제 파일 셋으로 확인했습니다 (2026-10-01_김영애B · 2025-10-15 안현석 · JULIA).

★★ **생년월일은 안 읽습니다** (사용자 결정 2026-10-02). 파일에는 있지만 덴플로우가
  쓸 일이 없습니다. 안 받는 것이 가장 확실한 보호입니다.

★ 치과 이름은 **안내용**입니다. 로그인한 치과와 달라도 막지 않습니다 — 스캐너에
  '2510' 처럼 숫자만 적어 둔 곳이 있어 막는 조건으로 쓰면 멀쩡한 주문이 막힙니다.
  나중에 덴플로우 치과명과 맞춰 보는 용도로만 씁니다.

★ 치식은 xml 에 거의 없습니다. 실제 임상 파일 다섯 개가 모두 '본만 뜬' 내보내기라
  <ToothDefinitions/> 가 비어 있었습니다. 대신 파일 이름에 '#11,21' 처럼 적는
  치과가 있어, 없을 때는 이름에서 읽습니다 (2026-10-02 확인).

★ 큰 파일(64~180MB)이지만 xml 한 장만 꺼내므로 밀리초 단위입니다.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path

CASE_XML = "DentalCase.xml"

# ★ xml 의 시각은 **UTC** 입니다 (2026-10-02 확인 — 파일명이 11-34-58 인 스캔의
#   xml 이 hour="2" 였습니다). 그대로 쓰면 진료실 시계와 9시간 어긋납니다.
KST_OFFSET = timedelta(hours=9)


@dataclass
class DxdCase:
    """dxd 한 개에서 읽은 것. 없으면 빈 값입니다 — 못 읽었다고 멈추지 않습니다."""

    patient_name: str
    chart_no: str
    clinic_name: str
    case_guid: str
    scanned_at: str          # 'YYYY-MM-DD HH:MM'
    device: str
    models: list[str]        # UpperJaw · LowerJaw · PreOpUpper · ScanbodyUpper …
    teeth: list[int]         # 수복물을 지정했거나 파일명에 '#11,21' 처럼 적힌 경우

    def as_dict(self) -> dict:
        return asdict(self)


def _join_name(last: str, first: str) -> str:
    """'김' + '영애B' → '김영애B'. 영문은 'JULIA IRSALINA…' 로 띄어 씁니다."""
    if not last and not first:
        return ""
    hangul = re.search(r"[가-힣]", last + first)
    if hangul:
        return f"{last}{first}".strip()
    return f"{first} {last}".strip()


def _dedupe(name: str) -> str:
    """'다서울치과 다서울치과' · '다서울치과, 다서울치과' 처럼 두 번 적힌 것을 한 번으로."""
    parts = [p.strip() for p in re.split(r",", name) if p.strip()]
    if len(parts) == 2 and parts[0] == parts[1]:
        return parts[0]
    if len(parts) == 1:
        half = parts[0].split()
        if len(half) == 2 and half[0] == half[1]:
            return half[0]
    return name.strip()


def _text(xml: str, tag: str) -> str:
    m = re.search(rf"<{tag}[^>]*>([^<]*)</{tag}>", xml)
    return (m.group(1) or "").strip() if m else ""


def _read_case_xml(path: Path) -> str:
    """
    ★ 못 읽으면 빈 글자를 돌려줍니다. **멈추지 않습니다.**
      dxd 가 아닌 파일이 폴더에 섞이거나(zip 이 아님), 쓰다 만 파일이 걸리면
      zipfile 이 예외를 던집니다. 그러면 올리미 창에 빨간 글이 쏟아지고
      그 파일은 영영 건너뜁니다 — 치과는 무슨 일인지 모릅니다 (2026-10-02 확인).
    """
    try:
        with zipfile.ZipFile(path) as z:
            if CASE_XML not in z.namelist():
                return ""
            raw = z.read(CASE_XML)
    except (zipfile.BadZipFile, OSError):
        return ""

    # UTF-16LE 로 적힙니다. 혹시 모를 BOM·UTF-8 도 받아 둡니다
    if raw[:2] in (b"\xff\xfe", b"<\x00"):
        return raw.decode("utf-16-le", "ignore").lstrip("﻿")
    return raw.decode("utf-8", "ignore")


def teeth_from_name(name: str) -> list[int]:
    """
    파일 이름에서 치식 읽기 — '김예림 #11,21 최' → [11, 21].

    ★ **'#' 이 있을 때만** 봅니다. 그냥 두 자리 숫자를 주우면 날짜·차트번호가
      치식으로 둔갑합니다 ('2026-10-01', '2604040_DI_…').
    ★ 치식으로 말이 되는 번호(11~48, 끝자리 1~8)만 남깁니다.
    """
    out: set[int] = set()

    for chunk in re.findall(r"#\s*([\d,\s\-]+)", name):
        for raw in re.findall(r"\d{2}", chunk):
            n = int(raw)
            if 11 <= n <= 48 and 1 <= n % 10 <= 8:
                out.add(n)

    return sorted(out)


def read_case(path: Path) -> DxdCase:
    xml = _read_case_xml(Path(path))
    if not xml:
        return DxdCase("", "", "", "", "", "", [], [])

    # 환자 — 성과 이름이 나뉘어 있고 FullName 은 '이름 성' 순서라 직접 붙입니다
    last = _text(xml, "LastName")
    first = _text(xml, "FirstName")
    patient = _join_name(last, first) or _text(xml, "FullName").replace(",", " ").strip()

    # 치과 — <Dentist><Name>…
    clinic = ""
    dentist = re.search(r"<Dentist>(.*?)</Dentist>", xml, re.S)
    if dentist:
        clinic = _dedupe(_text(dentist.group(1), "Name"))

    # 스캔 시각 — 가장 앞의 DateTime (내보낸 기록의 첫 줄)
    when = re.search(
        r'<DateTime\s+day="(\d+)"\s+month="(\d+)"\s+year="(\d+)"'
        r'(?:\s+hour="(\d+)")?(?:\s+minute="(\d+)")?',
        xml,
    )
    scanned_at = ""
    if when:
        d, mo, y, h, mi = when.groups()
        at = datetime(int(y), int(mo), int(d), int(h or 0), int(mi or 0)) + KST_OFFSET
        scanned_at = at.strftime("%Y-%m-%d %H:%M")

    models = re.findall(r"<ModelType>([^<]+)</ModelType>", xml)

    # 치식 — 커넥트에서 수복물을 지정했을 때만 나옵니다 (스캔만 보낸 케이스엔 없음)
    teeth = sorted({int(t) for t in re.findall(r"<ToothNumber>(\d{2})</ToothNumber>", xml)})

    # ★ 없으면 파일 이름을 봅니다 — '김예림 #11,21 최.dxd' (2026-10-02 실제 파일).
    #   실제 임상 파일 다섯 개가 모두 '본만 뜬' 내보내기라 xml 에는 치식이 없었습니다.
    #   대신 치과가 파일 이름에 적고 있었습니다. 적어 준 것을 안 쓸 이유가 없습니다.
    if not teeth:
        teeth = teeth_from_name(Path(path).stem)

    return DxdCase(
        patient_name=patient,
        chart_no=_text(xml, "PatientID"),
        clinic_name=clinic,
        case_guid=_text(xml, "CaseGUID"),
        scanned_at=scanned_at,
        device=_text(xml, "AcquireDevice"),
        models=list(dict.fromkeys(models)),
        teeth=teeth,
    )


if __name__ == "__main__":  # 확인용: python dxd_case.py <파일…>
    import json
    import sys

    for arg in sys.argv[1:]:
        print(json.dumps(read_case(Path(arg)).as_dict(), ensure_ascii=False, indent=2))
