"""build_denflow_skill 시험 — python tools/skill/test_build_denflow_skill.py"""
from __future__ import annotations

import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_denflow_skill as b  # noqa: E402

FAILS: list[str] = []


def check(name: str, cond: bool) -> None:
    print(("ok   " if cond else "FAIL ") + name)
    if not cond:
        FAILS.append(name)


MEM_FILE = """---
name: ds-flow-agent-install-windows
description: 설치
metadata:
  node_type: memory
  type: project
  originSessionId: abc-123
  modified: 2026-10-19T00:00:00Z
---
env `AGENT_DOWNLOAD_PIN`(.env.local 에 910930) 그리고 번호 PIN 123456.
주문 ORD-261019-004 은 그대로. 커밋 678d3ea 도 그대로.
열쇠 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def
"""

with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    mem = t / "memory"
    mem.mkdir()
    (mem / "ds-flow-agent-install-windows.md").write_text(MEM_FILE, encoding="utf-8")
    (mem / "ds-flow-new-thing.md").write_text("---\nname: ds-flow-new-thing\n---\n본문\n", encoding="utf-8")
    (mem / "MEMORY.md").write_text(
        "- [에이전트 설치](ds-flow-agent-install-windows.md) — 차단 해제\n", encoding="utf-8")
    skill = t / "skill"
    skill.mkdir()
    (skill / "SKILL.md").write_text("---\nname: denflow\n---\n", encoding="utf-8")
    zp = t / "out" / "denflow-skill.zip"

    res = b.build(mem, skill, zp, extra_secrets=["super-secret-value-xyz"])
    check("빌드 성공", res["ok"] is True)
    out = (skill / "reference" / "06-현장-자동화" / "ds-flow-agent-install-windows.md").read_text(encoding="utf-8")
    check("고정 PIN 가림", "910930" not in out)
    check("PIN 뒤 6자리 가림", "123456" not in out)
    check("JWT 가림", "eyJhbGci" not in out)
    check("주문번호·커밋은 남김", "ORD-261019-004" in out and "678d3ea" in out)
    check("세션 ID 지움", "originSessionId" not in out and "abc-123" not in out)
    check("type 은 남김", "type: project" in out)
    check("주제 미지정은 99-기타", res["unsorted"] == ["ds-flow-new-thing"]
          and (skill / "reference" / "99-기타" / "ds-flow-new-thing.md").exists())
    idx = (skill / "reference" / "INDEX.md").read_text(encoding="utf-8")
    check("목차에 주제 경로", "(06-현장-자동화/ds-flow-agent-install-windows.md)" in idx)
    check("목차에 없는 파일도 실림", "99-기타/ds-flow-new-thing.md" in idx)
    with zipfile.ZipFile(zp) as z:
        names = z.namelist()
    check("zip 맨 위 denflow/SKILL.md", "denflow/SKILL.md" in names)
    check("zip 에 reference", any(n.startswith("denflow/reference/") for n in names))

    # .env.local 값이 본문에 있으면 실패하고 기존 reference 를 지우지 않음
    (mem / "ds-flow-leak.md").write_text("---\nname: x\n---\n값 super-secret-value-xyz\n", encoding="utf-8")
    res2 = b.build(mem, skill, zp, extra_secrets=["super-secret-value-xyz"])
    check("env 값 새면 실패", res2["ok"] is False and "ds-flow-leak.md" in res2["leaks"][0])
    check("실패 땐 이전 reference 유지",
          (skill / "reference" / "06-현장-자동화" / "ds-flow-agent-install-windows.md").exists())
    check("실패 메시지에 값 없음", "super-secret" not in str(res2))

    # 메모리 폴더 없는 PC — 아무것도 안 지움
    res3 = b.build(t / "없음", skill, zp)
    check("메모리 없으면 건너뜀", res3["ok"] and "skipped" in res3
          and (skill / "reference" / "INDEX.md").exists())

print()
print("전부 통과" if not FAILS else f"{len(FAILS)}개 실패")
sys.exit(1 if FAILS else 0)
