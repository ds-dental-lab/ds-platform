# -*- coding: utf-8 -*-
"""'새 판 확인' — 서버 답을 어떻게 읽는가 (2026-10-19)"""

import unittest
from unittest import mock

import scan_agent


class _Stub:
    """App 에서 판 확인에 쓰는 것만"""

    def __init__(self):
        self.agent = mock.Mock(cfg={"token": "t"})
        self.up_url = ""

    _ask_server_for_update = scan_agent.App._ask_server_for_update


class UpdateCheckTest(unittest.TestCase):
    def test_outdated(self):
        s = _Stub()
        with mock.patch.object(scan_agent, "post_json", return_value={
            "ok": True, "latest": "9.9.9", "note": "고침", "url": "https://denflow.kr/agent", "outdated": True,
        }):
            r = s._ask_server_for_update()
        self.assertEqual(r, (True, "새 판이 있습니다 — 9.9.9 · 고침"))
        self.assertEqual(s.up_url, "https://denflow.kr/agent")

    def test_latest(self):
        s = _Stub()
        with mock.patch.object(scan_agent, "post_json", return_value={
            "ok": True, "latest": scan_agent.AGENT_VERSION, "note": "", "url": "", "outdated": False,
        }):
            self.assertEqual(s._ask_server_for_update(), (False, ""))

    def test_server_down_is_none(self):
        s = _Stub()
        with mock.patch.object(scan_agent, "post_json", return_value={"ok": False, "error": "HTTP 503"}):
            self.assertIsNone(s._ask_server_for_update())


if __name__ == "__main__":
    unittest.main()
