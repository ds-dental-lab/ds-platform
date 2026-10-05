# -*- coding: utf-8 -*-
"""
DS Core 기공소 주문 읽기 (2026-10-05, 사용자 요청).

치과가 DS Core 로 보낸 주문을 **기공소 계정에서** 읽어 덴플로우 주문으로 잇기 위한
첫 조각입니다. 공식 API(open.dscore.com)는 신청해 둔 상태이고, 그 전까지 쓰는 다리입니다.

★★ **읽기만 합니다.** 그 화면에는 '수락 / 거부 / 완료 / 새 하도급 주문' 이 같이 있습니다.
  누를 것은 **줄(row)** 하나뿐이고, 누르기 전에 글자를 다시 확인합니다 — 잘못 누르면
  진짜 주문 상태가 바뀝니다.
★★ **생년월일은 안 가져옵니다** (사용자 결정 2026-10-02). 상세 화면에 보이지만 담지 않습니다.
★ 로그인은 **주문 전용 프로필**(chrome-profile-orders). dxd 변환이 쓰는 1번과 섞으면
  기공소 계정과 변환용 계정이 서로 덮어씁니다.
★ 화면을 긁는 방식이라 DS Core 가 화면을 바꾸면 깨집니다. 깨지면 logs/ 의 그림을 보고
  DESIGN.md §9 를 고치면 됩니다. 공식 API 가 열리면 이 파일은 버립니다.

사용:  python dscore_orders.py            받은 주문을 JSON 으로
       python dscore_orders.py --show     창을 보면서
       python dscore_orders.py --open     맨 위 주문으로 덴플로우 주문등록 창 열기
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import webbrowser
from dataclasses import dataclass, asdict, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from dscore import BASE, DSCore  # noqa: E402

#: 누르면 안 되는 것들 — 줄을 누를 때 이름으로 한 번 더 거릅니다
DANGER = ("수락", "거부", "완료", "삭제", "하도급")

#: 목록 표의 칸 — 상세로 안 들어가고도 이만큼 나옵니다 (실측 2026-10-05)
#: x 좌표로 가립니다. 창 너비가 바뀌면 같이 움직이므로 **순서**로 봅니다.
ROW_FIELDS = (
    "order_id", "status", "category", "service", "teeth_text",
    "clinic", "orderer", "patient", "created", "due",
)


@dataclass
class DsOrder:
    order_id: str = ""
    status: str = ""
    category: str = ""
    service: str = ""
    clinic: str = ""
    orderer: str = ""
    patient: str = ""
    created: str = ""
    due: str = ""
    #: '크라운 · 13, 12, 11' 을 쪼갠 것
    products: list[dict] = field(default_factory=list)
    teeth: list[int] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def parse_teeth_cell(text: str) -> tuple[list[dict], list[int]]:
    """
    '크라운 · 13, 12, 11' → ([{'product':'크라운','teeth':[11,12,13]}], [11,12,13])

    ★ 제품이 둘 이상이면 줄이 나뉘어 옵니다 ('크라운 · 13\\n인레이 · 26').
    ★ 치식으로 말이 되는 번호(11~48, 끝자리 1~8)만 둡니다 — 날짜·번호가 섞여도 안 들어옵니다.
    """
    products: list[dict] = []
    every: set[int] = set()

    for line in re.split(r"[\n;]+", text or ""):
        line = line.strip()
        if not line:
            continue

        name, _, rest = line.partition("·")
        if not rest:
            name, rest = "", line

        teeth = sorted({
            n for n in (int(x) for x in re.findall(r"\b(\d{2})\b", rest))
            if 11 <= n <= 48 and 1 <= n % 10 <= 8
        })
        if not teeth and not name.strip():
            continue

        products.append({"product": name.strip(), "teeth": teeth})
        every.update(teeth)

    return products, sorted(every)


def _leaves(d) -> list[tuple[str, int, int]]:
    """잎 노드만 — 화면에 적힌 글자 그대로 (글자, y, x)"""
    out: list[tuple[str, int, int]] = []
    for n in d.find_elements("css selector", "flt-semantics"):
        try:
            if n.find_elements("css selector", "flt-semantics"):
                continue
            t = (n.get_attribute("aria-label") or n.text or "").strip()
            if not t:
                continue
            r = n.rect
            out.append((t, int(r["y"]), int(r["x"])))
        except Exception:  # noqa: BLE001
            continue
    return out


def list_orders(core: DSCore, limit: int = 40) -> list[DsOrder]:
    """받은 주문 목록. 상세로 안 들어갑니다 — 목록 한 줄에 필요한 것이 다 있습니다."""
    d = core.d
    d.get(f"{BASE}/#/orders")
    time.sleep(7)
    core.enable_semantics()
    time.sleep(3)

    orders: list[DsOrder] = []

    for row in d.find_elements("css selector", "flt-semantics[flt-tappable]"):
        try:
            label = (row.get_attribute("aria-label") or row.text or "").strip()
            box = row.rect
        except Exception:  # noqa: BLE001
            continue

        # 줄은 높고(72) 여러 칸이 한 덩이로 들어옵니다. 단추는 짧고 한 낱말입니다
        if box["height"] < 40 or label.count("\n") < 5:
            continue
        if any(label.strip() == w for w in DANGER):
            continue

        cells = [c.strip() for c in label.split("\n") if c.strip()]
        # 맨 뒤의 아이콘 글자( 같은 것)는 버립니다
        cells = [c for c in cells if not (len(c) == 1 and ord(c) > 0xE000)]

        if len(cells) < len(ROW_FIELDS):
            continue

        raw = dict(zip(ROW_FIELDS, cells))
        products, teeth = parse_teeth_cell(raw.pop("teeth_text", ""))
        orders.append(DsOrder(**raw, products=products, teeth=teeth))

        if len(orders) >= limit:
            break

    return orders


SITE = "https://denflow.kr"


def denflow_url(order: DsOrder) -> str:
    """
    덴플로우 주문등록 화면 주소.

    ★ **채우기만** 합니다. 등록은 사람이 보고 누릅니다.
    ★ 치과는 안 넘깁니다 — 'DS치과' 가 덴플로우의 어느 치과인지는 아직 맺어 둔 것이
      없습니다. 화면에서 고르면 됩니다 (맺는 자리는 다음 차례).
    ★ 마감일은 날짜만 보냅니다. '2026-10-06 · 12:00' 의 시각은 덴플로우에 쓸 곳이 없습니다.
    """
    due = re.search(r"\d{4}-\d{2}-\d{2}", order.due or "")
    first = order.products[0]["product"] if order.products else ""

    query = {
        "ref": order.order_id,
        "source": "DS Core",
        "patient": order.patient,
        "teeth": ",".join(str(t) for t in order.teeth),
        "category": first,
        "due": due.group(0) if due else "",
    }
    clean = {k: v for k, v in query.items() if v}
    return f"{SITE}/design/orders/new?" + urllib.parse.urlencode(clean)


def main() -> None:
    core = DSCore(HERE / "logs", show="--show" in sys.argv, say=lambda m: print(m, file=sys.stderr), slot="orders")
    try:
        orders = list_orders(core)
        print(json.dumps([o.as_dict() for o in orders], ensure_ascii=False, indent=2))

        if "--open" in sys.argv and orders:
            url = denflow_url(orders[0])
            print(chr(10) + "주문등록 창:", url, file=sys.stderr)
            webbrowser.open(url)
    finally:
        try:
            core.d.quit()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    main()
