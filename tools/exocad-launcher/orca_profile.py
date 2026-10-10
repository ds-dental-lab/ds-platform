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
import os
from pathlib import Path

#: 오르카가 설치되는 곳
ORCA_DIR = Path(r"C:\Program Files\OrcaSlicer")

#: 벤더 프로파일 묶음 — 설치 폴더 쪽
PROFILES = ORCA_DIR / "resources" / "profiles"

#: ★★ **같은 것이 사용자 폴더에도 있습니다** (2026-10-10에 데인 자리).
#:   오르카는 켤 때 설치 폴더의 프로파일을 %APPDATA% 로 복사해 두고,
#:   판이 올라가면 그쪽을 갱신합니다. 사람이 자기 프로파일을 설치 폴더에
#:   넣다가 원본을 덮어 버리는 일이 실제로 났습니다 — BBL 폴더에 파일이
#:   셋만 남아 A1 mini 프로파일을 통째로 못 찾았습니다.
#:   사용자 폴더 쪽이 더 안전하고 더 최신이라 **먼저** 봅니다.
USER_PROFILES = Path(os.environ.get("APPDATA", "")) / "OrcaSlicer" / "system"


def roots() -> list[Path]:
    """프로파일을 찾을 곳. 앞엣것부터 봅니다"""
    return [p for p in (USER_PROFILES, PROFILES) if p.is_dir()]


def _folder(vendor: str, kind: str) -> Path:
    """그 벤더의 그 칸. **파일이 든** 쪽을 고릅니다"""
    found = [r / vendor / kind for r in roots() if (r / vendor / kind).is_dir()]
    for f in found:
        if any(f.glob("*.json")):
            return f
    return found[0] if found else PROFILES / vendor / kind


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
    root = (_folder(v, "machine")).parent
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
        folder = _folder(vendor, kind)
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
        for root in roots():
            f = root / vendor / kind / f"{name}.json"
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

        # ★ 공정과 필라멘트에 임시치아 설정을 덮습니다 (2026-10-10).
        #   **기계는 안 건드립니다** — A1 mini 것을 그대로 씁니다.
        over = {"process": DENTAL, "filament": DENTAL_FILAMENT}.get(kind)
        if over and dental:
            missed = apply(data, over)
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
        cur = _folder(vendor, "machine") / f"{parent}.json"

    return (256.0, 256.0)   # 못 읽으면 흔한 크기로


def machines(vendor: str = "BBL") -> list[str]:
    """그 벤더의 기계 프로파일 이름들 (기종 고를 때 보려고)"""
    folder = _folder(vendor, "machine")
    if not folder.is_dir():
        return []
    return sorted(f.stem for f in folder.glob("*.json") if not f.stem.startswith("fdm_"))

# ---------------------------------------------------------------- 임시치아 설정
#
# 사용자 요청 2026-10-08 — "레이어는 0.12로 일단 해주고 나머지 설정좀 해줘".
# 2026-10-10 — 쓰시던 **치과 전용 장비의 프로파일**을 받아 그 값으로 갈았습니다
#   (process '0.10mm Fine' · filament 'DENTAL PLA' · machine 'DENTAL QD').
#
# ★★ 받은 기계 프로파일은 **A1 mini 가 아닙니다.** 클리퍼 장비였고
#   베드가 95×120(A1 mini 는 180×180), 매크로도 START_PRINT/END_PRINT 였습니다.
#   그래서 **기계는 A1 mini 것을 그대로 두고 숫자만** 옮겼습니다.
#
# ★★ **첫 출력이 왜 실패했나** — 서포트가 꺼져 있었습니다
#   (0.12mm Fine 의 기본값 enable_support = 0). 크라운을 X 135도로 눕히면
#   첫 층부터 허공에 걸치는 면이 생깁니다. 받칠 것이 없으니 바닥부터
#   무너졌습니다. 기계 탓이 아니고 설정 탓입니다.
#
# ★ 값은 **글자**로 적습니다 (2026-10-08에 데인 자리).
#   오르카 프로파일은 숫자도 "0.12" 처럼 글자로 담습니다. 숫자로 넣으면
#   오르카가 **조용히 버립니다** — 0.12로 적어 뒀는데 0.2로 잘렸고,
#   자른 결과를 읽어 보고서야 알았습니다. 여러 개짜리 칸은 글자의 목록입니다.
#
# ★ **안 옮긴 것**이 넷입니다. 까닭은 아래 NOT_PORTED 에 적어 둡니다 —
#   적어 두지 않으면 "왜 이것만 빠졌지" 를 다시 따져야 합니다.

#: 받은 프로파일에 있었지만 **일부러 안 옮긴 값**과 그 까닭
NOT_PORTED = {
    "filament_flow_ratio": (
        "1.025 → A1 mini 의 0.98 을 지킵니다. 토출 보정은 **기계와 필라멘트마다**"
        " 따로 잡는 값입니다. 남의 장비에서 맞춘 값을 그대로 들고 오면 4.6% 더"
        " 짜내는 셈이고, 그건 크라운이 두꺼워지는 것으로 바로 나타납니다."
        " 맞물림이 빡빡하면 **이 값부터** 만지시면 됩니다."
    ),
    "filament_max_volumetric_speed": (
        "24 → A1 mini 의 21 을 지킵니다. 노즐이 녹일 수 있는 한계라 기계의 성질입니다."
        " 어차피 겉벽 25mm/s 로는 근처도 못 갑니다."
    ),
    "travel_speed": (
        "200 → A1 mini 의 700 을 지킵니다. 200 은 그 클리퍼 장비의 한계였지,"
        " 치과용으로 고른 값이 아닙니다. 빈 이동이 느릴수록 노즐이 흘릴 시간만 늡니다."
    ),
    "가속도 전부": (
        "A1 mini 것을 지킵니다. 받은 값은 그 장비의 역학에 맞춘 것이고,"
        " 정작 중요한 **첫 층 가속도**는 A1 mini 가 이미 더 얌전합니다 (500 < 1000)."
    ),
}

DENTAL: dict[str, object] = {
    # ---------- 층·선 ----------
    #: 사용자 지정. 교합면 홈이 살아 있는 가장 두꺼운 값입니다
    "layer_height": "0.12",
    "initial_layer_print_height": "0.2",
    #: 선 굵기는 받은 값과 A1 mini 기본값이 **이미 같습니다** (0.42/0.45/0.5).
    #: 같은 값을 또 적지 않습니다 — 적어 두면 나중에 A1 mini 쪽이 바뀌어도
    #: 우리가 옛 값을 붙들게 됩니다.

    # ---------- 벽과 속 ----------
    "wall_loops": "2",
    #: 임시치아는 **속이 비면 안 됩니다** — 씹는 힘을 받고, 빈 곳에 침이
    #: 들어가면 냄새가 납니다. 0.5g 짜리라 꽉 채워도 필라멘트가 더 들지 않습니다
    "sparse_infill_density": "100%",
    #: 받은 설정은 zig-zag 인데 오르카가 rectilinear 로 바꿔 적습니다.
    #: 적힌 대로 두면 "넣었는데 왜 다르지" 가 됩니다 — 오르카가 쓰는 이름으로 적습니다
    #: (어차피 100% 채움이라 무늬는 거의 뜻이 없습니다)
    "sparse_infill_pattern": "rectilinear",
    "infill_wall_overlap": "10%",
    "ensure_vertical_shell_thickness": "ensure_moderate",
    "min_width_top_surface": "200%",
    "gap_fill_target": "everywhere",
    "reduce_crossing_wall": "1",

    # ---------- 치수 정확도 ----------
    #: ★ 여기가 **맞물림**을 정하는 자리입니다. 치과 장비 쪽에서 가장
    #:   눈여겨본 대목이고, 우리 설정에는 없던 것들입니다.
    "precise_outer_wall": "1",
    "precise_z_height": "1",
    "wall_generator": "classic",
    "wall_direction": "cw",
    #: 첫 층이 눌려 퍼지는 만큼 미리 깎습니다. 마진이 두꺼워지는 것을 막습니다
    "elefant_foot_compensation": "0.15",
    #: ★ 그쪽에 없던 것을 **우리가 더합니다** — 마진(치아와 잇몸이 만나는
    #:   칼날 같은 끝)은 노즐보다 얇습니다. 이걸 끄면 그 끝이 그냥 사라집니다
    "detect_thin_wall": "1",

    # ---------- 서포트 ----------
    #: ★★ 나무(organic)에서 **snug** 으로 갈아탔습니다. 받은 설정이 그렇고,
    #:   띄움도 0.12 → 0.18 로 넉넉합니다 — 더 잘 떨어집니다. 치아는
    #:   떼다가 마진이 깨지면 그 건은 버리는 것이라, 떼기 쉬운 쪽이 맞습니다
    "enable_support": "1",
    "support_type": "normal(auto)",
    "support_style": "snug",
    #: 20도는 곡면이 많은 치아에 모자랍니다. 60도면 훨씬 자주 받칩니다
    "support_threshold_angle": "60",
    "support_top_z_distance": "0.18",
    "support_bottom_z_distance": "0.18",
    "support_object_xy_distance": "0.18",
    "support_interface_spacing": "0.4",
    "support_bottom_interface_spacing": "0.4",
    "support_base_pattern_spacing": "2",
    #: ★ **판 위에서만** 세웁니다. 치아 표면을 짚고 올라서면 그 자국이
    #:   그대로 남습니다 — 입에 들어가는 면입니다
    "support_on_build_plate_only": "1",
    #: ★★ **서포트도 같은 층 높이로** 갑니다 (받은 설정에 있던 값).
    #:   안 끄면 오르카가 서포트만 따로 0.06mm 로 쪼개 넣습니다 — 자른 것을
    #:   읽어 보니 층 간격에 0.06 이 60개 섞여 있었고, 층 수가 100 → 132 로
    #:   늘어 있었습니다. 치아 층과 서포트 층이 어긋나면 닿는 면도 지저분해집니다.
    "independent_support_layer_height": "0",

    # ---------- 판에 붙이기 ----------
    #: ★★ **라프트를 깝니다.** 2026-10-08에는 라프트가 첫 층을 안 넓힌다고
    #:   뺐는데, 그건 접촉거리를 기본값(0.1)으로 둔 채였습니다. 받은 설정은
    #:   **접촉거리 0 + 첫 층 1.5mm 넓힘** 입니다 — 판에 꽉 붙여 깔고
    #:   가장자리를 넓혀 들뜸을 막는 방식입니다.
    "raft_layers": "2",
    "raft_contact_distance": "0",
    "raft_first_layer_expansion": "1.5",
    #: ★★ **판 종류를 박아 둡니다** (2026-10-10). 안 정하면 'Cool Plate' 로
    #:   잡혀 베드가 **35도**로 돕니다 — A1 mini 에 딸려 오는 텍스처 PEI 판에서
    #:   35도면 손톱만 한 라프트가 안 붙습니다. 받은 설정의 55도를 쓰려면
    #:   판 종류가 그 55도를 가리키고 있어야 합니다.
    "curr_bed_type": "Textured PEI Plate",
    "brim_type": "outer_only",
    "brim_object_gap": "0.05",
    "skirt_height": "1",
    "min_skirt_length": "0",
    "slow_down_layers": "1",

    # ---------- 속도 ----------
    #: ★★ 겉벽 **25mm/s**. A1 mini 기본값은 200 입니다 — 큰 물건을 빨리
    #:   뽑는 쪽으로 맞춰진 값이고, 12mm 짜리 치아에는 맞지 않습니다.
    "outer_wall_speed": ["25"],
    "inner_wall_speed": ["80"],
    "internal_solid_infill_speed": ["80"],
    "sparse_infill_speed": ["80"],
    "top_surface_speed": ["80"],
    "gap_infill_speed": ["60"],
    "bridge_speed": ["30"],
    #: 기울수록 더 느리게. 치아는 거의 전부가 기울어진 면입니다
    "overhang_1_4_speed": ["20"],
    "overhang_2_4_speed": ["15"],
    "overhang_3_4_speed": ["10"],
    #: 서포트를 빨리 뽑으면 가늘어서 휘청입니다
    "support_speed": ["60"],
    "support_interface_speed": ["60"],
    #: 첫 층은 천천히 — 바닥 면적이 손톱만 한 물건입니다
    "initial_layer_speed": ["20"],
    "initial_layer_infill_speed": ["50"],
}

#: 필라멘트 쪽 — 받은 'DENTAL PLA' 에서 옮깁니다
#:
#: ★ 온도를 **낮춥니다** (220 → 205 / 첫 층 215, 베드 60·65 → 55).
#:   낮을수록 덜 흐르고 덜 줄어듭니다. 치수가 중요한 물건이라 그쪽을 택합니다.
#: ★ 식히는 방식도 다릅니다 — 속도를 줄이는 대신 **팬을 끝까지** 씁니다
#:   (최대 80 → 100, 느려지는 기준 6초 → 1초). 겉벽이 이미 25mm/s 라
#:   층 시간이 충분합니다.
DENTAL_FILAMENT: dict[str, object] = {
    "nozzle_temperature": ["205"],
    "nozzle_temperature_initial_layer": ["215"],
    "hot_plate_temp": ["55"],
    "hot_plate_temp_initial_layer": ["55"],
    "textured_plate_temp": ["55"],
    "textured_plate_temp_initial_layer": ["55"],
    "fan_max_speed": ["100"],
    "fan_min_speed": ["60"],
    "overhang_fan_threshold": ["75%"],
    "fan_cooling_layer_time": ["40"],
    "slow_down_layer_time": ["1"],
    "slow_down_min_speed": ["10"],
}

#: 프로파일에는 없지만 **오르카가 아는** 칸 (2026-10-08).
#:
#: ★ BBL 프로파일은 기본값과 같은 칸을 안 적습니다. 그래도 자른 결과
#:   (project_settings.config)에는 들어 있습니다 — 거기서 확인한 것만
#:   여기 적습니다. 확인 없이 더하면 오타가 조용히 묻힙니다.
EXTRA_OK = (
    "brim_type",
    "curr_bed_type",
    "min_width_top_surface",
    "precise_outer_wall",
    "precise_z_height",
    "wall_direction",
    "gap_fill_target",
    "ensure_vertical_shell_thickness",
    "support_bottom_interface_spacing",
    "raft_contact_distance",
    "raft_first_layer_expansion",
    "min_skirt_length",
    "slow_down_layers",
    "independent_support_layer_height",
)


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
