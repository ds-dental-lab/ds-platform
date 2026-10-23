# -*- coding: utf-8 -*-
"""서버 PC 스스로 갱신 — 새 코드 알아보기·일하는 중이면 미루기 (2026-10-23)"""
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import watch_common as wc


def git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(cwd), *args], check=True, capture_output=True)


class SelfUpdate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        t = Path(self.tmp.name)
        self.origin = t / "origin.git"
        self.server = t / "server"
        self.dev = t / "dev"
        git(t, "init", "-q", "--bare", "-b", "master", str(self.origin))
        git(t, "clone", "-q", str(self.origin), str(self.dev))
        for repo in (self.dev,):
            git(repo, "config", "user.email", "t@t")
            git(repo, "config", "user.name", "t")
        launcher = self.dev / "tools" / "exocad-launcher"
        launcher.mkdir(parents=True)
        (launcher / "a.py").write_text("x = 1\n", encoding="utf-8")
        (launcher / "update_server.cmd").write_text("@echo off\n", encoding="utf-8")
        (self.dev / "web.ts").write_text("1\n", encoding="utf-8")
        git(self.dev, "add", "-A")
        git(self.dev, "commit", "-qm", "first")
        git(self.dev, "push", "-q", "origin", "master")
        git(t, "clone", "-q", str(self.origin), str(self.server))
        self.state = t / "state"
        self.state.mkdir()
        self.patch_state = mock.patch.object(wc, "STATE", self.state)
        self.patch_state.start()
        wc._next_update_check = 0.0

    def tearDown(self):
        self.patch_state.stop()
        self.tmp.cleanup()

    def push(self, rel: str) -> None:
        p = self.dev / rel
        p.write_text(p.read_text(encoding="utf-8") + "# more\n", encoding="utf-8")
        git(self.dev, "commit", "-qam", f"change {rel}")
        git(self.dev, "push", "-q", "origin", "master")

    def run_update(self):
        said = []
        with mock.patch.object(wc, "_spawn_detached") as popen:
            started = wc.self_update(say=said.append, repo=self.server)
        return started, popen, said

    def test_nothing_new(self):
        started, popen, _ = self.run_update()
        self.assertFalse(started)
        popen.assert_not_called()

    def test_web_only_change_is_ignored(self):
        self.push("web.ts")
        self.assertEqual(wc.launcher_changes(self.server), [])
        started, popen, _ = self.run_update()
        self.assertFalse(started)
        popen.assert_not_called()

    def test_launcher_change_starts_update(self):
        self.push("tools/exocad-launcher/a.py")
        started, popen, said = self.run_update()
        self.assertTrue(started)
        args = popen.call_args[0][0]
        self.assertEqual(args[:2], ["cmd", "/c"])
        self.assertTrue(args[2].endswith("update_server.cmd"))
        self.assertIn("a.py", said[-1])

    def test_waits_while_temp_watch_busy(self):
        self.push("tools/exocad-launcher/a.py")
        wc.busy("temp_watch", True)
        started, popen, said = self.run_update()
        self.assertFalse(started)
        popen.assert_not_called()
        self.assertIn("일하는 중", said[-1])
        # 끝나면 다음 바퀴에 받습니다
        wc.busy("temp_watch", False)
        wc._next_update_check = 0.0
        started, popen, _ = self.run_update()
        self.assertTrue(started)

    def test_stale_busy_does_not_block_forever(self):
        self.push("tools/exocad-launcher/a.py")
        wc.busy("temp_watch", True)
        old = time.time() - wc.BUSY_STALE_SECONDS - 10
        import os
        os.utime(self.state / "temp_watch.busy", (old, old))
        started, _, _ = self.run_update()
        self.assertTrue(started)

    def test_checks_at_most_every_5_minutes(self):
        self.run_update()
        self.push("tools/exocad-launcher/a.py")
        started, popen, _ = self.run_update()
        self.assertFalse(started)
        popen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
