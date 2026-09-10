# -*- coding: utf-8 -*-
"""
exocad DentalDB(sqlite) 에 케이스를 **직접 등록** — 가져오기 클릭 없애기. (2026-09-10)

★ 왜: DentalDB 목록은 폴더가 아니라 CAD-Data/DentalDB_V3.sqlite 를 읽습니다.
  가져오기(Import)가 하는 일을 2026-09-09~10 에 전후 비교로 알아냈고, 그대로 씁니다.

★ 가져오기가 만드는 줄 (실측):
  patients            (0, 1, pid, fname='', lname=환자명, NULL)
  WorkParamsInfo      (hash=템플릿과 같음, '2000-01-01 00:00:00Z') + WorkParamsInfoLocalImport(id)
  Treatment           practice 0/1, patient pid, t_date, t_schaleId(TrayNo), flags 0, projectGUID,
                      workParamsSHA, workParamInfoId, loggedInUserHash…
  ToothWork           치아마다 (ToothId, flags = MesialConnector ? 1 : 0, WorkTypeSN, MaterialSN)
  ToothWorkParameters + Numeric/Textual 자식 (~38줄/치아), DependentToothWorkParameters(ImplantType→ScanAbutmentScan)
  ValuedMaterialParameters (ZI 치아마다 Color '---')
  TreatmentValuedParameters (ToothColor '---', AntagonistType 'DigitalImpressionScan')

★ 방법: 치아 종류별 파라미터 줄은 **이미 DB 에 있는 같은 종류의 치아를 복제**합니다
  (crown/inlay/pontic/healthy/antagonist/implant). 값을 우리가 지어내지 않습니다.
★ exocad 가 DB 를 열어 둔 채라 잠금이 걸릴 수 있습니다 → 실패하면 예외를 던지고,
  런처는 "가져오기를 누르세요" 로 물러섭니다. 반쯤 쓰이는 일은 없습니다(한 트랜잭션).
★ ProjectGUID·PatientId·TrayNo 는 .dentalProject 와 **같아야** 합니다 — 호출자가 맞춥니다.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from pathlib import Path

# Denflow 종류 → (WorkTypeSN, MaterialSN, ImplantType 텍스트 파라미터)
KIND = {
    "crown": ("AnatomicCrown", "ZI", "None"),
    "implant": ("AnatomicCrown", "ZI", "CustomAbutment"),
    "inlay": ("AnatomicInlay", "ZI", None),
    "pontic": ("AnatomicPontic", "ZI", None),
    "healthy": ("HealthyTooth", "Healthy", None),
    "antagonist": ("Antagonist", "Healthy", None),
}


class ExocadDb:
    def __init__(self, cad_data: Path) -> None:
        self.path = cad_data / "DentalDB_V3.sqlite"
        if not self.path.is_file():
            raise RuntimeError(f"DentalDB 가 없습니다: {self.path}")
        self.c = sqlite3.connect(self.path, timeout=5)
        self.c.row_factory = sqlite3.Row

    def close(self) -> None:
        self.c.close()

    def next_patient_id(self) -> int:
        (m,) = self.c.execute("select coalesce(max(patient_id),0) from patients").fetchone()
        return int(m) + 1

    # ---------- 템플릿 찾기 ----------

    def _template_toothwork(self, kind: str) -> sqlite3.Row:
        wt, mat, impl = KIND[kind]
        if impl is None:
            q = ("select tw.* from ToothWork tw where tw.WorkTypeSN=? and tw.MaterialSN=? "
                 "order by tw.id desc limit 1")
            row = self.c.execute(q, (wt, mat)).fetchone()
        else:
            q = ("select tw.* from ToothWork tw join ToothWorkParameters p on p.toothWork_id=tw.id "
                 "join TextualToothWorkParameter t on t.id=p.id "
                 "where tw.WorkTypeSN=? and tw.MaterialSN=? and t.ParameterSN='ImplantType' and t.ValueSN=? "
                 "order by tw.id desc limit 1")
            row = self.c.execute(q, (wt, mat, impl)).fetchone()
        if row is None:
            raise RuntimeError(f"템플릿 치아가 DB 에 없습니다: {kind} ({wt}/{mat}/{impl})")
        return row

    def _template_treatment(self) -> sqlite3.Row:
        # 가장 최근 것 — 사용자 해시·SHA 같은 상수 값을 빌립니다
        row = self.c.execute("select * from Treatment where workParamsSHA is not null order by treatment_id desc limit 1").fetchone()
        if row is None:
            raise RuntimeError("템플릿 Treatment 가 없습니다")
        return row

    # ---------- 등록 ----------

    def register(
        self,
        patient_name: str,
        patient_id: int,
        project_guid: str,
        tray_no: int,
        when: dt.datetime,
        teeth: list[tuple[int, str, bool]],   # (번호, kind, mesial)
    ) -> int:
        c = self.c
        tt = self._template_treatment()
        try:
            c.execute("begin immediate")
            # 환자
            c.execute("insert into patients (lab_id, practice_id, patient_id, fname, lname, dateOfBirth) values (0,1,?,?,?,NULL)",
                      (patient_id, "", patient_name))
            # WorkParamsInfo (+ LocalImport)
            c.execute("insert into WorkParamsInfo (workParamsDataHash, lastModificationDate) values (?, '2000-01-01 00:00:00Z')",
                      (self._wp_hash(tt),))
            wpi = c.execute("select last_insert_rowid()").fetchone()[0]
            c.execute("insert into WorkParamsInfoLocalImport (id) values (?)", (wpi,))
            # Treatment
            c.execute(
                "insert into Treatment (practice_lab_id, practice_pr_id, patient_lab_id, patient_practice_id, patient_patient_id, "
                "tech_lab_id, tech_tech_id, t_date, t_schaleId, t_Notes, moonlighting, flags, lockedby, imported_from_path, projectGUID, "
                "workParamsSHA, workParamsSignature, importedOrderId, importDebugInformation, workParamInfoId, t_duedate, ds_status, "
                "loggedInUserHashWhoCreatedTheCase, loggedInUserHashWhoLastSavedTheCase, midc_status) "
                "values (0,1,0,1,?, NULL,NULL, ?, ?, NULL, 0, 0, NULL, NULL, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, ?, ?, NULL)",
                (patient_id, when.strftime("%Y-%m-%d %H:%M:%S.%f"), tray_no, project_guid,
                 tt["workParamsSHA"], wpi, tt["loggedInUserHashWhoCreatedTheCase"], tt["loggedInUserHashWhoLastSavedTheCase"]),
            )
            tid = c.execute("select last_insert_rowid()").fetchone()[0]
            # 치아
            for number, kind, mesial in teeth:
                self._clone_tooth(tid, number, kind, mesial)
            # 케이스 파라미터
            for sn, val in (("ToothColor", "---"), ("AntagonistType", "DigitalImpressionScan")):
                c.execute("insert into TreatmentValuedParameters (PARAM_TYPE, ParamSN, ValueSN, treatment_id) values ('TEXTUAL',?,?,?)", (sn, val, tid))
            c.execute("commit")
            return tid
        except Exception:
            c.execute("rollback")
            raise

    def _wp_hash(self, tt: sqlite3.Row) -> str:
        row = self.c.execute("select workParamsDataHash from WorkParamsInfo where id=?", (tt["workParamInfoId"],)).fetchone()
        if row is None:
            raise RuntimeError("템플릿 WorkParamsInfo 가 없습니다")
        return row[0]

    def _clone_tooth(self, tid: int, number: int, kind: str, mesial: bool) -> None:
        c = self.c
        src = self._template_toothwork(kind)
        c.execute("insert into ToothWork (WorkParams, WorkParamsFile, ToothId, flags, WorkTypeSN, MaterialSN, treatment_id) values (?,?,?,?,?,?,?)",
                  (src["WorkParams"], src["WorkParamsFile"], str(number), 1 if mesial else 0, src["WorkTypeSN"], src["MaterialSN"], tid))
        new_tw = c.execute("select last_insert_rowid()").fetchone()[0]
        for p in c.execute("select * from ToothWorkParameters where toothWork_id=? order by id", (src["id"],)).fetchall():
            c.execute("insert into ToothWorkParameters (custom_wd_id, toothWork_id) values (?,?)", (p["custom_wd_id"], new_tw))
            new_p = c.execute("select last_insert_rowid()").fetchone()[0]
            t = c.execute("select * from TextualToothWorkParameter where id=?", (p["id"],)).fetchone()
            if t is not None:
                c.execute("insert into TextualToothWorkParameter (id, ParameterSN, ValueSN) values (?,?,?)", (new_p, t["ParameterSN"], t["ValueSN"]))
                for d in c.execute("select * from DependentToothWorkParameters where parent_param_id=?", (p["id"],)).fetchall():
                    c.execute("insert into DependentToothWorkParameters (parent_param_id, dep_param_string, dep_param_value_string, dep_param_kind) values (?,?,?,?)",
                              (new_p, d["dep_param_string"], d["dep_param_value_string"], d["dep_param_kind"]))
            n = c.execute("select * from NumericToothWorkParameter where id=?", (p["id"],)).fetchone()
            if n is not None:
                c.execute("insert into NumericToothWorkParameter (id, ParameterSN, value) values (?,?,?)", (new_p, n["ParameterSN"], n["value"]))
                for d in c.execute("select * from DependentOnNumericToothWorkParameters where parent_param_id=?", (p["id"],)).fetchall():
                    c.execute("insert into DependentOnNumericToothWorkParameters (parent_param_id, dep_param_string, dep_param_value_string, dep_param_kind) values (?,?,?,?)",
                              (new_p, d["dep_param_string"], d["dep_param_value_string"], d["dep_param_kind"]))
        for v in c.execute("select * from ValuedMaterialParameters where toothwork_id=?", (src["id"],)).fetchall():
            c.execute("insert into ValuedMaterialParameters (PARAM_TYPE, ValueSN, MaterialSN, MaterialPropertySN, toothwork_id) values (?,?,?,?,?)",
                      (v["PARAM_TYPE"], v["ValueSN"], v["MaterialSN"], v["MaterialPropertySN"], new_tw))


    def delete_treatment(self, tid: int) -> None:
        """우리가 넣은 케이스를 되돌립니다 (시험 정리용). 환자 줄은 다른 치료가 안 쓰면 같이."""
        c = self.c
        c.execute("begin immediate")
        try:
            tws = [r[0] for r in c.execute("select id from ToothWork where treatment_id=?", (tid,))]
            for tw in tws:
                ps = [r[0] for r in c.execute("select id from ToothWorkParameters where toothWork_id=?", (tw,))]
                for p in ps:
                    c.execute("delete from DependentToothWorkParameters where parent_param_id=?", (p,))
                    c.execute("delete from DependentOnNumericToothWorkParameters where parent_param_id=?", (p,))
                    c.execute("delete from TextualToothWorkParameter where id=?", (p,))
                    c.execute("delete from NumericToothWorkParameter where id=?", (p,))
                c.execute("delete from ToothWorkParameters where toothWork_id=?", (tw,))
                c.execute("delete from ValuedMaterialParameters where toothwork_id=?", (tw,))
            c.execute("delete from ToothWork where treatment_id=?", (tid,))
            c.execute("delete from TreatmentValuedParameters where treatment_id=?", (tid,))
            row = c.execute("select patient_patient_id, workParamInfoId from Treatment where treatment_id=?", (tid,)).fetchone()
            c.execute("delete from Treatment where treatment_id=?", (tid,))
            if row:
                pid, wpi = row
                if c.execute("select count(*) from Treatment where patient_patient_id=?", (pid,)).fetchone()[0] == 0:
                    c.execute("delete from patients where patient_id=?", (pid,))
                c.execute("delete from WorkParamsInfoLocalImport where id=?", (wpi,))
                c.execute("delete from WorkParamsInfo where id=?", (wpi,))
            c.execute("commit")
        except Exception:
            c.execute("rollback")
            raise


def teeth_from_plan(work: dict[int, str], mesial: set[int], healthy: set[int], antagonist: int | None) -> list[tuple[int, str, bool]]:
    """make_project 의 계산 결과를 DB 등록용 목록으로."""
    out = [(n, k, n in mesial) for n, k in sorted(work.items())]
    out += [(n, "healthy", False) for n in sorted(healthy)]
    if antagonist is not None:
        out.append((antagonist, "antagonist", False))
    return out
