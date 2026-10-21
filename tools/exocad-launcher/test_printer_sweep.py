# -*- coding: utf-8 -*-
"""프린터 주소 훑기 — 대역 고르기·지난 주소 먼저·훑어서 찾기 (2026-10-21)"""
import unittest

import printer_sweep as ps


class PrefixTest(unittest.TestCase):
    def test_prefixes_drop_loopback_and_apipa(self):
        got = ps.local_prefixes(["192.168.0.12", "127.0.0.1", "169.254.3.4", "10.0.5.7", "192.168.0.99"])
        self.assertEqual(got, ["10.0.5.", "192.168.0."])

    def test_prefixes_empty(self):
        self.assertEqual(ps.local_prefixes(["127.0.0.1"]), [])


class SweepTest(unittest.TestCase):
    def test_preferred_first_no_scan(self):
        probed = []
        host = ps.sweep(
            "S1", "code", preferred="192.168.0.123", prefixes=["192.168.0."],
            probe=lambda p: probed.append(p) or [], verify=lambda h, s, c: h == "192.168.0.123",
        )
        self.assertEqual(host, "192.168.0.123")
        self.assertEqual(probed, [])

    def test_scan_finds_by_verify(self):
        said = []
        host = ps.sweep(
            "S1", "code", preferred="192.168.0.123", prefixes=["192.168.0.", "10.0.0."],
            probe=lambda p: [p + "5", p + "77"] if p == "10.0.0." else [p + "123"],
            verify=lambda h, s, c: h == "10.0.0.77" and s == "S1" and c == "code",
            say=said.append,
        )
        self.assertEqual(host, "10.0.0.77")
        self.assertTrue(any("10.0.0.77" in m for m in said))

    def test_nothing_found(self):
        host = ps.sweep("S1", "code", prefixes=["192.168.0."], probe=lambda p: [p + "9"], verify=lambda *_: False)
        self.assertIsNone(host)

    def test_requires_serial_and_code(self):
        self.assertIsNone(ps.sweep("", "code", prefixes=[], probe=lambda p: [], verify=lambda *_: True))
        self.assertIsNone(ps.sweep("S", "", prefixes=[], probe=lambda p: [], verify=lambda *_: True))


if __name__ == "__main__":
    unittest.main()
