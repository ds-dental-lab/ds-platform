# -*- coding: utf-8 -*-
"""
지그 만들기 창 (2026-09-29, 사용자 요청).

  exocad 케이스 폴더를 고르면, 디자인이 끝난 STL 을 복사해 인접면을 옆 치아에
  닿게(간격 0) 맞춘 뒤 `<환자명> 지그.stl` 로 같은 폴더에 저장합니다.

★ 계산은 jig.py 가 합니다. 이 파일은 고르고 보여 주는 일만 합니다.
★ 원본은 안 건드립니다 — 늘 새 파일로 씁니다.
"""

from __future__ import annotations

import json
import subprocess
import threading
import traceback
from pathlib import Path

import tkinter as tk
from tkinter import filedialog

from jig import (
    CONTACT_ZONE_MM,
    TARGET_GAP_MM,
    WING_REACH_MM,
    WING_THICKNESS_MM,
    make_jig,
    make_jig_with_wing,
    pick_scan,
)
from stl_render import load_stl

HERE = Path(__file__).resolve().parent
SETTINGS = HERE / "jig_app.json"

# 지그로 만들 파일 — exocad 가 내놓는 설계 이름들
DESIGN_WORDS = ("crown", "waxup", "coping", "abutment", "inlay", "onlay", "veneer", "pontic", "bridge")


def patient_of(case_dir: Path) -> str:
    """'2026-06-09_조현선' → '조현선'. 날짜가 없으면 폴더 이름 그대로."""
    name = case_dir.name
    return name.split("_", 1)[1] if "_" in name and name[:4].isdigit() else name


def design_files(case_dir: Path, include_abutment: bool) -> list[Path]:
    out = []
    for f in sorted(case_dir.glob("*.stl")):
        low = f.stem.lower()
        if "지그" in f.stem or low.endswith("_jig"):
            continue
        if not include_abutment and "abutment" in low:
            continue
        if any(w in low for w in DESIGN_WORDS):
            out.append(f)
    return out


def case_dirs(root: Path) -> list[Path]:
    """고른 폴더가 케이스면 그것 하나, 아니면 그 아래 케이스들 전부."""
    if any(root.glob("*.stl")):
        return [root]
    return [d for d in sorted(root.iterdir()) if d.is_dir() and any(d.glob("*.stl"))]


def free_name(case: Path, patient: str, wing: bool) -> Path:
    """이미 있는 지그는 **안 덮어씁니다** — 손으로 만든 것이 사라지면 안 됩니다."""
    tag = "지그(날개)" if wing else "지그"
    out = case / f"{patient} {tag}.stl"
    n = 2
    while out.exists():
        out = case / f"{patient} {tag}_{n}.stl"
        n += 1
    return out


def run_batch(root: Path, opts: dict, say) -> int:
    made = 0
    for case in case_dirs(root):
        designs = design_files(case, opts["include_abutment"])
        if not designs:
            continue

        patient = patient_of(case)
        say(f"— {case.name}  ({len(designs)}개)")

        if not any(case.glob("*.ply")):
            say("   스캔(ply)이 없는 케이스입니다 — 인접치를 알 수 없어 건너뜁니다")
            continue

        for design in designs:
            scan = pick_scan(case, load_stl(design))
            if scan is None:
                say(f"   {design.name}: 스캔(ply)이 없어 건너뜁니다")
                continue

            out = free_name(case, patient, opts["wing"])
            try:
                if opts["wing"]:
                    result = make_jig_with_wing(
                        design, scan, out,
                        contact_zone=opts["zone"], gap=opts["gap"],
                        thickness=opts["thickness"], reach=opts["reach"],
                    )
                else:
                    result = make_jig(design, scan, out, contact_zone=opts["zone"], gap=opts["gap"])
            except Exception as e:
                say(f"   {design.name}: 실패 — {e}")
                continue

            wing_note = f" · 날개 {result.wing_faces}면" if opts["wing"] else ""
            say(f"   {out.name}  ← {design.name} · 인접면 {result.moved}점 · 최대 {result.max_move:.02f}mm{wing_note}")
            made += 1

    say(f"끝. 지그 {made}개")
    return made


class App:
    def __init__(self) -> None:
        self.cfg = {
            "zone": CONTACT_ZONE_MM,
            "gap": TARGET_GAP_MM,
            "wing": False,
            "thickness": WING_THICKNESS_MM,
            "reach": WING_REACH_MM,
            "include_abutment": False,
            "open_after": True,
        }
        try:
            self.cfg.update(json.loads(SETTINGS.read_text(encoding="utf-8")))
        except Exception:
            pass

        self.root = tk.Tk()
        self.root.title("지그 만들기")
        self.root.geometry("560x520")
        self.root.configure(bg="#FFFFFF")
        self.busy = False
        F = "Malgun Gothic"

        tk.Label(self.root, text="지그 만들기", font=(F, 16, "bold"), bg="#FFFFFF", fg="#1A2130").pack(anchor="w", padx=22, pady=(18, 2))
        tk.Label(
            self.root,
            text="디자인이 끝난 STL 을 복사해 인접면을 옆 치아에 닿게 맞춰 저장합니다. 날개는 기본 2mm.",
            font=(F, 9), bg="#FFFFFF", fg="#7C8595",
        ).pack(anchor="w", padx=22)

        box = tk.Frame(self.root, bg="#FFFFFF")
        box.pack(fill="x", padx=22, pady=(14, 0))

        self.folder = tk.StringVar(value="")
        row = tk.Frame(box, bg="#FFFFFF")
        row.pack(fill="x")
        tk.Entry(row, textvariable=self.folder, font=(F, 10)).pack(side="left", fill="x", expand=True, ipady=4)
        tk.Button(row, text="케이스 폴더", command=self.pick, font=(F, 9, "bold"), relief="flat", bg="#EEF1F5").pack(side="left", padx=(6, 0))

        # ★ 두 가지 (사용자 요청 2026-09-29) — 날개 없는 것 / 옆 치아를 덮는 날개 달린 것
        self.wing = tk.BooleanVar(value=bool(self.cfg["wing"]))
        kind = tk.Frame(box, bg="#FFFFFF")
        kind.pack(fill="x", pady=(8, 2))
        tk.Radiobutton(kind, text="날개 없음", variable=self.wing, value=False, font=(F, 10), bg="#FFFFFF",
                       activebackground="#FFFFFF").pack(side="left")
        tk.Radiobutton(kind, text="날개 있음 (옆 치아를 덮음)", variable=self.wing, value=True, font=(F, 10),
                       bg="#FFFFFF", activebackground="#FFFFFF").pack(side="left", padx=(12, 0))

        self.thickness = tk.StringVar(value=f"{self.cfg['thickness']:.1f}")
        self.reach = tk.StringVar(value=f"{self.cfg['reach']:.1f}")
        wing_row = tk.Frame(box, bg="#FFFFFF")
        wing_row.pack(fill="x", pady=(2, 0))
        tk.Label(wing_row, text="날개 두께(mm)", font=(F, 10), bg="#FFFFFF").pack(side="left")
        tk.Entry(wing_row, textvariable=self.thickness, width=6, font=(F, 10)).pack(side="left", padx=(6, 16))
        tk.Label(wing_row, text="날개 범위(mm)", font=(F, 10), bg="#FFFFFF").pack(side="left")
        tk.Entry(wing_row, textvariable=self.reach, width=6, font=(F, 10)).pack(side="left", padx=(6, 0))

        self.gap = tk.StringVar(value=f"{self.cfg['gap']:.2f}")
        self.zone = tk.StringVar(value=f"{self.cfg['zone']:.2f}")
        self.include_abutment = tk.BooleanVar(value=bool(self.cfg["include_abutment"]))
        self.open_after = tk.BooleanVar(value=bool(self.cfg["open_after"]))

        nums = tk.Frame(box, bg="#FFFFFF")
        nums.pack(fill="x", pady=(8, 0))
        tk.Label(nums, text="인접면 간격(mm)", font=(F, 10), bg="#FFFFFF").pack(side="left")
        tk.Entry(nums, textvariable=self.gap, width=6, font=(F, 10)).pack(side="left", padx=(6, 16))
        tk.Label(nums, text="맞출 범위(mm)", font=(F, 10), bg="#FFFFFF").pack(side="left")
        tk.Entry(nums, textvariable=self.zone, width=6, font=(F, 10)).pack(side="left", padx=(6, 0))

        tk.Checkbutton(box, text="어벗먼트도 만들기", variable=self.include_abutment, font=(F, 10), bg="#FFFFFF", anchor="w", activebackground="#FFFFFF").pack(fill="x", pady=(6, 0))
        tk.Checkbutton(box, text="끝나면 폴더 열기", variable=self.open_after, font=(F, 10), bg="#FFFFFF", anchor="w", activebackground="#FFFFFF").pack(fill="x")

        self.start_btn = tk.Button(self.root, text="지그 만들기", command=self.start, font=(F, 11, "bold"), relief="flat", bg="#6B3FD6", fg="#FFFFFF")
        self.start_btn.pack(fill="x", padx=22, pady=(14, 8), ipady=6)

        self.text = tk.Text(self.root, height=12, font=(F, 9), bg="#F8F9FB", fg="#4A5567", relief="flat", state="disabled", wrap="word")
        self.text.pack(fill="both", expand=True, padx=22, pady=(0, 18))

    def pick(self) -> None:
        picked = filedialog.askdirectory(title="케이스 폴더 (또는 케이스들이 든 폴더)")
        if picked:
            self.folder.set(picked)

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
            self.say("케이스 폴더를 골라 주세요")
            return

        try:
            opts = {
                "gap": max(0.0, float(self.gap.get())),
                "zone": max(0.05, float(self.zone.get())),
                "wing": self.wing.get(),
                "thickness": max(0.3, float(self.thickness.get())),
                "reach": max(1.0, float(self.reach.get())),
                "include_abutment": self.include_abutment.get(),
                "open_after": self.open_after.get(),
            }
        except ValueError:
            self.say("숫자를 확인해 주세요")
            return

        SETTINGS.write_text(json.dumps(opts, ensure_ascii=False, indent=2), encoding="utf-8")
        self.busy = True
        self.start_btn.config(text="만드는 중…", state="disabled", bg="#C9C2E4")

        def work() -> None:
            try:
                run_batch(root, opts, self.say)
                if opts["open_after"]:
                    subprocess.Popen(["explorer", str(root)])
            except Exception:
                self.say("실패했습니다\n" + traceback.format_exc())
            finally:
                self.busy = False
                self.root.after(0, lambda: self.start_btn.config(text="지그 만들기", state="normal", bg="#6B3FD6"))

        threading.Thread(target=work, daemon=True).start()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    App().run()
