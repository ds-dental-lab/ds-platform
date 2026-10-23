# -*- coding: utf-8 -*-
"""다시 켜졌을 때 하던 출력 이어서 지켜보기 (2026-10-23)"""
import unittest
from pathlib import Path
from unittest import mock

import print_loop as pl
import printer_send as ps

F = "76a32210-b04a-4ed6-9837-1c9ae5f791fa_auto.gcode.3mf"


def printer(states):
    p = ps.BambuPrinter.__new__(ps.BambuPrinter)
    p.serial, p.access_code, p.host = "S", "C", "h"
    it = iter(states)
    p.status = lambda seconds=6.0: next(it, states[-1])
    p.tidy = lambda *a, **k: 0
    return p


class Follow(unittest.TestCase):
    def run_follow(self, states):
        return list(printer(states).follow(F, sleep=lambda n: None))

    def test_finished_with_empty_names_is_ours(self):
        out = self.run_follow([{"gcode_state": "FINISH", "subtask_name": "", "gcode_file": "", "mc_percent": 100}])
        self.assertTrue(out[-1].done)

    def test_running_ours_then_finish(self):
        mine = {"subtask_name": F.split(".")[0]}
        out = self.run_follow([
            {**mine, "gcode_state": "RUNNING", "mc_percent": 50, "layer_num": 30},
            {**mine, "gcode_state": "RUNNING", "mc_percent": 80, "layer_num": 50},
            {**mine, "gcode_state": "FINISH", "mc_percent": 100},
        ])
        self.assertTrue(out[0].started)
        self.assertTrue(out[-1].done)

    def test_someone_elses_print_is_unknown(self):
        out = self.run_follow([{"gcode_state": "FINISH", "subtask_name": "Benchy", "mc_percent": 100}])
        self.assertTrue(out[-1].failed)

    def test_idle_unnamed_not_finished_is_unknown(self):
        out = self.run_follow([{"gcode_state": "IDLE", "subtask_name": "", "mc_percent": 0}])
        self.assertTrue(out[-1].failed)


class ResumeReports(unittest.TestCase):
    def worker(self, states):
        w = pl.PrintWorker("t", {"printer_kind": "mock"}, Path("."), say=lambda m: None)
        w.printer = printer(states)
        w.printer.follow = lambda name, p=w.printer: ps.BambuPrinter.follow(p, name, sleep=lambda n: None)
        w.sent = []
        w.report = lambda job_id, **b: w.sent.append(b)
        return w

    def test_printing_job_reports_only_done(self):
        w = self.worker([{"gcode_state": "FINISH", "subtask_name": "", "mc_percent": 100}])
        w.run_one({"jobId": "j", "fileName": F, "downloadUrl": "", "resume": "printing"})
        self.assertEqual([b.get("step") for b in w.sent if "step" in b], ["done"])

    def test_sending_job_reports_printing_then_done(self):
        w = self.worker([{"gcode_state": "FINISH", "subtask_name": "", "mc_percent": 100}])
        w.run_one({"jobId": "j", "fileName": F, "downloadUrl": "", "resume": "sending"})
        self.assertEqual([b.get("step") for b in w.sent if "step" in b], ["printing", "done"])


if __name__ == "__main__":
    unittest.main()
