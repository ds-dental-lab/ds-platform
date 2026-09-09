# -*- coding: utf-8 -*-
"""
exocad 주문서(.dentalProject) 생성기 — 샘플 기반 조립. (2026-09-09)

★ 원리: exocad 가 직접 만든 샘플 파일에서 치아 종류별 <Tooth> 블록을
  틀로 뽑아, 번호와 MesialConnector 만 바꿔 다시 조립합니다. WorkParams
  (재료 DB 압축 덩어리)와 그 SHA 는 주문마다 같으므로 샘플 것을 그대로 씁니다.
★ 검증용: 아래 main 이 "46 크라운 + 45·47 인접치 + 16 대합치" 폴더를
  CAD-Data 에 만듭니다. exocad 에서 열리는지 보는 것이 첫 관문입니다.

사용:  python make_project.py            → 검증 폴더 생성
       (나중에 런처가 이 모듈의 build_project() 를 그대로 씁니다)
"""
from __future__ import annotations

import datetime as dt
import random
import re
import shutil
import string
import sys
import uuid
from pathlib import Path

EXOCAD = Path(r"C:\Users\DS\Desktop\exocad-DentalCAD3.2 DOF 25-01-07(9036)")
CAD_DATA = EXOCAD / "CAD-Data"
SAMPLE = CAD_DATA / "2026-09-09_test" / "2026-09-09_test.dentalProject"

# Denflow 종류 → 샘플에서 틀로 쓸 치아 번호 (샘플에 그 종류가 그 번호로 있음)
TEMPLATE_TOOTH = {
    "crown": 16,      # AnatomicCrown, ImplantType None
    "implant": 36,    # AnatomicCrown, CustomAbutment TI
    "inlay": 26,      # AnatomicInlay
    "pontic": 45,     # AnatomicPontic
    "healthy": 15,    # HealthyTooth (인접치)
    "antagonist": 14, # Antagonist (대합치)
}


def _read_sample() -> str:
    return SAMPLE.read_bytes().decode("utf-8-sig")


def _tooth_blocks(xml: str) -> dict[int, str]:
    out: dict[int, str] = {}
    for block in re.findall(r"    <Tooth>.*?</Tooth>\r?\n", xml, re.S):
        n = int(re.search(r"<Number>(\d+)</Number>", block).group(1))
        out[n] = block
    return out


def _render_tooth(template: str, number: int, mesial: bool) -> str:
    t = re.sub(r"<Number>\d+</Number>", f"<Number>{number}</Number>", template, count=1)
    t = re.sub(
        r"<MesialConnector>(true|false)</MesialConnector>",
        f"<MesialConnector>{'true' if mesial else 'false'}</MesialConnector>",
        t,
        count=1,
    )
    return t


# ---------- 치식 계산 ----------

def _quadrant(n: int) -> int:
    return n // 10


def _pos(n: int) -> int:
    return n % 10


def _is_upper(n: int) -> bool:
    return _quadrant(n) in (1, 2)


def neighbors(n: int) -> list[int]:
    """양옆 치아. 정중선(11↔21, 41↔31)과 최후방(x8) 처리."""
    q, p = _quadrant(n), _pos(n)
    out = []
    # 근심 쪽 (앞으로)
    if p > 1:
        out.append(q * 10 + p - 1)
    else:
        mirror = {1: 2, 2: 1, 3: 4, 4: 3}[q]
        out.append(mirror * 10 + 1)
    # 원심 쪽 (뒤로)
    if p < 8:
        out.append(q * 10 + p + 1)
    return out


def antagonist_of(n: int) -> int:
    q = _quadrant(n)
    return {1: 4, 2: 3, 3: 2, 4: 1}[q] * 10 + _pos(n)


def _mesial_order_key(n: int) -> int:
    """브릿지 안에서 '가장 근심' 을 찾기 위한 키 — 정중선에서의 거리."""
    return _pos(n)


# ---------- 조립 ----------

def build_project(
    patient_name: str,
    teeth: list[dict],          # [{"number": 46, "type": "crown"}, ...]
    bridges: list[list[int]],   # [[44, 45, 46]]
    when: dt.datetime | None = None,
    patient_id: int = 0,
) -> str:
    xml = _read_sample()
    blocks = _tooth_blocks(xml)
    when = when or dt.datetime.now().astimezone()

    work = {t["number"]: t["type"] for t in teeth}
    if not work:
        raise ValueError("작업 치아가 없습니다")

    # 브릿지: 가장 근심 치아만 false, 나머지 true
    mesial: set[int] = set()
    for b in bridges:
        if len(b) < 2:
            continue
        most_mesial = min(b, key=_mesial_order_key)
        mesial.update(x for x in b if x != most_mesial)

    # 인접치: 작업치아 양옆 중 작업치아가 아닌 것
    healthy: set[int] = set()
    for n in work:
        for nb in neighbors(n):
            if nb not in work:
                healthy.add(nb)

    # 대합치: 한쪽 악에만 있으면 반대편 하나
    uppers = [n for n in work if _is_upper(n)]
    lowers = [n for n in work if not _is_upper(n)]
    antagonist: int | None = None
    if uppers and not lowers:
        antagonist = antagonist_of(sorted(uppers)[0])
    elif lowers and not uppers:
        antagonist = antagonist_of(sorted(lowers)[0])

    rendered: list[str] = []
    for n in sorted(work):
        kind = work[n]
        if kind not in ("crown", "implant", "inlay", "pontic"):
            raise ValueError(f"모르는 종류: {kind}")
        rendered.append(_render_tooth(blocks[TEMPLATE_TOOTH[kind]], n, n in mesial))
    for n in sorted(healthy):
        rendered.append(_render_tooth(blocks[TEMPLATE_TOOTH["healthy"]], n, False))
    if antagonist is not None:
        rendered.append(_render_tooth(blocks[TEMPLATE_TOOTH["antagonist"]], antagonist, False))

    # 샘플의 <Teeth> 안을 통째로 바꿉니다
    head, rest = xml.split("  <Teeth>\r\n", 1)
    _, tail = rest.split("  </Teeth>", 1)
    out = head + "  <Teeth>\r\n" + "".join(rendered) + "  </Teeth>" + tail

    out = re.sub(r"<DateTime>[^<]*</DateTime>", f"<DateTime>{when.isoformat()}</DateTime>", out, count=1)
    out = re.sub(r"<ProjectGUID>[^<]*</ProjectGUID>", f"<ProjectGUID>{uuid.uuid4()}</ProjectGUID>", out, count=1)
    uid = "".join(random.choices(string.ascii_uppercase, k=26))
    out = re.sub(r"<ProjectUniqueId>[^<]*</ProjectUniqueId>", f"<ProjectUniqueId>{uid}</ProjectUniqueId>", out, count=1)
    # ★ 검증 결과(2026-09-09): PatientId 0 으로 가져오면 exocad 가 환자를 새로
    #   만들되 patient_id 를 **0 그대로** 씁니다. 두 번째부터는 같은 0 과 부딪치므로
    #   런처는 DentalDB_V3.sqlite 의 max(patient_id)+1 을 읽어 넣어야 합니다
    #   (next_patient_id()). 검증용 main 은 그대로 0 을 씁니다.
    out = re.sub(r"<PatientId>\d+</PatientId>", f"<PatientId>{patient_id}</PatientId>", out, count=1)
    out = re.sub(r"<PatientName>[^<]*</PatientName>", f"<PatientName>{patient_name}</PatientName>", out, count=1)
    return out


def next_patient_id() -> int:
    """exocad DB 에서 다음 환자 번호. DB 는 읽기만 합니다 (등록은 exocad 가져오기가 함)."""
    import sqlite3
    with sqlite3.connect(CAD_DATA / "DentalDB_V3.sqlite") as c:
        (m,) = c.execute("select coalesce(max(patient_id), 0) from patients").fetchone()
    return int(m) + 1


def write_case(folder_name: str, xml: str, scans: dict[str, Path]) -> Path:
    """CAD-Data/<folder>/ 에 주문서와 스캔을 놓습니다. scans: {'upperjaw': path, 'lowerjaw': path, ...}"""
    folder = CAD_DATA / folder_name
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{folder_name}.dentalProject").write_bytes(("\ufeff" + xml).encode("utf-8"))
    for jaw, src in scans.items():
        shutil.copyfile(src, folder / f"{folder_name}-{jaw}{src.suffix}")
    return folder


if __name__ == "__main__":
    today = dt.date.today().isoformat()
    name = "자동테스트"
    folder_name = f"{today}_{name}"
    xml = build_project(
        patient_name=name,
        teeth=[{"number": 46, "type": "crown"}],
        bridges=[],
    )
    donor = CAD_DATA / "2026-08-21_하소라"
    folder = write_case(
        folder_name,
        xml,
        {
            "upperjaw": donor / "2026-08-21_하소라-upperjaw.ply",
            "lowerjaw": donor / "2026-08-21_하소라-lowerjaw.ply",
        },
    )
    print("made:", folder)
    for p in sorted(folder.iterdir()):
        print("  ", p.name, p.stat().st_size)
