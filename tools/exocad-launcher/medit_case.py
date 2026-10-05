# -*- coding: utf-8 -*-
"""
Medit 내보내기 읽기 (2026-10-05, 사용자가 실파일을 줌).

★★ **파일 안에 아무 정보가 없습니다.** obj 머리글은 `#<MEDIT>` 한 줄뿐입니다.
  환자도 날짜도 전부 **이름에만** 있습니다. dxd 와 정반대입니다.

      폴더/zip : 2026-09-11-Test의 케이스        ← 내보낸 날짜 + 케이스 이름
      파일     : 2026-09-09-최정여-maxillary.obj  ← 스캔 날짜 + 환자 + 부위

★ 케이스 이름을 먼저 봅니다. 그것이 치과가 Medit 에 **적은** 환자이고,
  파일 쪽 이름은 가져다 붙인 스캔의 환자일 수 있습니다 (사용자 설명).
★ 치식은 못 읽습니다. Medit Link 안에만 있고 내보내기에 안 담깁니다.
  이름에 '#26' 처럼 적어 주면 그것만 읽습니다 (dxd 와 같은 규칙).
★ 내보내기 탭에서 '압축' 을 고르면 zip, 아니면 폴더로 나옵니다. 둘 다 받습니다.
  zip 안의 한글 이름은 CP949 입니다 (UTF-8 표시가 없는 zip) — 그대로 읽으면 깨집니다.

같은 규칙이 웹에도 있습니다: src/server/domain/scan-case/index.ts
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from dxd_case import teeth_from_name

MESH_EXTENSIONS = (".obj", ".stl", ".ply")

# exocad 런처가 알아보는 부위 낱말 — 이 꼬리는 환자 이름이 아닙니다
REGION_WORDS = (
    "maxillary", "upperjaw", "upper",
    "mandibular", "lowerjaw", "lower",
    "occlusionfirst", "occlusion", "bite",
    "marker", "preop", "scanbody", "gingiva",
)

DATE_HEAD = re.compile(r"^\d{4}-\d{2}-\d{2}[-_ ]+")
DATE_ONLY = re.compile(r"^(\d{4}-\d{2}-\d{2})")


def is_mesh(name: str) -> bool:
    return name.lower().endswith(MESH_EXTENSIONS)


def _without_date(name: str) -> str:
    return DATE_HEAD.sub("", name).strip()


def date_in_name(name: str) -> str:
    m = DATE_ONLY.match(name)
    return m.group(1) if m else ""


def patient_from_case_name(folder: str) -> str:
    """'2026-09-11-Test의 케이스' → 'Test'. 치과가 바꾼 이름이면 바꾼 그대로."""
    body = _without_date(re.sub(r"\.zip$", "", folder, flags=re.I))
    return re.sub(r"의?\s*케이스$", "", body).strip() or body


def patient_from_mesh_name(file: str) -> str:
    """
    '2026-09-09-최정여-maxillary.obj' → '최정여'.

    ★ 꼬리가 부위 이름일 때만 뗍니다. 무조건 마지막 토막을 버리면
      '2026-09-09-김민수.obj' 에서 환자를 버립니다.
    """
    body = _without_date(re.sub(r"\.[^.]+$", "", file))
    cut = body.rfind("-")
    if cut < 0:
        return body.strip()

    tail = body[cut + 1:].strip().lower()
    return (body[:cut] if tail.startswith(REGION_WORDS) else body).strip()


@dataclass
class MeditCase:
    patient_name: str
    scanned_on: str           # 'YYYY-MM-DD'
    teeth: list[int] = field(default_factory=list)
    case_key: str = ""


def read_case(folder_name: str, file_names: list[str]) -> MeditCase:
    """폴더(또는 zip) 이름과 그 안의 파일 이름들에서 읽습니다."""
    meshes = [n for n in file_names if is_mesh(n)]

    from_case = patient_from_case_name(folder_name)
    from_mesh = next((patient_from_mesh_name(n) for n in meshes if patient_from_mesh_name(n)), "")

    teeth = teeth_from_name(folder_name) or teeth_from_name(" ".join(meshes))
    scanned = next((date_in_name(n) for n in meshes if date_in_name(n)), "") or date_in_name(folder_name)

    return MeditCase(
        patient_name=from_case or from_mesh,
        scanned_on=scanned,
        teeth=teeth,
        # ★ 케이스 번호가 없으니 폴더 이름을 열쇠로 — 다시 내보내도 두 줄이 안 생깁니다
        case_key="medit:" + re.sub(r"\.zip$", "", folder_name, flags=re.I).strip(),
    )


def names_in_zip(path: Path) -> list[str]:
    """
    zip 안의 이름들. 한글이 깨지지 않게 CP949 로 되돌립니다.

    ★ Medit 이 만드는 zip 에는 'UTF-8 이다' 표시가 없습니다. 파이썬은 그때
      CP437 로 읽어서 '└╟ ─╔' 같은 글자가 됩니다 — 되돌려 놓습니다.
    """
    out: list[str] = []

    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            name = info.filename
            if not (info.flag_bits & 0x800):          # UTF-8 표시가 없으면
                try:
                    name = name.encode("cp437").decode("cp949")
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass
            out.append(name)

    return out


def extract_zip(path: Path, into: Path) -> list[Path]:
    """zip 을 풀어 그물 파일들의 자리를 돌려줍니다 (이름은 원래대로)."""
    into.mkdir(parents=True, exist_ok=True)
    made: list[Path] = []

    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            name = info.filename
            if not (info.flag_bits & 0x800):
                try:
                    name = name.encode("cp437").decode("cp949")
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass

            leaf = name.rsplit("/", 1)[-1]
            if not leaf or not is_mesh(leaf):
                continue

            target = into / leaf
            with z.open(info) as src, open(target, "wb") as dst:
                dst.write(src.read())
            made.append(target)

    return made
