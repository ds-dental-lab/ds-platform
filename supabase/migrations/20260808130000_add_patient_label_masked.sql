-- =========================================================
-- DS Flow — 기공소용 환자 표시값
-- Sprint 4
-- 파일 위치: supabase/migrations/<타임스탬프>_add_patient_label_masked.sql
-- 기준: 시스템설계서 §8.5 민감 필드 차단
--
-- 왜 컬럼을 따로 두는가.
--   orders.patient_label 에는 환자 실명이 들어 있고, 기공소도 orders 를
--   읽을 수 있습니다(자기에게 배정된 건). RLS 는 행 단위라 특정 컬럼만
--   가릴 수 없으므로, 마스킹 값을 아예 별도 컬럼에 두고
--   기공소에게는 이 컬럼만 골라 읽어 줍니다.
--
--   "화면에서 숨기는 것이 아니라 응답에 아예 담기지 않아야 한다" (§8.5)
-- =========================================================

alter table orders add column patient_label_masked text;

comment on column orders.patient_label        is '목록 표시용 캐시. 실명이 들어 있어 기공소에는 내려보내지 않습니다';
comment on column orders.patient_label_masked is '기공소에 내려보내는 마스킹 값 (설계서 §8.5)';

-- ---------- 기존 주문 채우기 ----------
-- 환자가 연결된 주문은 마스킹 이름 + 차트번호로 다시 만듭니다.
update orders o
   set patient_label_masked = p.name_masked || ' (' || p.chart_no || ')'
  from patients p
 where p.id = o.patient_id
   and o.patient_label_masked is null;

-- 환자 연결이 없는 주문은 알려줄 것이 없습니다.
update orders
   set patient_label_masked = '(비공개)'
 where patient_label_masked is null;

alter table orders alter column patient_label_masked set not null;
