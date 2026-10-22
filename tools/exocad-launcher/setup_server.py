# -*- coding: utf-8 -*-
r"""서버 PC 를 '항상 켜 두는 설계 PC' 로 묶습니다 (2026-10-20).

    python setup_server.py            차례대로 묻고 넣습니다
    python setup_server.py --check    빠진 것만 보여 줍니다

서버 PC 가 맡는 것: **설계 일꾼(design_worker) · 임시치아 지켜보기(temp_watch)**.
exocad 지켜보기는 exocad 가 있는 디자인 PC 에 남깁니다 — 두 PC 가 같은 일을 맡으면
한 건을 둘이 집습니다 (2026-10-20 exocad 케이스가 둘씩 생긴 까닭과 같은 모양).

★ 비밀번호는 아무것도 안 받습니다. 덴트버드는 띄워 주는 크롬 창에서 사람이 로그인합니다.
★ 설계 열쇠(6자리 코드)는 덴플로우 **계정정보 → 설계 PC 연결** 에서 받습니다. 10분 살고 한 번 씁니다.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

SERVER_WATCHERS = ["design_worker", "temp_watch"]


def hr(title: str) -> None:
    print()
    print("=" * 60)
    print(title)
    print("=" * 60)


def step_packages() -> None:
    hr("1. 파이썬 꾸러미")
    missing = []
    for mod in ("requests", "selenium", "numpy", "PIL"):
        try:
            __import__(mod)
        except ImportError:
            missing.append("pillow" if mod == "PIL" else mod)
    if missing:
        print("넣습니다:", ", ".join(missing))
        subprocess.check_call([sys.executable, "-m", "pip", "install", *missing])
    else:
        print("다 있습니다")


def step_orca() -> bool:
    hr("2. 오르카 슬라이서")
    from orca_profile import ORCA_DIR, ready  # noqa: PLC0415

    exe = ORCA_DIR / "orca-slicer.exe"
    if not exe.is_file():
        print(f"★ 오르카가 없습니다: {exe}")
        print("  winget install -e --id SoftFever.OrcaSlicer 로 넣고 다시 돌리세요")
        return False
    if ready():
        print("설정 파일 있음 — 됐습니다")
        return True
    print("오르카를 한 번 켜서 첫 설정(프린터 Bambu A1 mini 고르기)을 마치고 닫아 주세요.")
    input("닫았으면 Enter: ")
    if ready():
        print("됐습니다")
        return True
    print("★ 아직 설정 파일이 없습니다 — 다음에 --check 로 다시 보세요")
    return False


def step_link() -> bool:
    hr("3. 덴플로우 설계 PC 열쇠")
    import link_design  # noqa: PLC0415

    if link_design.OUT.is_file():
        print(f"이미 있습니다: {link_design.OUT}")
        if input("새 코드로 바꿀까요? (y/N): ").strip().lower() != "y":
            return True
    print("덴플로우 → 계정정보 → '설계 PC 연결' 에서 여섯 자리 코드를 받으세요 (10분 안에).")
    code = input("코드: ").strip()
    if not code:
        print("건너뜁니다 — 나중에 python link_design.py <코드>")
        return False
    sys.argv = ["link_design.py", code]
    return link_design.main() == 0


def step_dscore() -> bool:
    """시로나 치과 dxd → ply 변환용 DS Core 계정 (선택). 값은 이 PC 의 settings.json 에만 남습니다"""
    hr("3-1. DS Core 계정 (시로나 dxd 변환용, 선택)")
    import dscore  # noqa: PLC0415
    import getpass  # noqa: PLC0415

    if dscore.has_settings():
        print(f"이미 있습니다: {dscore.SETTINGS}")
        if input("다시 넣을까요? (y/N): ").strip().lower() != "y":
            return True
    print("시로나 치과(dxd)가 없으면 비워 두고 Enter.")
    email = input("DS Core 이메일: ").strip()
    if not email:
        print("건너뜁니다 — 나중에 python setup_server.py --dscore")
        return False
    password = getpass.getpass("DS Core 비밀번호 (화면에 안 보임): ")
    dscore.save_settings(email, password)
    print(f"저장했습니다: {dscore.SETTINGS}")
    # ★ 새 PC 의 빈 프로필 자동 로그인은 자주 틀어집니다 — 첫 한 번은 창에서 사람이 (2026-10-22)
    print("크롬 창을 띄웁니다 — 거기서 한 번 로그인해 주세요.")
    return dscore.login_by_hand()


def step_chrome() -> None:
    hr("4. 덴트버드 전용 크롬")
    from dentbird_web import HOME_URL, PROFILE, open_browser  # noqa: PLC0415

    print(f"전용 프로필: {PROFILE}")
    open_browser(HOME_URL)
    print()
    print("그 창에서 할 것 셋:")
    print("  ① 덴트버드에 로그인 (서버 전용 계정)")
    print("  ② 주소창에 chrome://settings/content/automaticDownloads → '허용' 에 ai.dentbird.com 추가")
    print("     (안 하면 내보내기에서 크라운만 오고 정보 파일이 막힙니다 — 2026-10-19)")
    print("  ③ 창은 닫지 말고 최소화만 — 일꾼이 이 창을 씁니다")
    input("마쳤으면 Enter: ")


def step_startup() -> None:
    hr("5. 시작프로그램 (설계 일꾼 · 임시치아 지켜보기)")
    import install_watch  # noqa: PLC0415

    sys.argv = ["install_watch.py", "--only", *SERVER_WATCHERS]
    install_watch.main()
    print("재부팅하면 45초 뒤에 둘이 스스로 뜹니다. 지금 띄우려면 시작프로그램 폴더의 vbs 를 두 번 누르세요.")


def step_check() -> list[str]:
    hr("점검")
    from watch_common import expected_scripts, preflight  # noqa: PLC0415

    missing = preflight()
    print("이 PC 가 맡은 것:", ", ".join(expected_scripts()) or "없음")
    if missing:
        print("★ 빠진 것:")
        for m in missing:
            print("  -", m)
    else:
        print("빠진 것 없음")
    return missing


def remind() -> None:
    hr("윈도우 쪽에서 직접 할 것")
    print("  - 설정 → 시스템 → 전원: 화면 끄기·절전 '안 함'")
    print("  - 자동 로그인 (netplwiz 에서 '사용자 이름과 암호를 입력해야' 끄기) — 재부팅 뒤 사람 없이 뜨게")
    print("  - 원격 접속(크롬 원격 데스크톱 등) — 모니터를 떼고 나면 이걸로 들어옵니다")
    print("  - 디자인 PC 에서는 python install_watch.py --off --only design_worker temp_watch 로 둘을 빼세요")


def main() -> int:
    if os.name != "nt":
        print("윈도우에서 돌리세요")
        return 1
    if "--check" in sys.argv:
        return 1 if step_check() else 0
    if "--dscore" in sys.argv:
        return 0 if step_dscore() else 1
    step_packages()
    step_orca()
    step_link()
    step_dscore()
    step_chrome()
    step_startup()
    missing = step_check()
    remind()
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
