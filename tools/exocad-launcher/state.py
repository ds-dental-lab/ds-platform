# -*- coding: utf-8 -*-
r"""
런처가 **적어 두는 것**이 사는 자리 (2026-10-13).

★★ **왜 — 코드가 두 벌이었습니다.** denflow:// 가 가리키는 자리가
  `Desktop\denflow-exocad` 였고, 저장소와 따로 늙었습니다. 10월 13일에
  토출 보정을 껐는데 단추로 뽑으면 그대로 돌았습니다 — 준비에 6분 35초,
  출력에 6분 30초. 고치는 데서는 되고 쓰는 데서는 안 되는 걸 알아채는 데
  한 판을 버렸습니다. 그래서 등록을 **저장소로** 옮깁니다.

★ 그러면 설정·로그·크롬 프로필을 코드 폴더에 둘 수 없습니다 — DS Core
  로그인이 저장소에 들어가면 안 되고, 저장소를 당길 때마다 날아갑니다.
  에이전트가 이미 쓰는 길을 따릅니다: %APPDATA%\DenFlow.

★ 폴더 이름은 **영문**입니다. 전에 `런타임` 을 한글로 두었다가 cmd 가
  깨뜨렸습니다 (1.2.3 에서 runtime 으로 바꿨음). 같은 실수를 안 합니다.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path

STATE = Path(os.environ.get("APPDATA", Path.home())) / "DenFlow" / "launcher"

#: 옛 폴더에서 옮겨 올 것들. **크롬 프로필이 핵심입니다** — 그 안에
#: DS Core 로그인이 있어서, 새로 만들면 다시 로그인해야 하고 거듭 실패하면
#: DS Core 가 계정을 잠시 막습니다 (2026-09-10 에 겪음).
MOVE = (
    "config.json",
    "settings.json",
    "jig_app.json",
    "stl_image.json",
    "logs",
    "chrome-profile-1",
    "chrome-profile-2",
    "chrome-profile-orders",
)


def folder() -> Path:
    STATE.mkdir(parents=True, exist_ok=True)
    #: 로그 폴더까지 여기서 만듭니다 — 쓰는 쪽마다 챙기면 한 군데는 빠집니다
    (STATE / "logs").mkdir(exist_ok=True)
    return STATE


#: ★★ **옮기면 옛 자리가 죽습니다** (2026-10-14 에 겪음). 설정을 여기로
#:   옮긴 뒤, 브라우저가 여전히 옛 폴더의 launcher.py 를 불렀습니다. 그쪽은
#:   `HERE/config.json` 을 찾다가 **시작하자마자** 죽었고, pythonw 라 창도
#:   로그도 없이 조용히였습니다 — 화면에는 '여는 중' 만 남고 **다섯 건이
#:   그냥 안 열렸습니다.** 사람이 알아챌 방법이 없는 모양이 가장 나쁩니다.
#: ★ 그래서 옛 폴더에는 **저장소로 넘기는 한 줄짜리 launcher.py** 를
#:   두었습니다(바로가기 cmd 들도 같이). 옛 길로 들어와도 돌아갑니다.
def migrate(old: Path) -> list[str]:
    """옛 폴더에 있던 것을 한 번만 옮겨 옵니다. 옮긴 이름들을 돌려줍니다.

    ★ 덮어쓰지 않습니다. 새 자리에 이미 있으면 그쪽이 임자입니다 —
      두 번 돌려도 탈이 없게.
    """
    if not old.is_dir() or old.resolve() == STATE.resolve():
        return []

    moved = []
    here = folder()  # ★ 이것이 logs 를 미리 만듭니다 — 그래서 logs 는 아래에서 따로
    for name in MOVE:
        src, dst = old / name, here / name
        if not src.exists() or dst.exists():
            continue
        try:
            shutil.move(str(src), str(dst))
            moved.append(name)
        except OSError:
            pass  # 크롬이 물고 있으면 다음 번에

    #: ★ logs 는 폴더째 옮길 수 없습니다 (새 자리에 이미 있음). 안에 있는
    #:   것만 하나씩 옮깁니다 — 지난 기록을 잃지 않으려고요.
    old_logs = old / "logs"
    if old_logs.is_dir():
        for f in old_logs.iterdir():
            dst = here / "logs" / f.name
            if dst.exists():
                continue
            try:
                shutil.move(str(f), str(dst))
                moved.append(f"logs/{f.name}")
            except OSError:
                pass
    return moved


#: ★ 저장소에 잠깐 두는 사본 (2026-10-16) — state.SEED_DIR/<이름> 이 있으면 실제 쪽이 옮깁니다
SEED_DIR = Path(__file__).resolve().parent / "_seed_launcher"


def adopt_seeds() -> list[str]:
    """저장소의 임시 사본을 실제 사용자 폴더로 옮기고 지웁니다 (2026-10-16)

    ★★ 왜 — 10/13 에 설정을 사용자 폴더로 옮긴 것이 작업 도구(Claude 쪽) 안에서
      일어나, 실제 Windows 의 AppData 에는 config.json 이 없었습니다. 실제 쪽
      런처는 설정을 읽다 FileNotFoundError 로 죽었고, exocad 가 안 열렸습니다.
    ★ 이미 있으면 덮어쓰지 않습니다(그쪽이 임자). 옮긴 사본은 지웁니다.
    ★ 비밀번호가 든 settings.json 은 여기로 옮기지 않습니다 — 런처 화면에서 넣습니다.
    """
    if not SEED_DIR.is_dir():
        return []
    here = folder()
    moved = []
    for src in SEED_DIR.iterdir():
        if not src.is_file() or src.name == "settings.json":
            continue
        dst = here / src.name
        try:
            if not dst.exists():
                shutil.copyfile(src, dst)
                moved.append(src.name)
            src.unlink()
        except OSError:
            pass
    try:
        SEED_DIR.rmdir()
    except OSError:
        pass
    return moved
