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


def upload_scans(order_id: str, token: str, paths: list[Path], say=print) -> bool:
    """
    DS Core 에서 바꾼 ply 를 **주문에 스캔으로** 올립니다 (2026-10-22).
    ★ 크라운 런처가 이 ply 를 보고 DS Core 를 건너뛰게 — 시로나 dxd 가 두 번 다녀오던 것을 한 번으로.
    ★ 못 올려도 설계는 계속합니다 — 되돌려 올리기는 덤이지 조건이 아닙니다.
    """
    if not paths or not token:
        return False
    url = f"{BASE}/api/device/print/deliver?t={urllib.parse.quote(token)}"
    opened = _post(url, {"orderId": order_id, "scan": True, "files": [{"name": p.name, "size": p.stat().st_size} for p in paths]})
    if not opened.get("ok"):
        say(f"바꾼 스캔을 되돌려 올릴 자리를 못 받았습니다: {opened.get('error', '')}")
        return False
    by_name = {p.name: p for p in paths}
    done_files = []
    for slot in opened["slots"]:
        p = by_name.get(slot["name"])
        if not p or not put_file(p, slot["path"], slot["token"]):
            say(f"되돌려 올리지 못했습니다: {slot['name']}")
            return False
        done_files.append({"path": slot["path"], "name": slot["name"], "size": p.stat().st_size})
    got = _post(url, {"orderId": order_id, "scan": True, "done": True, "files": done_files})
    if not got.get("ok"):
        say(f"되돌려 올린 스캔을 적지 못했습니다: {got.get('error', '')}")
        return False
    say(f"바꾼 스캔 {len(done_files)}개를 주문에 올렸습니다 — 크라운 쪽은 DS Core 를 건너뜁니다")
    return True


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
    layer: float | None = None,
    reslice_teeth: list[int] | None = None,
    process_extra: dict | None = None,
) -> bool:
    """
    ★ `reslice_teeth` 를 주면 **다시 뽑기용 다시 자르기**입니다 (사용자 2026-10-23
      "다시 뽑을 때도 자리 바꿔서"). stl 은 지난번에 올린 '놓인' STL 이라
      이미 돌아가 있습니다 — 각도는 0, 자리만 다음 칸으로 옮깁니다.
      .constructionInfo 가 없으니 치식은 서버가 준 것으로 견주고,
      출력 파일 하나만 올립니다(디자인 STL·그림을 또 올리면 주문 파일이 쌓입니다).
    """
    reslice = reslice_teeth is not None
    roles = ("print",) if reslice else ROLES
    if reslice:
        rx = ry = rz = 0.0

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
    if reslice:
        teeth = list(reslice_teeth or [])
        say(f"다시 자르기 — 치식 {'·'.join(str(t) for t in teeth) or '?'}")
    else:
        looked = check_case(stl)
        if not looked.ok:
            say(f"멈춤: {looked.message}")
            return False
        say(looked.message)
        teeth = looked.teeth

        # --- 벽 두께 (2026-10-28) ---
        # ★ 27번 PLA 출력품에 구멍이 났는데 메쉬는 닫혀 있었습니다 — 벽이 노즐 선폭보다
        #   얇았던 것입니다. 자르기 전에 재서 기록에 남깁니다. **막지는 않습니다** —
        #   몇 건 쌓인 뒤 막을지 정합니다. 2천 점에 몇 초(60k 면 STL 에 8초).
        try:
            from thickness import measure_file  # noqa: PLC0415

            th = measure_file(stl)
            say(("★ " if th.risky() else "") + th.describe())
        except Exception as e:  # noqa: BLE001 — 재기가 실패해도 자르기는 갑니다
            say(f"(두께를 못 쟀습니다 — {e})")

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
            "files": [{"role": r} for r in roles],
            # ★ 서버가 주문서 치식과 **다시** 견줍니다. 여기 것은 빨리
            #   알려주기 위한 것이고, 막는 쪽은 서버입니다.
            "teeth": teeth,
        },
    )
    if not opened.get("ok"):
        say(f"자리를 못 받았습니다: {opened.get('error', '')}")
        return False

    # --- 돌리고 자르기 ---
    # ★ 판 위 자리를 돌립니다 — 안 비운 판에 또 뽑아도 바로 앞 것과 안 겹치게 (2026-10-21)
    from plate_slot import take as take_slot  # noqa: PLC0415
    slot = take_slot()
    say(f"자르는 중… (x {rx}° / y {ry}°, {slot.label})")
    try:
        # ★ --layer 는 이번 한 건만 (기본 0.16 은 orca_profile.DENTAL)
        extra = {"layer_height": f"{layer:g}"} if layer else None
        # ★ 한 번만 바꿔 보는 값 (temp_watch 의 oneshot, 2026-10-23)
        if process_extra:
            extra = {**(extra or {}), **process_extra}
        made = build(
            stl, out_dir, *prof.as_tuple(), rx=rx, ry=ry, rz=rz, stem=order_id,
            process_extra=extra, at=(slot.x, slot.y), purge=slot.purge,
        )
    except (SliceError, ValueError) as e:
        say(f"실패: {e}")
        return False

    say(f"잘랐습니다 — {made['layers']}층 · {made['print_time']} · 층 높이 {made.get('layer_height')}")

    local = {
        "print": Path(made["print_file"]),
        "design": Path(made["stl"]),
        "preview": Path(made["preview"]),
    }
    assert set(local) == set(ROLES)
    local = {r: local[r] for r in roles}

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
            # ★ 다시 자르기는 각도를 안 바꿨으니 안 보냅니다 — 0 으로 덮어쓰면 기록이 틀어집니다
            **({} if reslice else {"rotate": {"x": rx, "y": ry, "z": rz}}),
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
    ap.add_argument("--layer", type=float, help="이번 한 건만 층 높이 (예: 0.12). 안 주면 기본 0.16")
    args = ap.parse_args(argv)

    ok = deliver(args.stl, args.order, args.token, args.out, args.rx, args.ry, args.rz, layer=args.layer)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
