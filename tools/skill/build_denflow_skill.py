"""메모리 → DenFlow 스킬 (reference/ + claude.ai 업로드용 zip).

원본은 언제나 이 PC 의 Claude 메모리 폴더 하나입니다. 이 스크립트는
  1. 메모리 파일을 주제별 폴더로 복사하고 (세션 ID 같은 메타는 지움)
  2. 비밀값을 [가림] 으로 바꾸고, 하나라도 남으면 실패하고
  3. 목차(INDEX.md)를 만들고
  4. claude.ai 에 올릴 zip 을 만듭니다.

★ 메모리 폴더가 없는 PC(서버 PC)에서는 아무것도 지우지 않습니다 —
  저장소에 커밋된 reference/ 를 그대로 씁니다.

사용:
  python tools/skill/build_denflow_skill.py          # 빌드
  python tools/skill/build_denflow_skill.py --hook   # PostToolUse 훅 (stdin JSON)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILL = ROOT / ".claude" / "skills" / "denflow"
REF = SKILL / "reference"
DIST = ROOT / "tools" / "skill" / "dist"
ZIP = DIST / "denflow-skill.zip"
DEFAULT_MEMORY = (
    Path.home() / ".claude" / "projects" / "C--Users-DS-Desktop-ds-platform" / "memory"
)

# ── 주제 묶음 — 새 메모리가 생기면 여기에 한 줄 넣습니다 (없으면 99-기타) ──
GROUPS: dict[str, list[str]] = {
    "01-기본": [
        "ds-flow-working-style", "ds-flow-org-model", "ds-flow-spec-source",
        "ds-flow-backlog", "ds-flow-lab-secret", "ds-flow-skill-sync",
    ],
    "02-주문-상태": [
        "ds-flow-due-date-rule", "ds-flow-order-edit-rule", "ds-flow-product-model",
        "ds-flow-designer-seat", "ds-flow-design-center-order", "ds-flow-file-and-status",
        "ds-flow-remake-reason", "ds-flow-work-order", "ds-flow-fit-value",
        "ds-flow-file-name-mask",
    ],
    "03-정산-가격": [
        "ds-flow-billing-model", "ds-flow-price-isolation", "ds-flow-price-sheet",
    ],
    "04-권한-보안": [
        "ds-flow-member-roles", "ds-flow-signup-approval", "ds-flow-db-guards",
        "ds-flow-audit-log", "ds-flow-password-reset", "ds-flow-lab-sees-patient-name",
        "ds-flow-retention",
    ],
    "05-알림-화면": [
        "ds-flow-chat-and-alerts", "ds-flow-alimtalk", "ds-flow-home-and-notice",
        "ds-flow-shade-photo", "ds-flow-performance",
    ],
    "06-현장-자동화": [
        "ds-flow-fdm-print", "ds-flow-exocad", "ds-flow-agent-install-windows",
        "ds-flow-no-service-from-sandbox", "ds-flow-dentbird-terms",
    ],
    "07-운영-배포": [
        "ds-flow-deploy", "ds-flow-staging", "ds-flow-outage-playbook",
    ],
    "08-대외-법": [
        "ds-flow-terms", "ds-flow-privacy-policy", "ds-flow-business-registration",
        "ds-flow-homepage", "ds-flow-seo", "ds-flow-reference-sites",
    ],
}
OTHER = "99-기타"

MASK = "[가림]"

# ── 비밀값 — 값 자체를 가리는 규칙 ──
# 알려진 고정값(에이전트 내려받기 번호 등)은 SECRET_LITERALS 에,
# 모양으로 잡을 수 있는 것은 SECRET_PATTERNS 에 둡니다.
SECRET_LITERALS = ["910930"]
SECRET_PATTERNS = [
    # 에이전트 내려받기 번호 — 'AGENT_DOWNLOAD_PIN … 123456' 처럼 이름 뒤에 붙은 6자리
    re.compile(r"(?<=AGENT_DOWNLOAD_PIN)([^\n]{0,60}?)\b\d{6}\b"),
    re.compile(r"(?i)(?<=PIN)([^\n]{0,20}?)\b\d{6}\b"),
    re.compile(r"eyJ[A-Za-z0-9_\-]{20,}(?:\.[A-Za-z0-9_\-]+){0,2}"),  # JWT
    re.compile(r"\bsk_(?:live|test)_[A-Za-z0-9]{10,}"),
    re.compile(r"\bre_[A-Za-z0-9]{16,}"),  # Resend
    re.compile(r"\bsbp_[A-Za-z0-9]{20,}"),  # Supabase 개인 토큰
    re.compile(r"\b[0-9a-fA-F]{40,}\b"),  # 긴 16진 열쇠
]


def env_secrets(root: Path = ROOT) -> list[str]:
    """.env.local 의 값들 — 출력에 하나라도 나오면 실패시키는 데만 씁니다 (출력 안 함)."""
    p = root / ".env.local"
    if not p.exists():
        return []
    out: list[str] = []
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        val = line.split("=", 1)[1].strip().strip('"').strip("'")
        # 짧은 값·주소·참/거짓은 비밀이 아니고 본문 단어와 겹칩니다
        if len(val) < 12 or val.startswith("http") or val.lower() in ("true", "false"):
            continue
        out.append(val)
    return out


def redact(text: str) -> str:
    for lit in SECRET_LITERALS:
        text = text.replace(lit, MASK)
    for pat in SECRET_PATTERNS:
        if pat.groups:
            text = pat.sub(lambda m: m.group(1) + MASK, text)
        else:
            text = pat.sub(MASK, text)
    return text


def leaks(text: str, extra: list[str]) -> list[str]:
    """가린 뒤에도 남은 비밀 — 어느 규칙에 걸렸는지만 돌려줍니다 (값은 안 돌려줌)."""
    found: list[str] = []
    for lit in SECRET_LITERALS:
        if lit in text:
            found.append("고정값")
    for i, pat in enumerate(SECRET_PATTERNS):
        for m in pat.finditer(text):
            if MASK not in m.group(0):
                found.append(f"모양 {i}")
                break
    for val in extra:
        if val in text:
            found.append(".env.local 값")
    return found


FRONT = re.compile(r"\A---\n(.*?)\n---\n?", re.S)


def clean_frontmatter(text: str) -> str:
    """name·description·type 만 남깁니다 (originSessionId·modified·node_type 제거)."""
    text = text.replace("\r\n", "\n")
    m = FRONT.match(text)
    if not m:
        return text
    keep: dict[str, str] = {}
    for line in m.group(1).splitlines():
        s = line.strip()
        for key in ("name", "description", "type"):
            if s.startswith(key + ":") and key not in keep:
                keep[key] = s[len(key) + 1:].strip()
    head = "---\n" + "".join(f"{k}: {keep[k]}\n" for k in ("name", "description", "type") if k in keep) + "---\n"
    return head + text[m.end():]


def group_of(stem: str) -> str:
    for g, names in GROUPS.items():
        if stem in names:
            return g
    return OTHER


INDEX_LINE = re.compile(r"^- \[(?P<title>[^\]]+)\]\((?P<file>[^)]+\.md)\)\s*[—-]\s*(?P<hook>.*)$")


def build_index(memory_index: str, placed: dict[str, str]) -> str:
    """MEMORY.md 의 한 줄 목차를 주제별로 다시 묶습니다."""
    by_group: dict[str, list[str]] = {}
    seen: set[str] = set()
    for line in memory_index.splitlines():
        m = INDEX_LINE.match(line.strip())
        if not m:
            continue
        stem = Path(m["file"]).stem
        if stem not in placed:
            continue
        seen.add(stem)
        g = placed[stem]
        by_group.setdefault(g, []).append(f"- [{m['title']}]({g}/{stem}.md) — {m['hook']}")
    for stem, g in placed.items():  # 목차에 없는 파일도 빠뜨리지 않음
        if stem not in seen:
            by_group.setdefault(g, []).append(f"- [{stem}]({g}/{stem}.md)")
    out = [
        "# DenFlow 기록 목차",
        "",
        "생성 파일입니다 — 손으로 고치지 마세요. 원본은 PC 의 Claude 메모리,",
        "만드는 것은 `tools/skill/build_denflow_skill.py` 입니다.",
        "본문의 `[[ds-flow-xxx]]` 는 이 목차의 같은 이름 파일을 가리킵니다.",
        "",
    ]
    for g in sorted(by_group):
        out += [f"## {g}", "", *by_group[g], ""]
    return "\n".join(out)


def build(memory: Path, skill: Path = SKILL, zip_path: Path | None = ZIP,
          extra_secrets: list[str] | None = None) -> dict:
    if not memory.is_dir():
        return {"ok": True, "skipped": f"메모리 폴더 없음 — reference/ 그대로 둠 ({memory})"}
    extra = env_secrets() if extra_secrets is None else extra_secrets
    files = sorted(p for p in memory.glob("*.md") if p.name != "MEMORY.md")

    rendered: dict[str, tuple[str, str]] = {}  # stem → (group, text)
    problems: list[str] = []
    for p in files:
        text = redact(clean_frontmatter(p.read_text(encoding="utf-8")))
        bad = leaks(text, extra)
        if bad:
            problems.append(f"{p.name}: {', '.join(sorted(set(bad)))}")
        rendered[p.stem] = (group_of(p.stem), text)
    if problems:
        # ★ 하나라도 새면 아무것도 쓰지 않습니다 (이전 reference/ 유지)
        return {"ok": False, "leaks": problems}

    ref = skill / "reference"
    if ref.exists():
        shutil.rmtree(ref)
    ref.mkdir(parents=True)
    for stem, (g, text) in rendered.items():
        (ref / g).mkdir(exist_ok=True)
        (ref / g / f"{stem}.md").write_text(text, encoding="utf-8", newline="\n")

    idx_src = memory / "MEMORY.md"
    idx = build_index(idx_src.read_text(encoding="utf-8") if idx_src.exists() else "",
                      {s: g for s, (g, _) in rendered.items()})
    idx = redact(idx)
    (ref / "INDEX.md").write_text(idx, encoding="utf-8", newline="\n")

    others = sorted(s for s, (g, _) in rendered.items() if g == OTHER)
    if zip_path is not None:
        make_zip(skill, zip_path)
    return {"ok": True, "files": len(rendered), "unsorted": others,
            "zip": str(zip_path) if zip_path else None}


def make_zip(skill: Path, zip_path: Path) -> None:
    """claude.ai 업로드용 — 안에 denflow/SKILL.md 가 맨 위에 오게."""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(skill.rglob("*")):
            if p.is_file():
                z.write(p, "denflow/" + p.relative_to(skill).as_posix())


def memory_dir() -> Path:
    return Path(os.environ.get("DENFLOW_MEMORY") or DEFAULT_MEMORY)


def hook_main() -> int:
    """PostToolUse — 메모리 폴더의 .md 를 고쳤을 때만 다시 만듭니다. 도구를 막지 않습니다."""
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return 0
    inp = data.get("tool_input") or {}
    fp = str(inp.get("file_path") or "")
    mem = memory_dir()
    try:
        hit = fp.lower().endswith(".md") and Path(fp).resolve().parent == mem.resolve()
    except OSError:
        hit = False
    if not hit:
        return 0
    res = build(mem)
    if res.get("ok"):
        msg = f"DenFlow 스킬 다시 만듦 ({res.get('files', 0)}개)"
        if res.get("unsorted"):
            msg += f" — 주제 미지정: {', '.join(res['unsorted'])}"
    else:
        msg = "DenFlow 스킬 빌드 멈춤 — 비밀값이 남음: " + "; ".join(res["leaks"])
    print(json.dumps({"systemMessage": msg}, ensure_ascii=False))
    return 0


def main() -> int:
    if "--hook" in sys.argv:
        return hook_main()
    res = build(memory_dir())
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
