# -*- coding: utf-8 -*-
"""내보내기가 잡히면 먼저 묻기 — '아니오' 면 서버에 아무것도 안 감 (2026-10-19)"""

import unittest
from pathlib import Path
from unittest import mock

import scan_agent


class AskBeforeSendTest(unittest.TestCase):
    def test_default_is_ask(self):
        self.assertTrue(scan_agent.ask_before_send({}))
        self.assertTrue(scan_agent.ask_before_send({"ask_before_send": True}))
        self.assertFalse(scan_agent.ask_before_send({"ask_before_send": False}))

    def _agent(self, cfg, answer):
        said = []
        with mock.patch.object(scan_agent, "load_settings", return_value=dict(cfg)):
            a = scan_agent.Agent(said.append, ask=lambda _n, _l: answer)
        return a, said

    def test_no_means_nothing_posted(self):
        a, said = self._agent({"token": "t"}, answer=False)
        with mock.patch.object(scan_agent, "post_json", side_effect=AssertionError("서버에 가면 안 됩니다")):
            a.upload_case("k", {"patientName": "홍길동"}, [(Path(__file__), "a.stl")], "Medit")
        self.assertTrue(any("보내지 않습니다" in m for m in said))

    def test_yes_posts(self):
        a, _ = self._agent({"token": "t"}, answer=True)
        with mock.patch.object(scan_agent, "post_json", return_value={"ok": False, "error": "시험"}) as pj:
            a.upload_case("k", {"patientName": "홍길동"}, [(Path(__file__), "a.stl")], "Medit")
        self.assertEqual(pj.call_count, 1)

    def test_open_mode_does_not_ask(self):
        asked = []
        with mock.patch.object(scan_agent, "load_settings", return_value={"ask_before_send": False, "token": "t"}):
            a = scan_agent.Agent(lambda _m: None, ask=lambda n, l: asked.append(n) or True)
        with mock.patch.object(scan_agent, "post_json", return_value={"ok": False, "error": "시험"}):
            a.upload_case("k", {"patientName": "홍길동"}, [(Path(__file__), "a.stl")], "Medit")
        self.assertEqual(asked, [])


if __name__ == "__main__":
    unittest.main()
