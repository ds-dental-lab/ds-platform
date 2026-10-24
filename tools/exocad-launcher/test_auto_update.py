# -*- coding: utf-8 -*-
"""에이전트 스스로 업데이트 (2026-10-24)"""
import tempfile
import unittest
import zipfile
from pathlib import Path

import auto_update as au


def make_zip(path: Path, top: str, extra: dict | None = None) -> Path:
    with zipfile.ZipFile(path, "w") as z:
        z.writestr(f"{top}/scan_agent.py", "print('x')")
        z.writestr(f"{top}/runtime/pythonw.exe", "x")
        for name, data in (extra or {}).items():
            z.writestr(name, data)
    return path


class Pieces(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def test_versions(self):
        self.assertTrue(au.is_newer("1.3.18", "1.3.17"))
        self.assertTrue(au.is_newer("1.4.0", "1.3.99"))
        self.assertFalse(au.is_newer("1.3.17", "1.3.17"))
        self.assertFalse(au.is_newer("1.3.16", "1.3.17"))
        self.assertFalse(au.is_newer("abc", "1.3.17"))

    def test_download_checks_fingerprint(self):
        src = make_zip(self.tmp / "src.zip", "덴플로우 에이전트 1.3.18")
        good = au.sha256_of(src)
        out = au.download(src.as_uri(), good, self.tmp / "w1")
        self.assertTrue(out.is_file())
        with self.assertRaises(ValueError):
            au.download(src.as_uri(), "0" * 64, self.tmp / "w2")
        self.assertFalse((self.tmp / "w2" / "update.zip").exists())

    def test_install_next_to_current(self):
        z = make_zip(self.tmp / "u.zip", "덴플로우 에이전트 1.3.18")
        parent = self.tmp / "desk"
        parent.mkdir()
        home = au.install(z, parent, "1.3.18")
        self.assertEqual(home, (parent / "덴플로우 에이전트 1.3.18").resolve())
        self.assertTrue((home / "scan_agent.py").is_file())

    def test_install_refuses_wrong_shape_and_escape(self):
        parent = self.tmp / "desk"
        parent.mkdir()
        with self.assertRaises(ValueError):
            au.install(make_zip(self.tmp / "a.zip", "다른 폴더"), parent, "1.3.18")
        with self.assertRaises(ValueError):
            au.install(make_zip(self.tmp / "b.zip", "덴플로우 에이전트 1.3.18",
                                {"덴플로우 에이전트 1.3.18/../../evil.txt": "x"}), parent, "1.3.18")
        self.assertFalse((self.tmp / "evil.txt").exists())

    def test_launch_uses_new_home_and_clears_flag(self):
        calls = []
        home = self.tmp / "덴플로우 에이전트 1.3.18"
        self.assertTrue(au.launch(home, spawn=lambda a, e: calls.append((a, e))))
        args, env = calls[0]
        self.assertEqual(Path(args[0]), home / "runtime" / "pythonw.exe")
        self.assertEqual(args[2], "--tray")
        self.assertNotIn("DENFLOW_SHARED", env)


class UpdaterFlow(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.home = self.tmp / "desk" / "덴플로우 에이전트 1.3.17"
        self.home.mkdir(parents=True)
        self.zip = make_zip(self.tmp / "u.zip", "덴플로우 에이전트 1.3.18")
        self.answer = {"ok": True, "version": "1.3.18", "url": self.zip.as_uri(), "sha256": au.sha256_of(self.zip)}
        self.launched = []
        au_launch = au.launch
        self.addCleanup(setattr, au, "launch", au_launch)
        au.launch = lambda home, spawn=None: self.launched.append(home) or True

    def updater(self, idle=True, enabled=True, answer=None):
        return au.Updater("1.3.17", self.home, ask=lambda: answer or self.answer,
                          idle=lambda: idle, say=lambda m: None, enabled=lambda: enabled)

    def test_happy_path(self):
        u = self.updater()
        self.assertEqual(u.try_once(), "started")
        self.assertEqual(self.launched[0].name, "덴플로우 에이전트 1.3.18")
        self.assertEqual(u.try_once(), "started")  # 두 번 안 띄움
        self.assertEqual(len(self.launched), 1)

    def test_waits_when_busy_or_off_or_nothing_new(self):
        self.assertEqual(self.updater(idle=False).try_once(), "busy")
        self.assertEqual(self.updater(enabled=False).try_once(), "off")
        self.assertEqual(self.updater(answer={"ok": True, "version": None}).try_once(), "none")
        self.assertEqual(self.updater(answer={**self.answer, "version": "1.3.17"}).try_once(), "none")
        self.assertEqual(self.launched, [])

    def test_bad_fingerprint_fails_then_waits_a_day(self):
        u = self.updater(answer={**self.answer, "sha256": "0" * 64})
        self.assertEqual(u.try_once(), "failed")
        self.assertEqual(u.try_once(), "skip")
        self.assertEqual(self.launched, [])
        self.assertFalse((self.home.parent / "덴플로우 에이전트 1.3.18").exists())


if __name__ == "__main__":
    unittest.main()
