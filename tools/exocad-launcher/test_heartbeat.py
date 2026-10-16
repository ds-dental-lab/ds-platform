# -*- coding: utf-8 -*-
"""상태 보내기 — 오류 모으기·같은 오류 거르기·못 보내면 남겨 두기 (2026-10-16)"""

import io
import json
import unittest
from unittest import mock

import heartbeat


class Beat(unittest.TestCase):
    def make(self):
        return heartbeat.Heartbeat("https://x", lambda: "tok", "1.3.2", lambda: {"kind": "clinic"})

    def test_error_words(self):
        self.assertTrue(heartbeat.looks_like_error("올리기 실패: 연결"))
        self.assertTrue(heartbeat.looks_like_error("프린터를 못 찾았습니다"))
        self.assertFalse(heartbeat.looks_like_error("스캔 2개를 올렸습니다"))

    def test_same_error_once_in_10min(self):
        h = self.make()
        h.report("프린터를 못 찾았습니다")
        h.report("프린터를 못 찾았습니다")
        self.assertEqual(len(h._pending), 1)

    def test_sent_events_are_cleared_failed_are_kept(self):
        h = self.make()
        h.report("A 실패")
        with mock.patch.object(heartbeat.urllib.request, "urlopen", side_effect=OSError("down")):
            self.assertFalse(h.beat_once())
        self.assertEqual(len(h._pending), 1)

        class R(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with mock.patch.object(heartbeat.urllib.request, "urlopen", return_value=R(json.dumps({"ok": True}).encode())) as u:
            self.assertTrue(h.beat_once())
        sent = json.loads(u.call_args[0][0].data)
        self.assertEqual(sent["status"]["kind"], "clinic")
        self.assertEqual(sent["events"][0]["message"], "A 실패")
        self.assertEqual(h._pending, [])

    def test_no_token_no_send(self):
        h = heartbeat.Heartbeat("https://x", lambda: None, None, lambda: {})
        self.assertFalse(h.beat_once())


if __name__ == "__main__":
    unittest.main()
