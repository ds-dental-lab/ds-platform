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

★ 큰 파일(64~150MB)이지만 xml 한 장만 꺼내므로 밀리초 단위입니다.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path

CASE_XML = "DentalCase.xml"


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
    teeth: list[int]         # 커넥트에서 수복물을 지정한 경우만 (없으면 빈 목록)

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
    with zipfile.ZipFile(path) as z:
        if CASE_XML not in z.namelist():
            return ""
        raw = z.read(CASE_XML)

    # UTF-16LE 로 적힙니다. 혹시 모를 BOM·UTF-8 도 받아 둡니다
    if raw[:2] in (b"\xff\xfe", b"<\x00"):
        return raw.decode("utf-16-le", "ignore").lstrip("﻿")
    return raw.decode("utf-8", "ignore")


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
        scanned_at = f"{int(y):04d}-{int(mo):02d}-{int(d):02d} {int(h or 0):02d}:{int(mi or 0):02d}"

    models = re.findall(r"<ModelType>([^<]+)</ModelType>", xml)

    # 치식 — 커넥트에서 수복물을 지정했을 때만 나옵니다 (스캔만 보낸 케이스엔 없음)
    teeth = sorted({int(t) for t in re.findall(r"<ToothNumber>(\d{2})</ToothNumber>", xml)})

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
