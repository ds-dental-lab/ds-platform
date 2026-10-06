# -*- coding: utf-8 -*-
r"""
에이전트를 치과가 받을 수 있는 자리에 올립니다 (2026-10-06).

    build-exe.cmd  →  dist\덴플로우 에이전트\  →  (여기)  →  agent-release/latest.zip

치과는 denflow.kr/agent 에서 그 zip 을 받습니다.

★ **판 번호가 세 군데**입니다 — scan_agent.py · domain/agent · 올라간 파일.
  올리기 전에 앞의 둘이 같은지 봅니다. 어긋난 채 올리면 모든 치과에
  "새 판이 있습니다" 가 영원히 뜨거나, 새 판을 내놓고도 아무도 모릅니다.

★ 열쇠는 `.env.local` 에서 읽습니다. 이 파일에 적지 않습니다 (gitignore).

★ 두 벌을 올립니다 — `latest.zip`(치과가 받는 것)과 판 번호가 붙은 벌.
  뒤엣것은 되돌릴 일이 생겼을 때 씁니다.

쓰기:
    python release.py            올릴 것을 보여만 줍니다
    python release.py --upload   실제로 올립니다
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DIST = HERE / "dist" / "덴플로우 에이전트"
BUCKET = "agent-release"


def env(name: str) -> str:
    """`.env.local` 에서 한 줄 읽기"""
    f = ROOT / ".env.local"
    if not f.exists():
        raise SystemExit(f"{f} 가 없습니다")
    for line in f.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"{name} 을 찾지 못했습니다")


def versions() -> tuple[str, str]:
    """(에이전트, 서버) 판 번호"""
    py = (HERE / "scan_agent.py").read_text(encoding="utf-8")
    ts = (ROOT / "src" / "server" / "domain" / "agent" / "index.ts").read_text(encoding="utf-8")

    a = re.search(r"^AGENT_VERSION\s*=\s*[\"']([\d.]+)[\"']", py, re.M)
    b = re.search(r"AGENT_VERSION\s*=\s*'([\d.]+)'", ts)
    if not a or not b:
        raise SystemExit("판 번호를 못 읽었습니다")
    return a.group(1), b.group(1)


def make_zip(out: Path) -> Path:
    """
    dist 폴더를 통째로 묶습니다.

    ★ 폴더 이름까지 넣습니다 — 치과가 풀면 「덴플로우 에이전트」 폴더가
      그대로 나와 쓰던 자리에 덮기만 하면 됩니다.
    """
    if not DIST.is_dir():
        raise SystemExit(f"빌드가 없습니다: {DIST}\n  먼저 build-exe.cmd 를 돌려 주세요")

    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(DIST.rglob("*")):
            if f.is_file():
                z.write(f, Path(DIST.name) / f.relative_to(DIST))
    return out


def upload(zip_path: Path, name: str) -> None:
    url = f"{env('NEXT_PUBLIC_SUPABASE_URL')}/storage/v1/object/{BUCKET}/{name}"
    key = env("SUPABASE_SERVICE_ROLE_KEY")

    with open(zip_path, "rb") as f:
        req = urllib.request.Request(url, data=f, method="POST")
        req.add_header("authorization", f"Bearer {key}")
        req.add_header("content-type", "application/zip")
        req.add_header("content-length", str(zip_path.stat().st_size))
        req.add_header("x-upsert", "true")   # 같은 이름이면 덮어씁니다
        try:
            with urllib.request.urlopen(req, timeout=60 * 10) as res:
                if res.status not in (200, 201):
                    raise SystemExit(f"{name}: 서버가 {res.status}")
        except urllib.error.HTTPError as e:
            raise SystemExit(f"{name}: {e.code} {e.read().decode('utf-8', 'replace')[:200]}") from None

    print(f"  올림  {name}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="에이전트 올리기")
    ap.add_argument("--upload", action="store_true", help="실제로 올립니다")
    args = ap.parse_args(argv)

    agent_v, server_v = versions()
    if agent_v != server_v:
        print(
            f"판 번호가 어긋납니다 — scan_agent.py={agent_v} / domain/agent={server_v}\n"
            "  둘을 같게 맞춘 뒤에 올려 주세요.",
            file=sys.stderr,
        )
        return 1

    staged = HERE / "dist" / f"덴플로우 에이전트 {agent_v}.zip"
    make_zip(staged)
    size = staged.stat().st_size

    print(f"판 {agent_v} · {size:,} 바이트")
    print(f"  {staged}")

    if not args.upload:
        print("\n올리려면 --upload 를 붙여 주세요")
        return 0

    print("\n올리는 중…")
    upload(staged, "latest.zip")
    upload(staged, f"{agent_v}.zip")

    base = env("NEXT_PUBLIC_SUPABASE_URL")
    print(f"\n받는 주소 : {base}/storage/v1/object/public/{BUCKET}/latest.zip")
    print("치과 안내 : https://denflow.kr/agent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
