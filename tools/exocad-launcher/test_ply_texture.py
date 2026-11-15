# -*- coding: utf-8 -*-
"""ply 텍스처 제자리 놓기 시험. `python test_ply_texture.py`"""
import tempfile
from pathlib import Path

from PIL import Image

import ply_texture

HEAD = b"ply\nformat binary_little_endian 1.0\ncomment TextureFile %s\ncomment 3ds generated\nelement vertex 0\nend_header\n"

ok = bad = 0


def check(name: str, cond: bool) -> None:
    global ok, bad
    if cond:
        ok += 1
    else:
        bad += 1
        print("실패:", name)


with tempfile.TemporaryDirectory() as d:
    folder = Path(d)
    (folder / "case-upperjaw.ply").write_bytes(HEAD % b"implant_upper.jpg")
    (folder / "case-lowerjaw.ply").write_bytes(HEAD % b"implant_lower.jpg")
    (folder / "plain.ply").write_bytes(b"ply\nformat ascii 1.0\nelement vertex 0\nend_header\n")
    Image.new("RGB", (8, 8), (200, 10, 10)).save(folder / "implant_upper.webp")

    check("머리글에서 이름을 읽습니다", ply_texture.texture_of(folder / "case-upperjaw.ply") == "implant_upper.jpg")
    check("텍스처가 없는 ply 는 None", ply_texture.texture_of(folder / "plain.ply") is None)

    notes: list[str] = []
    made = ply_texture.fix_textures(folder, notes.append)
    check("webp 를 jpg 로 놓습니다", made == ["implant_upper.jpg"] and (folder / "implant_upper.jpg").exists())
    check("열리는 jpg 입니다", Image.open(folder / "implant_upper.jpg").format == "JPEG")
    check("원래 그림은 그대로", (folder / "implant_upper.webp").exists())
    check("없는 것은 말해 줍니다", any("implant_lower.jpg" in n and "⚠" in n for n in notes))

    again = ply_texture.fix_textures(folder, notes.append)
    check("두 번째는 할 일이 없습니다", again == [])

    (folder / "p.ply").write_bytes(HEAD % b"C:\\scan\\out\\tex.png")
    check("경로가 붙어 와도 이름만", ply_texture.texture_of(folder / "p.ply") == "tex.png")

print(f"통과 {ok} · 실패 {bad}")
raise SystemExit(1 if bad else 0)
