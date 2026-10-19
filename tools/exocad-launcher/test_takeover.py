# -*- coding: utf-8 -*-
"""새 판이 옛것을 내리고 자리 잡기 — 판단과 파일 약속 (2026-10-19, 1.3.7)"""

import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

import takeover


class DecideTest(unittest.TestCase):
    def test_newer(self):
        self.assertTrue(takeover.newer("1.3.7", "1.3.2"))
        self.assertTrue(takeover.newer("1.10.0", "1.9.9"))  # 글자 비교면 틀리는 자리
        self.assertFalse(takeover.newer("1.3.7", "1.3.7"))
        self.assertFalse(takeover.newer("1.3.7", "1.4.0"))
        # 저쪽 판을 모르면(run 파일 없음 = 1.3.6 이하) 새롭다고 봅니다
        self.assertTrue(takeover.newer("1.3.7", None))
        self.assertTrue(takeover.newer("1.3.7", "이상한값"))

    def test_decide(self):
        self.assertEqual(takeover.decide("1.3.7", None), "takeover")
        self.assertEqual(takeover.decide("1.3.7", {"version": "1.3.2", "pid": 1}), "takeover")
        self.assertEqual(takeover.decide("1.3.7", {"version": "1.3.7", "pid": 1}), "raise")
        self.assertEqual(takeover.decide("1.3.7", {"version": "1.3.8", "pid": 1}), "raise")


class FilesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        takeover.configure(Path(self.tmp.name))

    def tearDown(self):
        takeover.configure(Path(self.tmp.name))  # 다른 시험에 새지 않게
        self.tmp.cleanup()

    def test_run_file_roundtrip_and_clear_only_mine(self):
        takeover.write_run("1.3.7")
        d = takeover.read_run()
        self.assertEqual(d["version"], "1.3.7")
        self.assertEqual(d["pid"], os.getpid())
        # 다른 pid 가 적어 둔 것은 안 지웁니다
        takeover.RUN_FILE.write_text('{"pid": 1, "version": "9.9.9"}', encoding="utf-8")
        takeover.clear_run()
        self.assertTrue(takeover.RUN_FILE.is_file())
        takeover.write_run("1.3.7")
        takeover.clear_run()
        self.assertFalse(takeover.RUN_FILE.is_file())

    def test_handoff_request_is_consumed_once(self):
        self.assertFalse(takeover.handoff_requested())
        takeover.request_handoff()
        self.assertTrue(takeover.handoff_requested())
        self.assertFalse(takeover.handoff_requested())

    def test_take_over_gracefully_when_mutex_frees(self):
        calls = {"n": 0}

        def try_mutex():
            calls["n"] += 1
            return calls["n"] >= 3  # 세 번째에 비었다고

        t0 = time.time()
        self.assertTrue(takeover.take_over("1.3.7", {"version": "1.3.7", "pid": 0}, try_mutex, wait_s=4))
        self.assertLess(time.time() - t0, 3.0)
        self.assertEqual(takeover.TOOK_OVER, "1.3.7")


@unittest.skipUnless(sys.platform == "win32", "윈도우 전용")
class WindowsTest(unittest.TestCase):
    def test_find_and_terminate_a_window_owner(self):
        # 시험용 창을 띄우고(제목만 같게 '… 시험'), 찾아서 끝냅니다
        title = "덴플로우 에이전트 시험창"
        p = subprocess.Popen([sys.executable, "-c",
                              f"import tkinter as tk; r=tk.Tk(); r.title({title!r}); r.mainloop()"])
        try:
            pid = None
            for _ in range(60):
                pid = takeover.pid_of_window(title)
                if pid:
                    break
                time.sleep(0.1)
            self.assertEqual(pid, p.pid)
            self.assertTrue(takeover.terminate(pid))
            self.assertIsNotNone(p.wait(timeout=5))
        finally:
            if p.poll() is None:
                p.kill()

    def test_never_terminates_self(self):
        self.assertFalse(takeover.terminate(os.getpid()))


if __name__ == "__main__":
    unittest.main()
