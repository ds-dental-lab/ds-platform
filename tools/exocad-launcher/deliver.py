# -*- coding: utf-8 -*-
"""
기공소 PC — 덴트버드 STL 하나를 주문에 얹어 출력까지 보냅니다 (2026-10-06).

    STL  →  돌리기·자르기  →  덴플로우 주문에 올리기  →  '출력 대기'
                                 (출력 파일 · 디자인 STL · 놓인 모습)

그 뒤는 치과가 「비웠습니다」를 누르면 치과 PC 가 알아서 가져갑니다.

★ 세 가지를 함께 올립니다. 디자인 STL 과 그림은 **기록**입니다
  (사용자 2026-10-06 — "기록이 있으면 좋을거같아서"). 무엇을 어떤 각도로
  뽑았는지 나중에 확인할 수 있어야 하고, 그림은 서포트가 교합면에 붙는 것을
  사람이 눈으로 잡을 유일한 자리입니다.

★ 파일은 덴플로우 서버를 지나가지 않습니다. 저장소 서명 주소로 바로 올립니다.

혼자 돌려 보기:
    python deliver.py 크라운.stl --order <주문 id> --token <토큰> --rx 150 --ry 140
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from slice_job import SliceError, build
from orca_profile import pick, ready

BASE = __import__("os").environ.get("DENFLOW_BASE", "https://denflow.kr")  # 시험 때만 DENFLOW_BASE 로 바꿔 끼웁니다
SUPABASE_URL = "https://dzliwedyqkondvcwnvbh.supabase.co"
BUCKET = "order-files"


def _post(url: str, body: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8", "replace"))
        except (ValueError, OSError):
            return {"ok": False, "error": f"서버가 {e.code} 로 답했습니다"}
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"ok": False, "error": f"서버에 닿지 못했습니다 — {e}"}


def put_file(path: Path, storage_path: str, token: str) -> bool:
    """저장소가 내준 자리로 바로 올립니다"""
    url = (
        f"{SUPABASE_URL}/storage/v1/object/upload/sign/"
        f"{BUCKET}/{urllib.parse.quote(storage_path)}?token={token}"
    )
    with open(path, "rb") as f:
        req = urllib.request.Request(url, data=f, method="PUT")
        req.add_header("content-type", "application/octet-stream")
        req.add_header("content-length", str(path.stat().st_size))
        try:
            with urllib.request.urlopen(req, timeout=60 * 30) as res:
                return res.status in (200, 201)
        except (urllib.error.URLError, TimeoutError, OSError):
            return False


def deliver(
    stl: Path,
    order_id: str,
    token: str,
    out_dir: Path,
    rx: float,
    ry: float,
    rz: float = 0.0,
    say=print,
) -> bool:
    if not ready():
        say("오르카를 한 번 켜 주세요 (첫 실행에서 설정이 만들어집니다)")
        return False

    prof = pick()
    if prof.missing():
        say("프로파일이 없습니다: " + ", ".join(p.name for p in prof.missing()))
        return False

    # --- 돌리고 자르기 ---
    say(f"자르는 중… (x {rx}° / y {ry}°)")
    try:
        made = build(stl, out_dir, *prof.as_tuple(), rx=rx, ry=ry, rz=rz, stem=order_id)
    except (SliceError, ValueError) as e:
        say(f"실패: {e}")
        return False

    say(f"잘랐습니다 — {made['layers']}층 · {made['print_time']}")

    local = {
        "print": Path(made["print_file"]),
        "design": Path(made["stl"]),
        "preview": Path(made["preview"]),
    }

    # --- 올릴 자리 받기 ---
    url = f"{BASE}/api/device/print/deliver?t={urllib.parse.quote(token)}"
    opened = _post(url, {"orderId": order_id, "files": [{"role": r} for r in local]})
    if not opened.get("ok"):
        say(f"자리를 못 받았습니다: {opened.get('error', '')}")
        return False

    # --- 올리기 ---
    uploaded = []
    for slot in opened["slots"]:
        path = local[slot["role"]]
        if not put_file(path, slot["path"], slot["token"]):
            say(f"올리지 못했습니다: {path.name}")
            return False
        uploaded.append(
            {
                "role": slot["role"],
                "path": slot["path"],
                "name": slot["name"],
                "size": path.stat().st_size,
            }
        )
        say(f"  올림 {slot['name']} ({path.stat().st_size:,} 바이트)")

    # --- 다 올렸다고 알리기 ---
    done = _post(
        url,
        {
            "orderId": order_id,
            "done": True,
            "files": uploaded,
            "rotate": {"x": rx, "y": ry, "z": rz},
            "facts": {k: made[k] for k in ("layers", "print_time", "slicer", "size")},
        },
    )
    if not done.get("ok"):
        say(f"마무리하지 못했습니다: {done.get('error', '')}")
        return False

    say("출력 대기로 넘겼습니다 — 치과가 출력판을 비우면 시작됩니다")
    return True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="STL 을 주문에 얹어 출력까지")
    ap.add_argument("stl", type=Path)
    ap.add_argument("--order", required=True, help="주문 id")
    ap.add_argument("--token", required=True, help="주문별 토큰")
    ap.add_argument("--out", type=Path, default=Path("출력준비"))
    ap.add_argument("--rx", type=float, default=150.0)
    ap.add_argument("--ry", type=float, default=140.0)
    ap.add_argument("--rz", type=float, default=0.0)
    args = ap.parse_args(argv)

    ok = deliver(args.stl, args.order, args.token, args.out, args.rx, args.ry, args.rz)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
