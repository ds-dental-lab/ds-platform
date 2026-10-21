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


#: 토출 보정을 건너뛰게 만드는 한 줄 (2026-10-13).
#:
#: ★★ **그것 하나가 3분입니다.** 프린터가 단계를 말해 주게 해서 재 봤더니,
#:   출력 전 5분 38초 중 **토출 보정이 183초**였습니다 (베드 데우기 24초 ·
#:   소음 측정 56초 · 판 고르기 43초 …). 출력 자체가 5분 04초인데 준비가
#:   더 길었습니다.
#:
#: ★ 끄는 스위치는 **밤부가 이미 만들어 뒀습니다** — 시작 G코드에
#:   `;M1002 set_flag extrude_cali_flag=1` 이 주석으로 들어 있습니다. 그 자리에
#:   0 을 넣으면 바로 아래 `M622 J1` 블록이 통째로 안 돕니다. 남의 코드를
#:   지우지 않고 그쪽이 둔 손잡이를 쓰는 셈입니다.
#:
#: ★ 출력 명령의 `flow_cali: false` 는 A1 mini 가 **무시했습니다**(실측
#:   2026-10-10). 이 길은 G코드라 펌웨어가 따질 것이 없습니다.
#:
#: ★★ 건너뛰면 **압출 보정값(K)을 그때그때 재지 않고** 기계에 들어 있는 값을
#:   씁니다. 겉벽 25mm/s 로 뽑는 물건이라 조금 달라도 눈에 안 띕니다 —
#:   빨리 뽑을수록 중요해지는 값입니다. 필라멘트를 바꾸고 결이 이상하면
#:   **여기부터** 되돌려 보세요.
CALI_OFF = (
    ";M1002 set_flag extrude_cali_flag=1",
    "M1002 set_flag extrude_cali_flag=0",
)


def skip_flow_cali(machine: dict) -> bool:
    """시작 G코드에서 토출 보정을 끕니다. 바꿨으면 True"""
    gcode = machine.get("machine_start_gcode")
    if not isinstance(gcode, str) or CALI_OFF[0] not in gcode:
        return False
    machine["machine_start_gcode"] = gcode.replace(CALI_OFF[0], CALI_OFF[1], 1)
    return True


#: 소음 줄이기 측정(공진 측정)을 건너뛰게 하는 줄들 (2026-10-13).
#:
#: ★ 54초짜리입니다. 토출 보정(183초) 다음으로 큰 덩어리입니다.
#:
#: ★★ 이쪽은 **밤부가 끄는 손잡이를 안 달아 뒀습니다.** 토출 보정처럼
#:   깃발 하나로 못 끄고, 재는 줄을 직접 집어내야 합니다. 같은 블록에
#:   Z·X 원점잡기와 판 감지가 들어 있어서 **통째로 지우면 안 됩니다** —
#:   재는 줄(M970/M974) 네 개만 뺍니다.
#:
#: ★★ 건너뛰면 **기계에 저장된 지난 측정값**을 씁니다. 그 값이 하는 일은
#:   빠르게 움직일 때 생기는 잔물결(고스팅)을 줄이는 것인데, 우리는 겉벽을
#:   25mm/s 로 뽑습니다 — 잔물결이 생길 속도가 아닙니다.
#:   기계를 옮겼거나 벨트를 만졌으면 **한 번은 재게 두세요**(아래를 끄면 됩니다).
VIBRATION_LINES = (
    "M970.3 Q1 A7 K0 O2",
    "M974 Q1 S2 P0",
    "M970 Q0 A10 B50 C90 H15 K0 M20 O3",
    "M974 Q0 S2 P0",
)


def skip_vibration(machine: dict) -> int:
    """시작 G코드에서 공진 측정 줄을 뺍니다. 뺀 줄 수를 돌려줍니다"""
    gcode = machine.get("machine_start_gcode")
    if not isinstance(gcode, str):
        return 0

    out = []
    gone = 0
    for line in gcode.split(chr(10)):
        if line.strip() in VIBRATION_LINES:
            gone += 1
            continue
        out.append(line)

    if gone:
        machine["machine_start_gcode"] = chr(10).join(out)
    return gone


#: 공진 측정을 건너뛸 것인가. 품질에 닿는 값이라 **따로 둡니다** —
#: 토출 보정과 달리 되돌릴 일이 생길 수 있습니다.
SKIP_VIBRATION = True

#: 출력 앞 바닥 다지기(베드 레벨링)를 건너뛰는 손잡이 (2026-10-21).
#:
#: ★★ 왜 — 사용자 "시간이 좀 더 줄었으면". 2mm 정육면체를 잘라도 예상 7분 44초가
#:   나왔습니다. 13분짜리 크라운에서 **7분이 물건과 상관없는 시작·마무리**이고,
#:   그중 큰 덩어리가 매 출력 앞의 바닥 다지기입니다. 속도를 아무리 올려도 시간이
#:   안 줄던 까닭입니다(겉벽 25→35 가 31초, 서포트 60→100 이 1초).
#:
#: ★ 토출 보정과 같은 손잡이입니다 — 밤부가 주석으로 둔
#:   `;M1002 set_flag g29_before_print_flag=1` 자리에 0 을 넣으면 바로 아래
#:   `judge_flag` 블록(G29 A1 …)과, 그 다음 '다진 뒤 다시 원점' 블록이 함께 안 돕니다.
#:   출력 명령의 `bed_leveling: false` 는 A1 mini 가 무시했지만(2026-10-10) 이 길은
#:   G코드라 그대로 듣습니다.
#:
#: ★★ 건너뛰면 **기계에 저장된 지난 바닥 지도**를 씁니다. 판이 같고 라프트를 까는
#:   손톱만 한 물건이라 괜찮다고 보지만, **첫 층이 안 붙거나 노즐이 긁으면 여기부터
#:   되돌리세요**(False). 판을 바꾸거나 기계를 옮겼으면 한 번은 다지게 두세요.
SKIP_LEVELING = True

LEVELING_OFF = (
    ";M1002 set_flag g29_before_print_flag=1",
    "M1002 set_flag g29_before_print_flag=0",
)


def skip_leveling(machine: dict) -> bool:
    """시작 G코드에서 바닥 다지기를 끕니다. 바꿨으면 True"""
    gcode = machine.get("machine_start_gcode")
    if not isinstance(gcode, str) or LEVELING_OFF[0] not in gcode:
        return False
    machine["machine_start_gcode"] = gcode.replace(LEVELING_OFF[0], LEVELING_OFF[1], 1)
    return True


def spread(
    out_dir: Path,
    profiles: "ProfileSet",
    vendor: str = "BBL",
    dental: bool = True,
    process_extra: dict[str, object] | None = None,
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
        # ★ 기계는 값을 안 바꿉니다 — 시작 G코드에서 재는 구간만 뺍니다
        if kind == "machine" and dental:
            skip_flow_cali(data)
            if SKIP_VIBRATION:
                skip_vibration(data)
            if SKIP_LEVELING:
                skip_leveling(data)

        over = {"process": DENTAL, "filament": DENTAL_FILAMENT}.get(kind)
        if over and dental:
            missed = apply(data, over)
            if missed:
                # 조용히 넘기지 않습니다 — 오타면 그 설정이 없는 것이 됩니다
                raise KeyError(f"오르카가 모르는 칸: {', '.join(missed)}")

        # ★ 이번 한 건만 바꾸는 값 (사용자 2026-10-15 — "이번 것만 0.12 레이어로").
        #   기본값(DENTAL)은 그대로 둡니다. 모르는 칸이면 역시 멈춥니다.
        if kind == "process" and process_extra:
            missed = apply(data, process_extra)
            if missed:
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
    #: ★ 0.12 → **0.16** (사용자 결정 2026-10-10, 뽑아서 견주고 정했습니다).
    #:   밤부가 A1 mini 에 내놓은 프로파일은 **열 개 전부 0.04 배수**입니다
    #:   (0.08·0.12·0.16·0.20·0.24·0.28). 0.15 는 그 격자에 없고 0.16 보다
    #:   느립니다(14m22 vs 13m54) — 고를 이유가 없습니다.
    #:   실측 10분 54초 → **9분 00초**. 마진은 아래 토출 보정으로 받습니다.
    "layer_height": "0.16",
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
    #: ★ 서포트와 치아 **사이가 지저분하다** (사용자 2026-10-21, 손에 쥐고 본 것).
    #:   세 군데를 손봅니다 — 아직 뽑아 보기 전이라 **다음 출력으로 확인**합니다.
    #:   · 옆 간격 0.18 → 0.35: 서포트 벽이 치아 옆면에 눌어붙어 뜯긴 자국이 남던 것
    #:   · 닿는 면 간격 0.4 → 0.2, 닿는 층 2 → 3: 성긴 접촉면이 실처럼 늘어지던 것
    #:   · 닿는 면 무늬 interlaced: 치아와 엇갈려 깔아 떼어도 깔끔하게
    #:   · 닿는 면 속도 60 → 40: 가늘게 깔리는 자리라 빨리 가면 흘립니다
    "support_object_xy_distance": "0.35",
    "support_interface_spacing": "0.2",
    "support_bottom_interface_spacing": "0.2",
    "support_interface_top_layers": "3",
    "support_interface_bottom_layers": "2",
    "support_interface_pattern": "rectilinear_interlaced",
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
    #: ★★ **스커트 한 바퀴** (2026-10-13). 물건을 붙잡으려는 것이 아니라
    #:   **노즐을 미리 밀어 두려는** 것입니다. 아래 기계 쪽에서 토출 보정을
    #:   건너뛰는데, 그 안에 노즐을 밀어내는 줄이 같이 들어 있어서 그냥
    #:   끄면 첫 층이 비어 나옵니다. 스커트가 그 일을 대신합니다.
    "skirt_loops": "1",
    "skirt_distance": "3",
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
    "support_interface_speed": ["40"],
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
    #: ★★ 0.98 → **0.96** (사용자 결정 2026-10-10). 층을 0.16 으로 올리면
    #:   마진 계단이 굵어지는데, 토출을 줄이면 그만큼 얇아집니다. 둘을 같이
    #:   걸어 뽑아 보고 "둘 다 괜찮다" 로 정했습니다.
    #:   ★ 이 값은 **기계·필라멘트마다** 다시 잡는 것입니다. 필라멘트를
    #:     바꾸면 여기부터 의심하세요. 맞물림이 빡빡하면 더 내립니다.
    "filament_flow_ratio": ["0.96"],
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
