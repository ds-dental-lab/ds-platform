# -*- coding: utf-8 -*-
"""
오르카 프로파일 고르기 (2026-10-06).

★★ **펼쳐서 줘야 합니다.** 오르카 프로파일은 `inherits` 로 부모를 가리키는
  조각입니다 — '0.12mm Fine @BBL A1M' 은 **칸이 11개**뿐이고 layer_height 는
  부모에 있습니다. `--load-settings` 에 그 조각을 그대로 주면 오르카가
  **족보를 풀지 않고**, 이름만 그 프로파일이고 값은 기본값으로 자릅니다
  (실측 2026-10-07 — print_settings_id 는 0.12mm 인데 layer_height 는 0.2).
  **이름이 맞다고 설정이 먹은 게 아닙니다.** 잘린 결과를 열어 봐야 압니다.

★ 한 번 펼치기를 포기했던 적이 있는데, 그때 실패한 까닭은 펼치기가 아니라
  **오르카를 한 번도 안 켠 것**이었습니다(설정 폴더가 비어 CLI 가 죽음).
  켠 뒤에는 펼친 프로파일이 그대로 먹습니다.

★ `from` 칸은 **남겨야** 합니다. 지우면 "from unsupported" 로 죽습니다.

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


#: 쓰는 기계 — **Bambu Lab A1 mini** (사용자 결정 2026-10-07, 다음날 도착).
#:
#: ★ 셋이 서로 맞아야 합니다. compatible() 로 뽑은 조합입니다.
#: ★ 공정을 0.12mm 로 둔 까닭 — 크라운이 12mm 남짓인데 0.2mm 로 쌓으면
#:   교합면 홈이 뭉갭니다. 더 고우면(0.08mm) 시간이 배로 듭니다.
#:   **출발점**이고, 첫 장 뽑아 보고 바꾸시면 됩니다.
#: ★ 필라멘트는 기계에 딸려 오는 것으로 뒀습니다. 다른 PLA 를 쓰시면
#:   'Generic PLA @BBL A1M' 으로 바꾸면 됩니다.
VERIFIED = {
    "vendor": "BBL",
    "machine": "Bambu Lab A1 mini 0.4 nozzle",
    "process": "0.12mm Fine @BBL A1M",
    "filament": "Bambu PLA Basic @BBL A1M",
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


#: 합치고 나서 버릴 칸 — **족보 한 줄뿐입니다.**
#:
#: ★ `from` 을 지우면 "from unsupported" 로 죽습니다.
#: ★★ `compatible_printers` 도 지우면 안 됩니다 — "process not compatible
#:   with printer" 로 죽습니다(실측). 오르카가 그걸로 셋의 궁합을 봅니다.
#:   남겨 두는 편이 낫기도 합니다: 엉뚱한 조합을 들고 가면 오르카가 막아 줍니다.
DROP = ("inherits",)


def _find(vendor: str, name: str) -> Path | None:
    """이름으로 프로파일 조각 찾기. 부모가 다른 칸에 있을 수 있습니다"""
    for kind in ("machine", "process", "filament"):
        f = PROFILES / vendor / kind / f"{name}.json"
        if f.exists():
            return f
    return None


def flatten(vendor: str, name: str, depth: int = 0) -> dict:
    """`inherits` 를 따라 올라가 하나로 합칩니다. 부모 먼저, 자식이 이깁니다"""
    if depth > 12:  # 족보가 돌면 멈춥니다
        return {}
    f = _find(vendor, name)
    if not f:
        raise FileNotFoundError(f"프로파일을 찾지 못했습니다: {vendor}/{name}")

    child = json.loads(f.read_text(encoding="utf-8"))
    merged: dict = {}
    if child.get("inherits"):
        merged.update(flatten(vendor, child["inherits"], depth + 1))
    merged.update(child)
    for key in DROP:
        merged.pop(key, None)
    return merged


def spread(out_dir: Path, profiles: "ProfileSet", vendor: str = "BBL") -> "ProfileSet":
    """
    셋을 펼쳐 파일로 쓰고, **그 경로들**을 돌려줍니다.

    ★ 자를 때마다 새로 씁니다. 오르카 판이 올라가 프로파일이 바뀌어도
      다음 번에 따라옵니다.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    made = []
    for kind, path in (
        ("machine", profiles.machine),
        ("process", profiles.process),
        ("filament", profiles.filament),
    ):
        data = flatten(vendor, path.stem)
        data["name"] = path.stem
        target = out_dir / f"{kind}.json"
        target.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        made.append(target)
    return ProfileSet(*made)


def bed_size(machine: Path, vendor: str = "BBL") -> tuple[float, float]:
    """
    출력판 크기를 **프로파일에서 읽습니다**.

    ★★ 손으로 적어 두면 기계를 바꾸는 날 틀립니다. A1 mini 는 180×180 인데
      전에 쓰던 값이 256×256 이었습니다 — 그대로 뒀으면 크라운을 판 **밖에**
      놓고 오르카가 거부했을 겁니다.
    ★ `printable_area` 는 ['0x0', '180x0', '180x180', '0x180'] 모양입니다.
      족보를 탈 수 있어 부모까지 따라 올라갑니다.
    """
    seen: set[str] = set()
    cur: Path | None = machine
    while cur and cur.exists():
        try:
            d = json.loads(cur.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            break

        area = d.get("printable_area")
        if isinstance(area, list) and area:
            xs, ys = [], []
            for point in area:
                try:
                    a, b = str(point).lower().split("x")
                    xs.append(float(a))
                    ys.append(float(b))
                except ValueError:
                    continue
            if xs and ys:
                return (max(xs) - min(xs), max(ys) - min(ys))

        parent = d.get("inherits")
        if not parent or parent in seen:
            break
        seen.add(parent)
        cur = PROFILES / vendor / "machine" / f"{parent}.json"

    return (256.0, 256.0)   # 못 읽으면 흔한 크기로


def machines(vendor: str = "BBL") -> list[str]:
    """그 벤더의 기계 프로파일 이름들 (기종 고를 때 보려고)"""
    folder = PROFILES / vendor / "machine"
    if not folder.is_dir():
        return []
    return sorted(f.stem for f in folder.glob("*.json") if not f.stem.startswith("fdm_"))
