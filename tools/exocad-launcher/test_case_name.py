# -*- coding: utf-8 -*-
"""환자 이름을 폴더 이름으로 — 윈도우가 못 쓰는 글자 (2026-11-11).

    python -m unittest test_case_name

★ '/' 는 멈추지 않고 조용히 폴더를 하나 더 팝니다. 그래서 시험을 둡니다.
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import make_project  # noqa: E402
from launcher import safe_case_name  # noqa: E402


class SafeCaseNameTest(unittest.TestCase):
    def test_plain_name_untouched(self):
        self.assertEqual(safe_case_name("김환자"), "김환자")
        self.assertEqual(safe_case_name("Kim Hwanja 2"), "Kim Hwanja 2")

    def test_slashes_become_underscore(self):
        self.assertEqual(safe_case_name("홍/길동"), "홍_길동")
        self.assertEqual(safe_case_name("홍\\길동"), "홍_길동")

    def test_other_forbidden_chars(self):
        self.assertEqual(safe_case_name('a:b*c?d"e<f>g|h'), "a_b_c_d_e_f_g_h")

    def test_trailing_dot_and_space_removed(self):
        self.assertEqual(safe_case_name(" 김환자. "), "김환자")
        self.assertEqual(safe_case_name("김환자/"), "김환자")

    def test_empty_gets_a_name(self):
        self.assertEqual(safe_case_name("///"), "이름없음")
        self.assertEqual(safe_case_name(""), "이름없음")

    def test_folder_is_one_level_and_creatable(self):
        with tempfile.TemporaryDirectory() as tmp:
            for raw in ("홍/길동", "a:b", "x?y*z", "끝점.", "p|q<r>"):
                folder = Path(tmp) / f"2026-11-11_{safe_case_name(raw)}"
                self.assertEqual(folder.parent, Path(tmp), raw)
                folder.mkdir()
                self.assertTrue(folder.is_dir(), raw)
                (folder / f"{folder.name}.dentalProject").write_bytes(b"")


class PatientNameXmlTest(unittest.TestCase):
    def test_special_chars_keep_xml_valid(self):
        import xml.dom.minidom
        make_project.SAMPLE = Path(__file__).resolve().parent / "template.dentalProject"
        out = make_project.build_project(
            patient_name="A&B <c> \\1", teeth=[{"number": 46, "type": "crown"}], bridges=[],
        )
        doc = xml.dom.minidom.parseString(out.encode("utf-8"))
        self.assertEqual(doc.getElementsByTagName("PatientName")[0].firstChild.data, "A&B <c> \\1")


if __name__ == "__main__":
    unittest.main()
