# -*- coding: utf-8 -*-
"""
색 붙은 ply 의 텍스처 그림을 제자리에 놓습니다. (2026-11-15)

★ 사고: exocad 에서 케이스를 열면
    "Unable to load PLY file: Texture file …\\implant_upper.jpg is not found"
  ply 머리글에 `comment TextureFile implant_upper.jpg` 가 적혀 있는데, 덴플로우는
  올라온 그림을 **webp 로 바꿔** 보관합니다. 그래서 폴더에는 implant_upper.webp 만
  있고 jpg 가 없었습니다 — exocad 는 그 스캔을 통째로 못 엽니다.

★ 하는 일: 폴더의 ply 마다 머리글을 읽어, 적힌 텍스처 파일이 없으면
  **같은 이름의 다른 그림**(webp·png·jpeg…)을 찾아 그 이름·형식으로 바꿔 놓습니다.
  원래 그림은 그대로 둡니다.
★ 못 찾으면 **말해 줍니다** — 조용히 넘기지 않습니다. ply 는 건드리지 않습니다.
★ 크기가 줄어 있어도 됩니다. 텍스처 좌표는 0~1 비율이라 그림 크기와 무관합니다.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Callable

TEXTURE_LINE = re.compile(rb"^comment\s+TextureFile\s+(.+?)\s*$", re.M)
IMAGE_EXTS = (".webp", ".png", ".jpg", ".jpeg", ".bmp")


def texture_of(ply: Path) -> str | None:
    """ply 머리글에 적힌 텍스처 파일 이름. 없으면 None."""
    with open(ply, "rb") as f:
        head = f.read(4096)
    end = head.find(b"end_header")
    if end < 0:
        return None
    m = TEXTURE_LINE.search(head[:end])
    if not m:
        return None
    # 경로가 붙어 와도 이름만 씁니다 — exocad 는 ply 옆에서 찾습니다
    name = m.group(1).decode("utf-8", "replace").strip().strip('"')
    return Path(name.replace("\\", "/")).name or None


def find_twin(folder: Path, wanted: str) -> Path | None:
    """같은 이름(확장자만 다른) 그림."""
    stem = Path(wanted).stem.lower()
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.stem.lower() == stem and p.suffix.lower() in IMAGE_EXTS and p.name.lower() != wanted.lower():
            return p
    return None


def fix_textures(folder: Path, note: Callable[[str], None] = print) -> list[str]:
    """→ 새로 만든 텍스처 파일 이름들."""
    made: list[str] = []
    for ply in sorted(folder.glob("*.ply")):
        try:
            wanted = texture_of(ply)
        except OSError as e:
            note(f"⚠ {ply.name} 의 머리글을 못 읽었습니다 ({e})")
            continue
        if not wanted or (folder / wanted).exists():
            continue

        twin = find_twin(folder, wanted)
        if twin is None:
            note(f"⚠ {ply.name} 이 찾는 색 그림 {wanted} 가 주문에 없습니다 — exocad 에서 이 스캔이 안 열릴 수 있습니다")
            continue

        try:
            from PIL import Image  # noqa: PLC0415

            with Image.open(twin) as im:
                target = folder / wanted
                if target.suffix.lower() in (".jpg", ".jpeg"):
                    im.convert("RGB").save(target, "JPEG", quality=95)
                else:
                    im.save(target)
        except Exception as e:  # noqa: BLE001
            note(f"⚠ {twin.name} 을 {wanted} 로 바꾸지 못했습니다 ({e}) — exocad 에서 이 스캔이 안 열릴 수 있습니다")
            continue

        made.append(wanted)
        note(f"{twin.name} → {wanted} (ply 의 색 그림)")
    return made
