# -*- coding: utf-8 -*-
"""
STL → 이미지 (2026-09-28, 사용자 요청 — DLAS 의 'STL TO IMAGE' 와 같은 일).

  폴더를 하나 고르면 그 아래 STL 을 모두 찾아, 크라운 하나당 **여섯 방향**을
  한 줄로 그려 **A4 종이**에 배치합니다. 목록(TXT)과 HTML 뷰어도 함께 만듭니다.

★ 왜 필요한가 — 모델 없는 케이스(구강스캔·모델리스)는 신터링이 끝나면
  어느 크라운이 누구 것인지 눈으로 가릴 수 없습니다. 종이를 옆에 두고 맞춰 봅니다.

★ 3D 라이브러리를 안 씁니다 (stl_render 설명 참고). numpy·Pillow 뿐입니다.
★ 이름은 **파일 이름 그대로** 찍습니다. exocad 케이스 폴더면 폴더 이름(날짜_환자)도 함께.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import traceback
from datetime import datetime
from pathlib import Path

import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageDraw, ImageFont

from stl_render import load_stl, render_six_tris

HERE = Path(__file__).resolve().parent
SETTINGS = HERE / "stl_image.json"
DONE_FLAG = "processed.stl-image"      # 이 파일이 있으면 '이미 한 폴더'
FONT_PATHS = [r"C:\Windows\Fonts\malgun.ttf", r"C:\Windows\Fonts\gulim.ttc"]

# A4 300dpi
PAGE_W, PAGE_H = 2480, 3508
MARGIN = 90
CELL = 372                              # 그림 한 장
LABEL_H = 46                            # 줄 이름 높이
ROW_H = CELL + LABEL_H + 26

# 크라운·어벗만 볼 때 쓰는 낱말 (모든 STL 출력이 꺼져 있을 때)
CROWN_WORDS = ("crown", "abutment", "coping", "inlay", "onlay", "veneer", "pontic", "bridge", "cad")


def _font(size: int) -> ImageFont.FreeTypeFont:
    for p in FONT_PATHS:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def is_target(path: Path, all_stl: bool) -> bool:
    if path.suffix.lower() != ".stl":
        return False
    if all_stl:
        return True
    return any(w in path.stem.lower() for w in CROWN_WORDS)


def find_stls(root: Path, all_stl: bool, skip_done: bool) -> list[Path]:
    out: list[Path] = []
    for folder, dirs, files in os.walk(root):
        here = Path(folder)
        if skip_done and (here / DONE_FLAG).exists():
            dirs[:] = []
            continue
        out.extend(sorted(here / f for f in files if is_target(here / f, all_stl)))
    return out


def strip_image(views: list[tuple[str, Image.Image]], label: str) -> Image.Image:
    """여섯 방향 한 줄 + 이름."""
    w = CELL * len(views)
    img = Image.new("L", (w, CELL + LABEL_H), 255)
    draw = ImageDraw.Draw(img)
    draw.text((6, 8), label, font=_font(30), fill=40)

    for i, (name, im) in enumerate(views):
        img.paste(im.resize((CELL, CELL), Image.LANCZOS), (CELL * i, LABEL_H))
        draw.text((CELL * i + 8, LABEL_H + 6), name, font=_font(22), fill=130)

    draw.line([(0, CELL + LABEL_H - 1), (w, CELL + LABEL_H - 1)], fill=205)
    return img


def make_pages(rows: list[Image.Image], title: str) -> list[Image.Image]:
    """줄들을 A4 장에 담습니다."""
    pages: list[Image.Image] = []
    per_page = max(1, (PAGE_H - MARGIN * 2 - 70) // ROW_H)

    for start in range(0, len(rows), per_page):
        page = Image.new("L", (PAGE_W, PAGE_H), 255)
        draw = ImageDraw.Draw(page)
        head = f"{title}   ({start // per_page + 1}/{(len(rows) - 1) // per_page + 1})"
        draw.text((MARGIN, MARGIN - 40), head, font=_font(34), fill=90)

        here = rows[start : start + per_page]
        width = PAGE_W - MARGIN * 2
        base_h = int(here[0].height * width / here[0].width)

        # 줄이 적으면 종이가 텅 빕니다 — 남는 높이만큼 키웁니다 (최대 두 배)
        room = PAGE_H - MARGIN * 2 - 30
        grow = min(2.0, room / (len(here) * (base_h + 16))) if here else 1.0
        grow = max(1.0, grow)

        y = MARGIN + 30
        for row in here:
            w = int(width * (1 if grow <= 1 else 1))
            h = int(base_h * grow)
            scaled = row.resize((w, h), Image.LANCZOS)
            page.paste(scaled, (MARGIN, y))
            y += h + 16
        pages.append(page)

    return pages


def html_viewer(items: list[dict], out: Path, title: str) -> None:
    """그림을 한눈에 보는 쪽. 검색칸으로 환자 이름을 찾습니다."""
    cards = "\n".join(
        f'<figure><img src="{i["img"]}" loading="lazy" alt=""><figcaption>{i["label"]}</figcaption></figure>'
        for i in items
    )
    out.write_text(
        f"""<!doctype html><html lang="ko"><meta charset="utf-8">
<title>{title} · STL 이미지</title>
<style>
 body{{margin:0;padding:24px;background:#F4F6F9;font-family:'Malgun Gothic',sans-serif;color:#1A2130}}
 h1{{font-size:20px;margin:0 0 4px}} p.sub{{margin:0 0 18px;color:#7C8595;font-size:13px}}
 input{{width:100%;max-width:420px;height:40px;padding:0 12px;border:1px solid #DDE2EA;border-radius:8px;font-size:14px;margin-bottom:18px}}
 figure{{margin:0 0 18px;background:#fff;border:1px solid #E8EBF0;border-radius:10px;padding:10px}}
 figure img{{display:block;width:100%}}
 figcaption{{font-size:13.5px;font-weight:700;padding:8px 2px 2px}}
</style>
<h1>{title}</h1><p class="sub">STL {len(items)}개 · {datetime.now():%Y-%m-%d %H:%M}</p>
<input id="q" placeholder="환자 이름이나 파일 이름으로 찾기" oninput="
  const v=this.value.trim().toLowerCase();
  for (const f of document.querySelectorAll('figure'))
    f.style.display = !v || f.textContent.toLowerCase().includes(v) ? '' : 'none';">
{cards}
</html>""",
        encoding="utf-8",
    )


def run_job(root: Path, opts: dict, say) -> dict:
    """한 번 돌립니다. say(문구) 로 진행을 알립니다."""
    started = datetime.now()
    files = find_stls(root, opts["all_stl"], opts["skip_done"])
    say(f"STL {len(files)}개를 찾았습니다")

    out_root = Path(opts["out_dir"]) if opts["one_folder"] and opts.get("out_dir") else None
    if out_root:
        out_root.mkdir(parents=True, exist_ok=True)

    rows_by_folder: dict[Path, list[Image.Image]] = {}
    items_by_folder: dict[Path, list[dict]] = {}
    made = 0
    lines: list[str] = []
    touched: set[Path] = set()

    for n, f in enumerate(files, 1):
        say(f"{n}/{len(files)}  {f.name}")
        try:
            tris = load_stl(f)              # 한 번만 읽습니다
            views = render_six_tris(tris)
        except Exception as e:  # 한 파일이 깨져도 나머지는 계속
            lines.append(f"[실패] {f}  ({e})")
            continue
        if not views:
            lines.append(f"[빈 파일] {f}")
            continue

        label = f.stem if f.parent == root else f"{f.parent.name}  ·  {f.stem}"
        row = strip_image(views, label)

        target = out_root or f.parent
        target.mkdir(parents=True, exist_ok=True)
        img_path = target / f"{f.stem}_views.png"
        row.save(img_path)

        rows_by_folder.setdefault(target, []).append(row)
        items_by_folder.setdefault(target, []).append({"img": img_path.name, "label": label})
        lines.append(f"{label}	{len(tris)}면	{f}")
        touched.add(f.parent)
        made += 1

    pages_made = 0
    if opts["a4"]:
        for folder, rows in rows_by_folder.items():
            pages = make_pages(rows, folder.name if folder != root else root.name)
            for i, page in enumerate(pages, 1):
                page.save(folder / f"STL이미지_{i}.png")
            if pages:
                pages[0].save(folder / "STL이미지.pdf", save_all=True, append_images=pages[1:], resolution=300)
            pages_made += len(pages)

    if opts["txt"]:
        (out_root or root).joinpath("STL목록.txt").write_text(
            f"{root}\n{started:%Y-%m-%d %H:%M}\n\n" + "\n".join(lines) + "\n", encoding="utf-8"
        )

    if opts["html"]:
        for folder, folder_items in items_by_folder.items():
            html_viewer(folder_items, folder / "STL이미지.html", folder.name)

    for folder in touched:
        (folder / DONE_FLAG).write_text(f"{datetime.now():%Y-%m-%d %H:%M}\n", encoding="utf-8")

    if opts["open_after"]:
        subprocess.Popen(["explorer", str(out_root or root)])

    took = (datetime.now() - started).total_seconds()
    say(f"끝. STL {made}개 · A4 {pages_made}장 · {took:.0f}초")
    return {"files": made, "pages": pages_made, "seconds": took}


# ---------- 창 ----------

DEFAULTS = {
    "one_folder": False,   # 각 폴더에 저장 / 한 폴더에 모아 저장
    "out_dir": "",
    "a4": True,
    "txt": True,
    "html": False,
    "all_stl": False,      # 끄면 크라운·어벗 등 보철 파일만
    "skip_done": True,
    "open_after": True,
}


def load_settings() -> dict:
    out = dict(DEFAULTS)
    try:
        out.update(json.loads(SETTINGS.read_text(encoding="utf-8")))
    except Exception:
        pass
    return out


class App:
    """
    한 화면. 위에서 아래로 — 저장 위치 · 무엇을 만들지 · 무엇을 담을지 · 시작.
    ★ 고른 값은 stl_image.json 에 남아 다음에 그대로 뜹니다.
    """

    def __init__(self) -> None:
        self.cfg = load_settings()
        self.root = tk.Tk()
        self.root.title("STL → 이미지")
        self.root.geometry("560x560")
        self.root.configure(bg="#FFFFFF")
        self.busy = False
        F = "Malgun Gothic"

        tk.Label(self.root, text="STL → 이미지", font=(F, 16, "bold"), bg="#FFFFFF", fg="#1A2130").pack(anchor="w", padx=22, pady=(18, 2))
        tk.Label(
            self.root,
            text="폴더를 고르면 그 안의 STL 을 여섯 방향으로 그려 A4 에 담습니다.",
            font=(F, 9), bg="#FFFFFF", fg="#7C8595",
        ).pack(anchor="w", padx=22)

        box = tk.Frame(self.root, bg="#FFFFFF")
        box.pack(fill="x", padx=22, pady=(14, 0))

        self.folder = tk.StringVar(value="")
        row = tk.Frame(box, bg="#FFFFFF")
        row.pack(fill="x")
        tk.Entry(row, textvariable=self.folder, font=(F, 10)).pack(side="left", fill="x", expand=True, ipady=4)
        tk.Button(row, text="작업 폴더", command=self.pick_folder, font=(F, 9, "bold"), relief="flat", bg="#EEF1F5").pack(side="left", padx=(6, 0))

        self.vars: dict[str, tk.BooleanVar] = {}
        for key, text in [
            ("a4", "A4 모드 — 크라운 하나당 한 줄, 종이로 뽑기 좋게"),
            ("txt", "목록 TXT 저장"),
            ("html", "HTML 뷰어 만들기"),
            ("all_stl", "모든 STL 출력 (끄면 크라운·어벗 등만)"),
            ("skip_done", "이미 처리한 폴더 건너뛰기"),
            ("open_after", "끝나면 폴더 열기"),
            ("one_folder", "한 폴더에 모아 저장 (끄면 각 케이스 폴더에)"),
        ]:
            var = tk.BooleanVar(value=bool(self.cfg.get(key, DEFAULTS[key])))
            self.vars[key] = var
            tk.Checkbutton(box, text=text, variable=var, font=(F, 10), bg="#FFFFFF", anchor="w", activebackground="#FFFFFF").pack(fill="x", pady=1)

        self.out_dir = tk.StringVar(value=self.cfg.get("out_dir", ""))
        row2 = tk.Frame(box, bg="#FFFFFF")
        row2.pack(fill="x", pady=(4, 0))
        tk.Entry(row2, textvariable=self.out_dir, font=(F, 9), fg="#4A5567").pack(side="left", fill="x", expand=True, ipady=3)
        tk.Button(row2, text="모을 폴더", command=self.pick_out, font=(F, 9), relief="flat", bg="#EEF1F5").pack(side="left", padx=(6, 0))

        self.start_btn = tk.Button(self.root, text="작업 시작", command=self.start, font=(F, 11, "bold"), relief="flat", bg="#6B3FD6", fg="#FFFFFF")
        self.start_btn.pack(fill="x", padx=22, pady=(14, 8), ipady=6)

        self.text = tk.Text(self.root, height=11, font=(F, 9), bg="#F8F9FB", fg="#4A5567", relief="flat", state="disabled", wrap="word")
        self.text.pack(fill="both", expand=True, padx=22, pady=(0, 18))

    # -- 단추 --
    def pick_folder(self) -> None:
        picked = filedialog.askdirectory(title="STL 이 든 폴더")
        if picked:
            self.folder.set(picked)

    def pick_out(self) -> None:
        picked = filedialog.askdirectory(title="결과를 모을 폴더")
        if picked:
            self.out_dir.set(picked)

    def say(self, msg: str) -> None:
        def _put() -> None:
            self.text.config(state="normal")
            self.text.insert("end", msg.rstrip() + "\n")
            self.text.see("end")
            self.text.config(state="disabled")
        self.root.after(0, _put)

    def start(self) -> None:
        if self.busy:
            return
        root = Path(self.folder.get().strip())
        if not root.is_dir():
            self.say("작업 폴더를 골라 주세요")
            return

        opts = {k: v.get() for k, v in self.vars.items()}
        opts["out_dir"] = self.out_dir.get().strip()
        SETTINGS.write_text(json.dumps(opts, ensure_ascii=False, indent=2), encoding="utf-8")

        self.busy = True
        self.start_btn.config(text="작업 중…", state="disabled", bg="#C9C2E4")

        def work() -> None:
            try:
                run_job(root, opts, self.say)
            except Exception:
                self.say("실패했습니다\n" + traceback.format_exc())
            finally:
                self.busy = False
                self.root.after(0, lambda: self.start_btn.config(text="작업 시작", state="normal", bg="#6B3FD6"))

        threading.Thread(target=work, daemon=True).start()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    App().run()
