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


def spread(
    out_dir: Path,
    profiles: "ProfileSet",
    vendor: str = "BBL",
    dental: bool = True,
) -> "ProfileSet":
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

        # ★ 공정에만 임시치아 설정을 덮습니다 (2026-10-08).
        #   기계·필라멘트는 만든 쪽 값을 그대로 씁니다.
        if kind == "process" and dental:
            missed = apply(data)
            if missed:
                # 조용히 넘기지 않습니다 — 오타면 그 설정이 없는 것이 됩니다
                raise KeyError(f"오르카가 모르는 칸: {', '.join(missed)}")

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

# ---------------------------------------------------------------- 임시치아 설정
#
# 사용자 요청 2026-10-08 — "레이어는 0.12로 일단 해주고 나머지 설정좀 해줘".
#
# ★★ **첫 출력이 왜 실패했나** — 서포트가 꺼져 있었습니다
#   (0.12mm Fine 의 기본값 enable_support = 0). 크라운을 X 135도로 눕히면
#   첫 층부터 허공에 걸치는 면이 생깁니다. 받칠 것이 없으니 바닥부터
#   무너졌습니다. 기계 탓이 아니고 설정 탓입니다.
#
# ★★ 두 번째 까닭은 **속도**입니다. 기본값은 큰 물건을 빨리 뽑는 쪽으로
#   맞춰져 있습니다 — 겉벽 200mm/s, 첫 층 50mm/s, 서포트 150mm/s.
#   치아 하나는 12mm 짜리입니다. 서포트 기둥 밑동이 손톱만 한데 그 속도로
#   지나가면 판에서 뜯깁니다. 가느다란 나뭇가지도 그 속도에선 휘청합니다.
#
# ★ 여기 적는 값은 **출발점**입니다. 한 장 뽑아 보고 고치는 자리고,
#   고칠 때는 이 표 하나만 봅니다 — 오르카 화면을 뒤질 필요가 없습니다.
#
# ★ 칸 이름이 틀리면 **조용히 무시됩니다.** 그래서 쓰기 전에 원본 프로파일에
#   그 칸이 있는지 봅니다(아래 apply).

#: ★★ 값은 **글자**로 적습니다 (2026-10-08에 데인 자리).
#:   오르카 프로파일은 숫자도 "0.12" 처럼 글자로 담습니다. 숫자로 넣으면
#:   오르카가 **조용히 버립니다** — 0.12로 적어 뒀는데 0.2로 잘렸고,
#:   자른 결과를 읽어 보고서야 알았습니다. 여러 개짜리 칸은 글자의 목록입니다.
DENTAL: dict[str, object] = {
    # ---------- 층 ----------
    #: 사용자 지정. 교합면 홈이 살아 있는 가장 두꺼운 값입니다
    "layer_height": "0.12",
    #: 첫 층만 두껍게 — 판에 눌러 붙는 면적이 늘어납니다
    "initial_layer_print_height": "0.2",

    # ---------- 서포트 (첫 실패의 까닭) ----------
    "enable_support": "1",
    #: 나무 서포트. 크라운 안쪽 빈 곳까지 가지를 뻗어 받칩니다
    "support_type": "tree(auto)",
    "support_style": "organic",
    #: 20도는 곡면이 많은 치아에 모자랍니다 — 더 자주 받치게 합니다
    "support_threshold_angle": "30",
    #: 한 층만큼 띄웁니다. 더 붙이면 마진이 뭉개지고, 더 띄우면 처집니다
    "support_top_z_distance": "0.12",
    "support_bottom_z_distance": "0.12",
    "support_object_xy_distance": "0.3",
    #: 닿는 자리를 촘촘히 — 마진 끝이 늘어지지 않게
    "support_interface_top_layers": "3",
    "support_interface_spacing": "0.2",
    #: 밑동을 1mm 넓힙니다. 판에 붙는 면적이 그만큼 늘어납니다
    "support_expansion": "1",
    #: 기둥을 굵게, 속에 벽 한 겹 — 가늘고 빈 가지는 넘어집니다
    "tree_support_branch_diameter": "3",
    "tree_support_wall_count": "1",

    # ---------- 판에 붙이기 ----------
    #: ★★ 물건 테두리(brim_*)는 **안 건드립니다** (2026-10-08 확인).
    #:   서포트를 켜면 오르카가 물건 테두리를 아예 안 그립니다 — 세 가지
    #:   (auto_brim · outer_only · outer_and_inner) 로 잘라 봤는데 첫 층이
    #:   66.71mm 로 **똑같았습니다.** 값만 적어 두고 아무 일도 안 하는 칸은
    #:   나중에 "분명히 테두리를 켰는데" 로 사람을 헷갈리게 합니다.
    #:
    #: ★ 실제로 판에 붙는 것은 **나무 서포트가 스스로 두르는 테두리**입니다.
    #:   135도로 눕히면 판에 닿는 것이 거의 서포트 밑동뿐이니까요. 그것을
    #:   3mm 에서 5mm 로 넓힙니다.
    "tree_support_brim_width": "5",
    "tree_support_auto_brim": "1",
    #: ★ 라프트(raft_layers)도 안 씁니다. 2·3 장으로 잘라 봤지만 첫 층이
    #:   65.86 / 67.38mm — 넓어지지 않습니다. 떼어낼 것만 늘어납니다.

    # ---------- 속도 (두 번째 까닭) ----------
    #: ★ 작은 둘레(small_perimeter)는 안 건드립니다 — 겉벽의 50%로
    #:   따라오게 되어 있어서, 겉벽을 줄이면 그쪽도 같이 줄어듭니다
    "initial_layer_speed": ["20"],
    "initial_layer_infill_speed": ["50"],
    "outer_wall_speed": ["60"],
    "inner_wall_speed": ["100"],
    #: 서포트를 빨리 뽑으면 가지가 휘청이다 끊깁니다
    "support_speed": ["60"],
    "support_interface_speed": ["40"],
    "top_surface_speed": ["50"],
    "sparse_infill_speed": ["120"],

    # ---------- 속을 채웁니다 ----------
    #: 임시치아는 **속이 비면 안 됩니다** — 씹는 힘을 받고, 빈 곳에
    #: 침이 들어가면 냄새가 납니다. 0.5g 짜리라 꽉 채워도 필라멘트가
    #: 더 들지 않습니다
    "sparse_infill_density": "100%",
    "wall_loops": "3",
    "top_shell_layers": "6",
    "bottom_shell_layers": "6",

    # ---------- 얇은 벽 ----------
    #: ★ 마진(치아와 잇몸이 만나는 칼날 같은 끝)은 노즐보다 얇습니다.
    #:   이것을 끄면 그 끝이 **그냥 사라집니다** — 뽑고 나서야 압니다
    "detect_thin_wall": "1",
}


#: 프로파일에는 없지만 **오르카가 아는** 칸 (2026-10-08).
#:
#: ★ BBL 프로파일은 기본값과 같은 칸을 안 적습니다. 그래도 자른 결과
#:   (project_settings.config)에는 들어 있습니다 — 거기서 확인한 것만
#:   여기 적습니다. 확인 없이 더하면 오타가 조용히 묻힙니다.
EXTRA_OK = ("tree_support_brim_width", "tree_support_auto_brim")


def apply(data: dict, over: dict | None = None) -> list[str]:
    """
    펼친 프로파일에 설정을 덮어씁니다. **모르는 칸은 안 넣습니다.**

    ★ 오르카는 모르는 칸을 조용히 버립니다. 이름을 한 자 틀리면 그 설정은
      없는 것이 되고, 자른 결과만 보고는 알 수 없습니다. 그래서 원본에
      있는 칸(또는 EXTRA_OK)만 덮고, 못 넣은 것은 **돌려줍니다**.
    """
    unknown = []

    for key, value in (over if over is not None else DENTAL).items():
        if key not in data and key not in EXTRA_OK:
            unknown.append(key)
            continue

        #: ★★ 모양까지 봅니다 (2026-10-08). 글자 자리에 숫자를 넣으면
        #:   오르카가 **조용히 버립니다** — 0.12 로 적고 0.2 로 잘렸습니다.
        #:   조용한 실수를 시끄러운 실수로 바꿉니다.
        before = data.get(key)
        if before is not None and type(before) is not type(value):
            raise TypeError(
                f"{key}: 프로파일은 {type(before).__name__}, 우리 값은 "
                f"{type(value).__name__} 입니다 ({before!r} / {value!r})"
            )

        data[key] = value

    return unknown

