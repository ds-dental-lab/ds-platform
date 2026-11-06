# -*- coding: utf-8 -*-
"""밤 실행의 화면 읽기 — 2026-11-03 덴트버드 Smart order 화면 글 그대로 (화면 없이 돌림).

    python test_batch_review.py
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import os  # noqa: E402
import tempfile  # noqa: E402
import time  # noqa: E402

from batch_review import (  # noqa: E402
    classify, groups_from, items_in, jaws, load_log, name_shots, prepare, purge_judged, save_log, set_verdict, neutral, parse_params, pontics_from, tidy_done,
)

SMART = (
    "Smart order\n치아 및 보철물\n디자인 생성 전에 감지된 치아와 추천된 보철물을 확인하세요.\n"
    "크라운\n임플란트\n인레이/온레이\n폰틱\n자연치\n결손치\n"
    "디자인 파라미터\n{rows}디자인 설정\n뒤로가기\n디자인"
)


def body(*rows: str) -> str:
    return SMART.format(rows="".join(f"{r}\nPreset - 3D Printing\n" for r in rows))


class ParseTest(unittest.TestCase):
    def test_bridge(self):
        self.assertEqual(parse_params(body("브릿지 25-27")), ["브릿지 25-27"])

    def test_two_crowns(self):
        self.assertEqual(parse_params(body("크라운 17", "크라운 16")), ["크라운 17", "크라운 16"])

    def test_no_section(self):
        self.assertEqual(parse_params("파일을 끌어다 놓으세요"), [])


class ClassifyTest(unittest.TestCase):
    def test_go(self):
        self.assertEqual(classify(["브릿지 35-34"], body("브릿지 35-34"))[0], "go")

    def test_implant_holds(self):
        verdict, why = classify(["임플란트 36"], body("임플란트 36"))
        self.assertEqual(verdict, "hold")
        self.assertIn("임플란트 36", why)

    def test_bridge_with_implant_rows_holds(self):
        # 2026-11-03 시험3 화면 그대로 — 브릿지 줄 아래 임플란트 유닛
        b = SMART.format(rows="브릿지 17-15\nPreset - 3D Printing\n└ 임플란트 17\n임플란트 라이브러리\n선택 안됨\n스크류홀\n"
                              "└ 임플란트 15\n임플란트 라이브러리\n선택 안됨\n스크류홀\n")
        verdict, why = classify(parse_params(b), b)
        self.assertEqual(verdict, "hold")
        self.assertIn("임플란트 17", why)

    def test_inlay_with_crowns_goes(self):
        # 2026-11-04 사용자 "인레이 섞인 케이스 크라운만 진행"
        b = body("크라운 46", "인레이/온레이 47")
        self.assertEqual(classify(parse_params(b), b), ("inlay", "47"))

    def test_inlay_only_holds(self):
        b = body("인레이/온레이 45", "인레이/온레이 46")
        self.assertEqual(classify(parse_params(b), b)[0], "hold")

    def test_inlay_inside_bridge_holds(self):
        b = SMART.format(rows="브릿지 45-47\nPreset - 3D Printing\n└ 인레이/온레이 45\n└ 폰틱 46\n└ 크라운 47\n")
        self.assertEqual(classify(parse_params(b), b)[0], "hold")

    def test_anterior_holds(self):
        # 2026-11-06 "전치부는 제외하자"
        self.assertEqual(classify(["브릿지 33-37"], body("브릿지 33-37"))[0], "hold")
        self.assertIn("33", classify(["브릿지 33-37"], body("브릿지 33-37"))[1])
        self.assertEqual(classify(["크라운 13"], body("크라운 13"))[0], "hold")
        self.assertEqual(classify(["브릿지 11-21"], body("브릿지 11-21"))[0], "hold")
        self.assertEqual(classify(["브릿지 34-36"], body("브릿지 34-36"))[0], "go")
        b2 = body("크라운 46", "인레이/온레이 13")  # 앞니 인레이는 빼고 구치부만 — 인레이 길 그대로
        self.assertEqual(classify(parse_params(b2), b2), ("inlay", "13"))

    def test_nothing_holds(self):
        self.assertEqual(classify([], "치료 대상 치아가 감지되지 않았습니다")[0], "hold")


class GroupTest(unittest.TestCase):
    def test_groups(self):
        bridges, singles = groups_from(["브릿지 35-34", "크라운 17"])
        self.assertEqual(bridges, [[34, 35]])
        self.assertEqual(singles, [17])

    def test_cross_midline(self):
        self.assertEqual(groups_from(["브릿지 11-21"])[0], [[11, 21]])

    def test_pontics(self):
        self.assertEqual(pontics_from("브릿지 44-46\n크라운 44\n폰틱 45\n크라운 46", [44, 45, 46]), [45])


class NeutralNameTest(unittest.TestCase):
    """덴트버드에 올리는 파일 이름에 환자 이름이 남지 않게 (2026-11-04)"""

    def test_copies_without_patient_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            (work / "홍길동-upperjaw.stl").write_bytes(b"u")
            (work / "홍길동-lowerjaw.stl").write_bytes(b"l")
            up, low = neutral(jaws(work), work / "_up")
            self.assertEqual((up.name, low.name), ("upperjaw.stl", "lowerjaw.stl"))
            self.assertEqual((up.read_bytes(), low.read_bytes()), (b"u", b"l"))
            # 두 번째 실행 — 남은 사본을 원본으로 다시 고르지 않음
            self.assertEqual([p.name for p in jaws(work)], ["홍길동-upperjaw.stl", "홍길동-lowerjaw.stl"])


class ServerFolderTest(unittest.TestCase):
    """서버PC 공유 폴더 (2026-11-04) — 복사 중인 파일은 건너뛰고, 끝난 dxd 는 옮겼다가 14일 뒤 지움"""

    def _old(self, p: Path, days: float = 0, minutes: float = 10) -> None:
        t = time.time() - days * 86400 - minutes * 60
        os.utime(p, (t, t))

    def test_skips_file_still_copying(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp)
            (f / "a.dxd").write_bytes(b"x")
            self._old(f / "a.dxd")
            (f / "b.dxd").write_bytes(b"x")  # 방금 들어옴
            self.assertEqual([p.name for p in items_in(f)], ["a.dxd"])

    def test_done_moved_retry_kept_old_removed(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp)
            for n in ("done.dxd", "again.dxd", "new.dxd"):
                (f / n).write_bytes(b"x")
            (f / "_끝남").mkdir()
            (f / "_끝남" / "old.dxd").write_bytes(b"x")
            self._old(f / "_끝남" / "old.dxd", days=15)
            log = {"items": [{"file": "done.dxd"}, {"file": "again.dxd", "retry": True}]}
            self.assertEqual(tidy_done(f, log), (1, 1))
            self.assertEqual(sorted(p.name for p in f.glob("*.dxd")), ["again.dxd", "new.dxd"])
            self.assertEqual([p.name for p in (f / "_끝남").iterdir()], ["done.dxd"])


class ShotNameTest(unittest.TestCase):
    """그림 이름을 'R04_교합면.png' 로 (2026-11-04) — 예전 이름(옆·안쪽·반대쪽)도"""

    def test_rename_and_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp)
            (f / "그림").mkdir()
            old = ["1104_17_1_옆.png", "1104_17_2_교합면.png", "1104_17_3_안쪽.png", "1104_17_4_반대쪽.png"]
            for n in old:
                (f / "그림" / n).write_bytes(b"x")
            got = name_shots(f, "R04", [f"그림/{n}" for n in old])
            self.assertEqual(got, ["그림/R04_교합면.png", "그림/R04_마진면.png", "그림/R04_협면.png", "그림/R04_설면.png"])
            self.assertEqual(sorted(p.name for p in (f / "그림").iterdir()),
                             sorted(x.split("/")[1] for x in got))


class PurgeTest(unittest.TestCase):
    """판정 끝난 건은 dxd·그림을 지우고 기록은 남김 (2026-11-04)"""

    def test_purge(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp)
            (f / "_끝남").mkdir()
            (f / "그림").mkdir()
            (f / "_끝남" / "a.dxd").write_bytes(b"x")
            (f / "b.dxd").write_bytes(b"x")
            (f / "그림" / "R01_교합면.png").write_bytes(b"x")
            log = {"items": [{"file": "a.dxd", "verdict": "정상", "shots": ["그림/R01_교합면.png"]},
                             {"file": "b.dxd", "shots": [], "verdict": "비정상", "retry": True}]}
            self.assertEqual(purge_judged(f, log), (1, 1))  # 다시 돌릴 b 는 안 지움
            self.assertTrue((f / "b.dxd").exists())
            self.assertEqual(log["items"][0]["shots"], [])
            self.assertEqual(log["items"][0]["verdict"], "정상")


class ZipTest(unittest.TestCase):
    """zip 안의 위·아래턱 STL (2026-11-04) — 교합 스캔은 거르고, 이름 없는 사본으로"""

    def test_zip(self):
        import zipfile  # noqa: PLC0415
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp)
            z = f / "case.zip"
            with zipfile.ZipFile(z, "w") as zz:
                zz.writestr("홍길동-maxillary.stl", b"u")
                zz.writestr("홍길동-mandibular.stl", b"l")
                zz.writestr("홍길동-occlusionfirst.stl", b"o")
                zz.writestr("../../evil.stl", b"e")
            os.utime(z, (time.time() - 600, time.time() - 600))
            self.assertEqual([p.name for p in items_in(f)], ["case.zip"])
            up, low = prepare(z, f / "_작업" / "case", print)
            self.assertEqual((up.name, low.name, up.read_bytes(), low.read_bytes()), ("upperjaw.stl", "lowerjaw.stl", b"u", b"l"))
            self.assertFalse((f.parent / "evil.stl").exists())


class VerdictFileTest(unittest.TestCase):
    """판정은 따로 — 실행이 기록을 덮어써도 남음 (2026-11-04 R08 판정이 지워진 일)"""

    def test_survives_log_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp)
            save_log(f, {"items": [{"file": "a.dxd", "number": "R08", "status": "done"}]})
            set_verdict(f, "R08", "비정상", "폰틱 하단 이상")
            # 돌고 있던 실행이 옛 메모리로 기록을 덮어씀
            save_log(f, {"items": [{"file": "a.dxd", "number": "R08", "status": "done"}, {"file": "b.dxd", "number": "R09", "status": "done"}]})
            log = load_log(f)
            r08 = next(i for i in log["items"] if i["number"] == "R08")
            self.assertEqual((r08["verdict"], r08["verdict_note"]), ("비정상", "폰틱 하단 이상"))
            self.assertNotIn("verdict", next(i for i in log["items"] if i["number"] == "R09"))
            # 기록 파일 자체에는 판정이 안 들어감
            self.assertNotIn("verdict", (f / "밤작업_기록.json").read_text(encoding="utf-8"))


class CloseTabTest(unittest.TestCase):
    """이미 사라진 탭을 닫으려다 멈추지 않음 (2026-11-06 10:08)"""

    def test_gone_tab_is_fine(self):
        from batch_review import _close_tab

        class Gone(Exception):
            pass

        class D:
            window_handles = ["home"]
            def execute_cdp_cmd(self, *a): raise Gone("no target")
            class switch_to:
                @staticmethod
                def window(h): raise Gone("no such window")
            def close(self): raise Gone("x")

        _close_tab(D(), "old")  # 오류 없이 지나가야 함


class NightKeyTest(unittest.TestCase):
    """설계 일꾼이 밤 실행을 띄우는 시각 — 21시부터 새벽 6시 전까지, 새벽은 전날 밤으로 셈"""

    def test_night_window(self):
        import importlib  # noqa: PLC0415
        w = importlib.import_module("design_" + "worker")
        at = lambda h: time.strptime(f"2026-11-04 {h:02d}:30", "%Y-%m-%d %H:%M")  # noqa: E731
        self.assertEqual(w.night_key(at(21)), "2026-11-04")
        self.assertEqual(w.night_key(at(2)), "2026-11-03")
        self.assertIsNone(w.night_key(at(10)))


if __name__ == "__main__":
    unittest.main()
