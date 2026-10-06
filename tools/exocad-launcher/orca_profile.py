# -*- coding: utf-8 -*-
"""
오르카 프로파일 고르기 (2026-10-06).

★ **펼치지 않습니다.** 한 번 그 길로 갔다가 돌아왔습니다 —
  오르카 프로파일은 `inherits` 로 부모를 가리키는 조각인데, 부모를 따라
  올라가 하나로 합쳐서 주면 오르카가 거부합니다(`from unsupported`,
  고쳐도 말없이 죽음). **오르카가 들고 있는 파일을 그대로 가리키면 됩니다** —
  족보는 오르카가 제 안에서 풉니다.

★ 다만 셋이 **서로 맞아야** 합니다. 공정·필라멘트에는
  `compatible_printers` 가 박혀 있고, 안 맞으면 자르지 않습니다.
  아래 기본값은 실제로 자르는 것을 확인한 조합입니다(2026-10-06,
  오르카 2.4.2, 61층 / 5분 24초 출력물까지 나옴).

★ 기종은 아직 미정입니다. 정해지면 `pick()` 에 이름만 바꿰 넣으면 되고,
  사용자가 화면에서 맞춘 프로파일이 생기면 그 경로를 그대로 주면 됩니다.
"""

from __future__ import annotations

import json
from pathlib import Path

#: 오르카가 설치되는 곳
ORCA_DIR = Path(r"C:\Program Files\OrcaSlicer")

#: 벤더 프로파일 묶음
PROFILES = ORCA_DIR / "resources" / "profiles"


def orca_exe() -> Path:
    """오르카 실행 파일. 없으면 그대로 돌려줍니다 (부르는 쪽이 판단)"""
    return ORCA_DIR / "orca-slicer.exe"


def ready() -> bool:
    """
    오르카를 한 번이라도 켰는가.

    ★ 켜기 전에는 설정 폴더가 비어 있고 CLI 가 `Errors` 한 줄만 남기고
      죽습니다(실측). 깔기만 해서는 안 됩니다.
    """
    conf = Path.home() / "AppData" / "Roaming" / "OrcaSlicer" / "OrcaSlicer.conf"
    return conf.exists()


class ProfileSet:
    """기계·공정·필라멘트 세 경로. 그대로 오르카에 넘깁니다"""

    def __init__(self, machine: Path, process: Path, filament: Path) -> None:
        self.machine = machine
        self.process = process
        self.filament = filament

    def missing(self) -> list[Path]:
        return [p for p in (self.machine, self.process, self.filament) if not p.exists()]

    def as_tuple(self) -> tuple[Path, Path, Path]:
        return self.machine, self.process, self.filament

    def __repr__(self) -> str:
        return (
            f"ProfileSet(machine={self.machine.stem!r}, "
            f"process={self.process.stem!r}, filament={self.filament.stem!r})"
        )


#: 자르는 것을 확인한 조합 (2026-10-06). 기종이 정해지면 바꿉니다.
#: ★ 공정·필라멘트가 X1C 이름인데 P1S 에서 됩니다 — 그 둘의
#:   compatible_printers 에 'Bambu Lab P1S 0.4 nozzle' 이 들어 있습니다.
VERIFIED = {
    "vendor": "BBL",
    "machine": "Bambu Lab P1S 0.4 nozzle",
    "process": "0.20mm Standard @BBL X1C",
    "filament": "Bambu PLA Basic @BBL X1C",
}


def pick(
    vendor: str | None = None,
    machine: str | None = None,
    process: str | None = None,
    filament: str | None = None,
) -> ProfileSet:
    """이름으로 프로파일 셋을 집습니다. 안 주면 확인된 조합"""
    v = vendor or VERIFIED["vendor"]
    root = PROFILES / v
    return ProfileSet(
        root / "machine" / f"{machine or VERIFIED['machine']}.json",
        root / "process" / f"{process or VERIFIED['process']}.json",
        root / "filament" / f"{filament or VERIFIED['filament']}.json",
    )


def compatible(machine: str, vendor: str = "BBL") -> dict[str, list[str]]:
    """
    이 기계와 **맞는** 공정·필라멘트를 찾아 줍니다.

    ★ 기종이 정해지면 이것부터 돌려 보면 됩니다. 손으로 고르면
      안 맞는 조합을 집어 자르기가 조용히 실패합니다.
    """
    out: dict[str, list[str]] = {"process": [], "filament": []}
    for kind in out:
        folder = PROFILES / vendor / kind
        if not folder.is_dir():
            continue
        for f in sorted(folder.glob("*.json")):
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if machine in (d.get("compatible_printers") or []):
                out[kind].append(f.stem)
    return out


def machines(vendor: str = "BBL") -> list[str]:
    """그 벤더의 기계 프로파일 이름들 (기종 고를 때 보려고)"""
    folder = PROFILES / vendor / "machine"
    if not folder.is_dir():
        return []
    return sorted(f.stem for f in folder.glob("*.json") if not f.stem.startswith("fdm_"))
