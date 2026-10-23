# -*- coding: utf-8 -*-
"""프린터 /cache 정리 — 우리 것만, 최근 몇 개는 남김 (2026-10-23)"""
import unittest

import printer_send as ps


class FakeFtp:
    def __init__(self, files):
        self.files = dict(files)  # 이름 → 시각
        self.deleted = []

    def nlst(self, d):
        return [f"{d}/{n}" for n in self.files]

    def sendcmd(self, cmd):
        name = cmd.split("/cache/", 1)[1]
        return f"213 {self.files[name]}"

    def delete(self, path):
        self.deleted.append(path.rsplit("/", 1)[-1])


class CacheTidy(unittest.TestCase):
    def test_only_ours_and_keeps_recent(self):
        ours = {f"0000000{i}-1111-2222-3333-444444444444_auto_plate_1.gcode": f"2026102310{i:02d}00" for i in range(6)}
        others = {
            "3DBenchy by Creative Tool_plate_1.gcode": "20260101000000",
            "dental-27-crown_plate_1.gcode": "20260101000000",
            "_plate_1.gcode": "20260101000000",
        }
        ftp = FakeFtp({**ours, **others})
        gone = ps.BambuPrinter._tidy_cache(ftp, keep=3)
        self.assertEqual(gone, 3)
        self.assertTrue(all(n in ours for n in ftp.deleted))
        # 가장 오래된 셋이 지워짐
        self.assertEqual(sorted(ftp.deleted), sorted(list(ours)[:3]))


if __name__ == "__main__":
    unittest.main()
