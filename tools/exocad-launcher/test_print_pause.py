# -*- coding: utf-8 -*-
"""출력 중 일시 정지 — 실패로 끊지 않고 기다렸다 이어서 (2026-10-23)"""
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import print_loop as pl
import printer_send as ps


class FakePrinter:
    def __init__(self, steps):
        self.steps = steps

    def send(self, path):
        yield from self.steps


class Worker(pl.PrintWorker):
    def __init__(self, steps):
        super().__init__("t", {"printer_kind": "mock"}, Path("."), say=lambda m: None)
        self.printer = FakePrinter(steps)
        self.sent = []

    def download(self, job):
        f = Path(tempfile.mkdtemp()) / "x.gcode.3mf"
        f.write_bytes(b"x")
        return f

    def report(self, job_id, **body):
        self.sent.append(body)


class Pause(unittest.TestCase):
    def test_pause_then_resume_then_done_is_not_failure(self):
        w = Worker([
            ps.Progress(0, "출력 시작", started=True),
            ps.Progress(40, "일시 정지 — 필라멘트", paused="필라멘트가 끊겼거나 떨어졌을 수 있습니다"),
            ps.Progress(40, "일시 정지 중", paused="필라멘트가 끊겼거나 떨어졌을 수 있습니다"),
            ps.Progress(41, "이어서 출력합니다", resumed=True),
            ps.Progress(100, "출력 완료", done=True),
        ])
        w.run_one({"jobId": "j", "fileName": "x.gcode.3mf", "downloadUrl": "u"})
        steps = [b.get("step") for b in w.sent if "step" in b]
        self.assertEqual(steps, ["printing", "done"])
        self.assertEqual(sum(1 for b in w.sent if b.get("paused")), 2)
        self.assertEqual(sum(1 for b in w.sent if b.get("resumed")), 1)
        self.assertNotIn("failed", steps)

    def test_pause_reason_words(self):
        self.assertIn("필라멘트", ps.pause_reason(0))
        self.assertIn("0700-8011", ps.pause_reason(0x07008011))
        self.assertIn("필라멘트", ps.pause_reason("bad"))

    def test_resumed_report_is_kept_when_server_unreachable(self):
        w = pl.PrintWorker("t", {"printer_kind": "mock"}, Path("."), say=lambda m: None)
        with mock.patch.object(pl, "_post", return_value={"ok": False, "error": "서버에 닿지 못했습니다"}), \
             mock.patch.object(pl.time, "sleep"):
            w.report("j", resumed=True, percent=41)
            w.report("j", paused="x", percent=40)
        self.assertEqual(len(w.pending), 1)  # 이어서는 보관, 멈춤은 5분 뒤 또 오니 안 보관
        self.assertTrue(w.pending[0][1]["resumed"])


if __name__ == "__main__":
    unittest.main()


class FakeClient:
    """MQTT 흉내 — 붙으면 끝, 메시지는 시험이 넣어 줍니다"""

    def __init__(self):
        self.on_message = None

    def connect(self, *a, **k): pass
    def loop_start(self): pass
    def loop_stop(self): pass
    def disconnect(self): pass
    def publish(self, *a, **k): pass


class Msg:
    def __init__(self, data):
        import json
        self.payload = json.dumps({"print": data}).encode()


class WatchLoop(unittest.TestCase):
    """BambuPrinter.send 의 지켜보기를 가짜 시계·가짜 프린터로 끝까지 돌립니다"""

    def run_script(self, script):
        # script: [(이 초부터, 프린터 상태 dict)] — 시간이 지나면 다음 상태를 보냅니다
        p = ps.BambuPrinter.__new__(ps.BambuPrinter)
        p.serial, p.access_code, p.host = "S", "C", "1.2.3.4"
        client = FakeClient()
        clock = {"t": 0.0}
        sent = {"i": 0}

        def fake_sleep(n):
            clock["t"] += n
            while sent["i"] < len(script) and script[sent["i"]][0] <= clock["t"]:
                client.on_message(None, None, Msg(script[sent["i"]][1]))
                sent["i"] += 1

        with mock.patch.object(ps.time, "time", lambda: clock["t"]), \
             mock.patch.object(ps.time, "sleep", fake_sleep), \
             mock.patch.object(p, "status", return_value={"gcode_state": "IDLE"}), \
             mock.patch.object(p, "tidy", return_value=0), \
             mock.patch.object(p, "target_temps", return_value=None), \
             mock.patch.object(p, "upload", return_value="t.gcode.3mf"), \
             mock.patch.object(p, "_mqtt", return_value=client), \
             mock.patch.dict("sys.modules", {"paho": mock.MagicMock(), "paho.mqtt": mock.MagicMock(), "paho.mqtt.client": mock.MagicMock()}):
            return list(p.send(Path("t.gcode.3mf")))

    def test_pause_waits_and_finishes(self):
        mine = {"subtask_name": "t"}
        out = self.run_script([
            (2, {**mine, "gcode_state": "RUNNING", "mc_percent": 0, "layer_num": 0}),
            (100, {**mine, "gcode_state": "RUNNING", "mc_percent": 40, "layer_num": 20}),
            (120, {**mine, "gcode_state": "PAUSE", "print_error": 0x07008011}),
            *[(120 + k * 60, {**mine, "gcode_state": "PAUSE"}) for k in range(1, 16)],  # 15분 멈춤(소식은 옴)
            (1100, {**mine, "gcode_state": "RUNNING", "mc_percent": 41, "layer_num": 21, "print_error": 0}),
            (1200, {**mine, "gcode_state": "FINISH", "mc_percent": 100}),
        ])
        self.assertTrue(out[-1].done, out[-1])
        self.assertFalse(any(x.failed for x in out))
        self.assertTrue(any(x.paused for x in out))
        self.assertTrue(any(x.resumed for x in out))
        self.assertIn("0700-8011", next(x.paused for x in out if x.paused))

    def test_pause_too_long_fails(self):
        mine = {"subtask_name": "t"}
        out = self.run_script([
            (2, {**mine, "gcode_state": "RUNNING", "mc_percent": 0}),
            (60, {**mine, "gcode_state": "PAUSE"}),
            *[(60 + k * 60, {**mine, "gcode_state": "PAUSE"}) for k in range(1, 70)],
        ])
        self.assertTrue(out[-1].failed)
        self.assertIn("60분", out[-1].failed)
