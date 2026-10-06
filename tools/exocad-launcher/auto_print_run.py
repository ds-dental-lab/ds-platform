# -*- coding: utf-8 -*-
"""
자동 출력 보내기 — 창 (2026-10-06).

센터에서 「자동 출력 보내기」를 누르면 브라우저가
`denflow://print/<주문ID>?t=<토큰>` 을 열고, 런처가 이리로 옵니다.

하는 일:
  1. 덴트버드에서 내려받은 크라운 STL 을 **고르게 한다**
  2. 돌려서 자르고(slice_job) 주문에 올린다(deliver)
  3. 끝나면 '출력 대기' — 치과가 출력판을 비우면 저절로 갑니다

★ 파일 고르기를 **폴더 지켜보기보다 먼저** 둡니다. 덴트버드에서 막 내려받은
  것을 그 자리에서 고르는 흐름이라, 폴더를 미리 정해 두는 수고가 없습니다.
  (폴더를 지켜보는 길은 나중에 건수가 늘면 얹습니다)

★ 각도는 기본 x 150° / y 140° 입니다. 창에서 고칠 수 있습니다 —
  기종과 프로파일이 정해지면 그때 기본값을 바꿉니다.

★ 실패하면 **까닭을 창에 그대로** 둡니다. 창을 닫기 전에 사람이 읽습니다.
"""

from __future__ import annotations

import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog

INK = "#1A2130"
SUB = "#4A5567"
DIM = "#7C8595"
LINE = "#E8EBF0"
BLUE = "#1279E8"
RED = "#D64545"

#: 처음 보여 줄 각도. 덴트버드에서 받은 크라운을 눕히는 값입니다
DEFAULT_RX = 150.0
DEFAULT_RY = 140.0


class Window:
    def __init__(self, order_id: str, token: str) -> None:
        self.root = tk.Tk()
        self.root.title("덴플로우 — 자동 출력")
        self.root.configure(bg="white")
        self.root.geometry("480x360")
        self.root.resizable(False, False)

        self.stl: Path | None = None
        self.busy = False
        self.code = 1

        tk.Label(
            self.root, text="자동 출력 보내기", bg="white", fg=INK,
            font=("Malgun Gothic", 13, "bold"),
        ).pack(anchor="w", padx=18, pady=(16, 2))

        tk.Label(
            self.root,
            text="덴트버드에서 내려받은 크라운 STL 을 고르세요.",
            bg="white", fg=SUB, font=("Malgun Gothic", 9),
        ).pack(anchor="w", padx=18)

        tk.Frame(self.root, bg=LINE, height=1).pack(fill="x", padx=18, pady=12)

        row = tk.Frame(self.root, bg="white")
        row.pack(fill="x", padx=18)
        self.pick_btn = tk.Button(
            row, text="STL 고르기", command=self.pick, relief="flat",
            bg="#F2F7FE", fg=BLUE, font=("Malgun Gothic", 9, "bold"),
            padx=12, pady=5, cursor="hand2",
        )
        self.pick_btn.pack(side="left")
        self.file_label = tk.Label(
            row, text="고른 파일 없음", bg="white", fg=DIM, font=("Malgun Gothic", 9),
        )
        self.file_label.pack(side="left", padx=10)

        ang = tk.Frame(self.root, bg="white")
        ang.pack(fill="x", padx=18, pady=(14, 0))
        tk.Label(ang, text="눕히는 각도", bg="white", fg=INK,
                 font=("Malgun Gothic", 9, "bold")).pack(side="left")
        self.rx = tk.StringVar(value=str(DEFAULT_RX))
        self.ry = tk.StringVar(value=str(DEFAULT_RY))
        for name, var in (("x", self.rx), ("y", self.ry)):
            tk.Label(ang, text=f"  {name}", bg="white", fg=SUB,
                     font=("Malgun Gothic", 9)).pack(side="left")
            tk.Entry(ang, textvariable=var, width=6, relief="solid", bd=1,
                     font=("Malgun Gothic", 9)).pack(side="left", padx=(2, 0))
        tk.Label(ang, text="°", bg="white", fg=SUB,
                 font=("Malgun Gothic", 9)).pack(side="left")

        self.go_btn = tk.Button(
            self.root, text="보내기", command=self.go, relief="flat",
            bg="#C9D6E5", fg="white", font=("Malgun Gothic", 10, "bold"),
            padx=16, pady=7, cursor="hand2", state="disabled",
            disabledforeground="#F2F5F8",
        )
        self.go_btn.pack(anchor="w", padx=18, pady=(16, 0))

        self.log = tk.Text(
            self.root, height=6, bg="#FAFBFC", fg=SUB, relief="flat",
            font=("Malgun Gothic", 9), wrap="word", state="disabled",
        )
        self.log.pack(fill="both", expand=True, padx=18, pady=(14, 16))

        self.order_id = order_id
        self.token = token

    # --- 말하기 ---

    def say(self, msg: str, bad: bool = False) -> None:
        def write() -> None:
            self.log.configure(state="normal")
            self.log.insert("end", msg + "\n")
            self.log.see("end")
            self.log.configure(state="disabled")
            if bad:
                self.log.configure(fg=RED)
        self.root.after(0, write)

    # --- 고르기 ---

    def pick(self) -> None:
        path = filedialog.askopenfilename(
            title="크라운 STL 고르기",
            initialdir=str(Path.home() / "Downloads"),
            filetypes=[("STL 파일", "*.stl"), ("모든 파일", "*.*")],
        )
        if not path:
            return
        self.stl = Path(path)
        self.file_label.configure(text=self.stl.name, fg=INK)
        self.go_btn.configure(state="normal", bg=BLUE)

    # --- 보내기 ---

    def go(self) -> None:
        if self.busy or not self.stl:
            return
        try:
            rx, ry = float(self.rx.get()), float(self.ry.get())
        except ValueError:
            self.say("각도는 숫자로 적어 주세요", bad=True)
            return

        self.busy = True
        self.go_btn.configure(state="disabled", text="보내는 중…")
        self.pick_btn.configure(state="disabled")
        threading.Thread(target=self._work, args=(rx, ry), daemon=True).start()

    def _work(self, rx: float, ry: float) -> None:
        from deliver import deliver  # noqa: PLC0415 — 창이 먼저 떠야 합니다

        out = Path.home() / "AppData" / "Roaming" / "DenFlow" / "출력준비"
        ok = deliver(
            self.stl, self.order_id, self.token, out, rx, ry, say=self.say,
        )
        self.code = 0 if ok else 1

        def done() -> None:
            self.go_btn.configure(text="닫기", state="normal", command=self.root.destroy)
            self.busy = False
            if ok:
                self.go_btn.configure(bg="#12855B")
        self.root.after(0, done)


def run_auto_print(order_id: str, token: str) -> int:
    win = Window(order_id, token)
    win.root.mainloop()
    return win.code
