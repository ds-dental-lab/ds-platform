# -*- coding: utf-8 -*-
"""고정 자리 파이썬 — 방화벽이 판마다 다시 묻지 않게 (2026-10-24)"""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import shared_runtime as sr


def fake_runtime(d: Path, rid: str) -> Path:
    rt = d / "runtime"
    rt.mkdir(parents=True)
    (rt / "pythonw.exe").write_bytes(b"x")
    (rt / "python.exe").write_bytes(b"x")
    (rt / "RUNTIME_ID").write_text(rid, encoding="utf-8")
    (rt / "Lib").mkdir()
    (rt / "Lib" / "a.py").write_text("x", encoding="utf-8")
    return rt


class Shared(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.root = self.tmp / "shared"

    def test_copies_once_and_reuses(self):
        rt = fake_runtime(self.tmp / "덴플로우 에이전트 1.3.17", "abc123")
        t1 = sr.ensure_shared(rt, self.root)
        self.assertEqual(t1, self.root / "abc123")
        self.assertTrue((t1 / "Lib" / "a.py").is_file())
        # 다음 판 — 지문이 같으면 같은 자리(복사 안 함)
        rt2 = fake_runtime(self.tmp / "덴플로우 에이전트 1.3.18", "abc123")
        (t1 / "marker").write_text("same", encoding="utf-8")
        self.assertEqual(sr.ensure_shared(rt2, self.root), t1)
        self.assertTrue((t1 / "marker").is_file())

    def test_new_fingerprint_new_place(self):
        a = sr.ensure_shared(fake_runtime(self.tmp / "v1", "aaa111"), self.root)
        b = sr.ensure_shared(fake_runtime(self.tmp / "v2", "bbb222"), self.root)
        self.assertNotEqual(a, b)
        self.assertEqual(sr.prune(b, self.root), 1)
        self.assertFalse(a.exists())

    def test_no_fingerprint_means_no_move(self):
        rt = fake_runtime(self.tmp / "dev", "x")
        (rt / "RUNTIME_ID").unlink()
        self.assertIsNone(sr.ensure_shared(rt, self.root))

    def test_relaunch_spawns_shared_python_with_flag(self):
        rt = fake_runtime(self.tmp / "덴플로우 에이전트 1.3.17", "abc123")
        calls = []
        with mock.patch.object(sr.sys, "executable", str(rt / "pythonw.exe")), \
             mock.patch.dict(os.environ, {sr.ENV_FLAG: ""}):
            ok = sr.relaunch_if_needed(self.tmp / "scan_agent.py", ["--tray"], self.root,
                                       spawn=lambda args, env: calls.append((args, env)))
        self.assertTrue(ok)
        args, env = calls[0]
        self.assertEqual(Path(args[0]), self.root / "abc123" / "pythonw.exe")
        self.assertEqual(args[2:], ["--tray"])
        self.assertEqual(env[sr.ENV_FLAG], "1")

    def test_no_loop_when_flag_or_already_shared(self):
        rt = fake_runtime(self.tmp / "v", "abc123")
        spawn = mock.Mock()
        with mock.patch.object(sr.sys, "executable", str(rt / "pythonw.exe")), \
             mock.patch.dict(os.environ, {sr.ENV_FLAG: "1"}):
            self.assertFalse(sr.relaunch_if_needed(self.tmp / "s.py", [], self.root, spawn=spawn))
        shared = sr.ensure_shared(rt, self.root)
        with mock.patch.object(sr.sys, "executable", str(shared / "pythonw.exe")), \
             mock.patch.dict(os.environ, {sr.ENV_FLAG: ""}):
            self.assertFalse(sr.relaunch_if_needed(self.tmp / "s.py", [], self.root, spawn=spawn))
        spawn.assert_not_called()


if __name__ == "__main__":
    unittest.main()
