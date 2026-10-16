# -*- coding: utf-8 -*-
"""
다른 프로그램을 **떼어서** 띄웁니다 (2026-10-16 점검).

★★ 왜 — 지켜보기·일꾼은 시작프로그램이 `cmd /c python … >> 무엇-crash.txt` 로
  띄웁니다. 그 파이썬이 그냥 Popen 으로 크롬·exocad·wscript 를 띄우면, 띄워진
  쪽이 **표준 출력(= 그 crash.txt 손잡이)을 물려받아** 켜져 있는 내내 쥐고
  있습니다. 그러면 다음에 시작프로그램이 같은 crash.txt 에 이어 쓰려다 막히고,
  cmd 는 **파이썬을 아예 실행하지 않은 채** 조용히 끝납니다.

  실제로 2026-10-16 아침: 설계 일꾼이 덴트버드 크롬을 띄운 뒤로, 일꾼이 죽을
  때마다 시작프로그램이 10초마다 다시 띄웠지만 한 번도 안 떴고 흔적도 없었습니다.

★ 그래서 표준 입출력을 모두 버리고(DEVNULL), 손잡이를 안 물려주고(close_fds),
  새 프로세스 묶음으로 떼어 냅니다.
"""

from __future__ import annotations

import subprocess

DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200


def detached(args: list[str]) -> subprocess.Popen:
    return subprocess.Popen(
        args,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
    )
