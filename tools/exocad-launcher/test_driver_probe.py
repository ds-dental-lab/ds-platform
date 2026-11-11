"""크롬에 붙을 수 있나 미리 보기 (2026-11-11 — 치과 시연이 '차례를 기다립니다' 에서 멈춤)"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


class DriverReasonTest(unittest.TestCase):
    def test_smart_app_control(self):
        from dentbird_web import driver_reason
        inner = OSError("애플리케이션 제어 정책에서 이 파일을 차단했습니다")
        inner.winerror = 4551
        try:
            try:
                raise inner
            except OSError as e:
                raise RuntimeError("Unsuccessful command executed") from e
        except RuntimeError as outer:
            why = driver_reason(outer)
        self.assertIn("스마트 앱 컨트롤", why)

    def test_other(self):
        from dentbird_web import driver_reason
        why = driver_reason(RuntimeError("Unable to obtain driver for chrome\nmore"))
        self.assertTrue(why.startswith("크롬 조종 프로그램을 못 구했습니다"))
        self.assertNotIn("more", why)


class ProbeTest(unittest.TestCase):
    def setUp(self):
        import design_worker as w
        self.w = w
        self.said, self.reported = [], []
        self._say, self._heart = w.say, w._heart
        w.say = self.said.append
        w._heart = type("H", (), {"report": lambda _s, m: self.reported.append(m)})()
        w._driver_bad, w._next_driver_probe, w._session_bad_at = None, 0.0, 0.0

    def tearDown(self):
        w = self.w
        w.say, w._heart = self._say, self._heart
        w._driver_bad, w._next_driver_probe, w._session_bad_at = None, 0.0, 0.0

    def test_reports_once_and_pauses(self):
        w = self.w
        w._probe_driver(check=lambda: "막힘")
        self.assertEqual(w._driver_bad, "막힘")
        self.assertEqual(len(self.reported), 1)
        self.assertGreater(w._session_bad_at, 0)          # 그동안 일감을 안 잡음
        w._next_driver_probe = 0.0
        w._probe_driver(check=lambda: "막힘")
        self.assertEqual(len(self.reported), 1)           # 같은 말을 또 올리지 않음

    def test_recovers(self):
        w = self.w
        w._probe_driver(check=lambda: "막힘")
        w._next_driver_probe = 0.0
        w._probe_driver(check=lambda: None)
        self.assertIsNone(w._driver_bad)
        self.assertEqual(w._session_bad_at, 0.0)

    def test_waits_between_probes(self):
        w = self.w
        calls = []
        w._probe_driver(check=lambda: calls.append(1))
        w._probe_driver(check=lambda: calls.append(1))
        self.assertEqual(len(calls), 1)

    def test_health_says_blocked_first(self):
        w = self.w
        w._driver_bad = "막힘"
        self.assertTrue(w._health()["dentbird"].startswith("못 붙음 — 막힘"))


if __name__ == "__main__":
    unittest.main()
