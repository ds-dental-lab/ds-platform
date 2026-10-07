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
    python deliver.py 크라운.stl --order <주문 id> --token <토큰> --rx 135 --ry 0
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
from dentbird_case import check as check_case

BASE = __import__("os").environ.get("DENFLOW_BASE", "https://denflow.kr")  # 시험 때만 DENFLOW_BASE 로 바꿔 끼웁니다
SUPABASE_URL = "https://dzliwedyqkondvcwnvbh.supabase.co"
BUCKET = "order-files"

#: 주문에 올리는 세 가지. 자리를 먼저 받아야 해서 **이름을 미리** 들고 있습니다
#:   print   치과 프린터가 받는 것
#:   design  디자인 STL (기록)
#:   preview 놓인 모습 그림 (사람이 눈으로 잡는 자리)
ROLES = ("print", "design", "preview")


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

    # --- 치식과 자세 먼저 ---
    #
    # ★★ 자르기 전에 봅니다. 덴트버드가 `.constructionInfo` 에 치식과
    #   삽입축을 적어 줍니다. 치식이 어긋나면 **엉뚱한 이의 크라운**이
    #   치과에서 그대로 출력됩니다 — 자르고 올린 뒤에 알면 늦습니다.
    # ★ 「CAM 축에 좌표 정렬」을 끄고 내보내면 자세가 케이스마다 달라져
    #   고정 각도가 뜻을 잃습니다. 그것도 여기서 잡습니다.
    looked = check_case(stl)
    if not looked.ok:
        say(f"멈춤: {looked.message}")
        return False
    say(looked.message)

    # --- 올릴 자리 받기 (치식 대조가 여기서 일어납니다) ---
    #
    # ★ **자르기보다 먼저** 부릅니다. 서버가 주문서 치식과 견줘 막아 주는데,
    #   자른 뒤에 막히면 10초를 버립니다. 올리는 것은 뒤에 있으니 여기서
    #   멈춰도 저장소에는 아무것도 안 남습니다.
    url = f"{BASE}/api/device/print/deliver?t={urllib.parse.quote(token)}"
    opened = _post(
        url,
        {
            "orderId": order_id,
            "files": [{"role": r} for r in ROLES],
            # ★ 서버가 주문서 치식과 **다시** 견줍니다. 여기 것은 빨리
            #   알려주기 위한 것이고, 막는 쪽은 서버입니다.
            "teeth": looked.teeth,
        },
    )
    if not opened.get("ok"):
        say(f"자리를 못 받았습니다: {opened.get('error', '')}")
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
    assert set(local) == set(ROLES)

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
    ap.add_argument("--rx", type=float, default=DEFAULT_RX)
    ap.add_argument("--ry", type=float, default=DEFAULT_RY)
    ap.add_argument("--rz", type=float, default=DEFAULT_RZ)
    args = ap.parse_args(argv)

    ok = deliver(args.stl, args.order, args.token, args.out, args.rx, args.ry, args.rz)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
