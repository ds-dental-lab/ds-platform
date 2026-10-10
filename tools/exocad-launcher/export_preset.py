# -*- coding: utf-8 -*-
"""
우리 임시치아 설정을 **오르카 화면에서 보이게** 내보냅니다 (2026-10-10).

    python export_preset.py

★ 왜 필요한가 (사용자 요청) — 지금 값은 orca_profile.DENTAL 에만 있습니다.
  자를 때는 그걸 펼쳐 넘기므로 잘 돌지만, **오르카를 열어 눈으로 볼 수가
  없습니다.** 화면에서 클릭해 수치를 보고 손으로 만져 보려면, 오르카의
  사용자 프로파일 자리에 그 모양으로 적어 줘야 합니다.

★ 덮어쓰는 것이 아니라 **새 이름**으로 둡니다. 밤부가 준 프로파일은
  그대로 두고, 우리 것만 목록에 하나 더 생깁니다.

★ 설정을 고치면 **다시 돌리세요.** orca_profile.py 가 원본이고 여기서
  나온 파일은 사본입니다. 둘이 어긋나면 자른 결과(원본)가 맞습니다.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import orca_profile as op

#: 오르카가 사용자 프로파일을 두는 곳
USER_DIR = Path(os.environ.get("APPDATA", "")) / "OrcaSlicer" / "user" / "default"

#: 화면 목록에 뜰 이름
PROCESS_NAME = "덴플로우 임시치아 0.12"
FILAMENT_NAME = "덴플로우 DENTAL PLA"

#: 받은 치과 장비 프로파일과 같은 판 번호로 적습니다
VERSION = "2.2.0.4"

NOTE = (
    "덴플로우 임시치아용. 치과 장비 프로파일(0.10mm Fine / DENTAL PLA)의 값을 "
    "A1 mini 로 옮긴 것입니다. 토출 보정(0.98)과 최대 토출량(21)은 A1 mini 것을 "
    "지켰습니다 — 기계마다 따로 잡는 값입니다. "
    "★ 판 종류를 '텍스처 PEI 판'으로 고르세요. 'Cool Plate' 면 베드가 35도로 돕니다."
)


def write(kind: str, name: str, inherits: str, values: dict, extra: dict) -> Path:
    folder = USER_DIR / kind
    folder.mkdir(parents=True, exist_ok=True)

    data: dict = {
        "name": name,
        "from": "User",
        "inherits": inherits,
        "is_custom_defined": "0",
        "version": VERSION,
        **extra,
    }

    for key, value in values.items():
        # ★ 판 종류는 프로파일 칸이 아니라 화면에서 고르는 것입니다.
        #   넣어 두면 오르카가 프로파일을 거절할 수 있어 뺍니다 — 대신 NOTE 에 적습니다.
        if key == "curr_bed_type":
            continue
        data[key] = value

    path = folder / f"{name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding="utf-8")

    # 오르카는 짝꿍 .info 를 같이 봅니다 (없어도 뜨지만 맞춰 둡니다)
    path.with_suffix(".info").write_text(
        "sync_info = \nuser_id = \nsetting_id = \nbase_id = \n"
        f"updated_time = {int(time.time())}\n",
        encoding="utf-8",
    )
    return path


def main() -> int:
    made = [
        write(
            "process",
            PROCESS_NAME,
            op.VERIFIED["process"],
            op.DENTAL,
            {"print_settings_id": PROCESS_NAME, "notes": NOTE},
        ),
        write(
            "filament",
            FILAMENT_NAME,
            op.VERIFIED["filament"],
            op.DENTAL_FILAMENT,
            {"filament_settings_id": [FILAMENT_NAME], "filament_notes": [NOTE]},
        ),
    ]

    for p in made:
        print(f"  썼습니다  {p}")

    print()
    print("오르카를 **껐다 켜면** 목록에 뜹니다:")
    print(f"  공정    {PROCESS_NAME}")
    print(f"  필라멘트 {FILAMENT_NAME}")
    print("  기계    Bambu Lab A1 mini 0.4 nozzle (그대로)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
