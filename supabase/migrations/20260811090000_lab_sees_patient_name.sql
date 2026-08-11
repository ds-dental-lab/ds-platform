-- =========================================================
-- DS Flow — 기공소 알림에 환자 실명 되돌리기
-- 파일 위치: supabase/migrations/<타임스탬프>_lab_sees_patient_name.sql
-- 기준: 사용자 결정 2026-08-11 (설계서 §8.5 를 이 부분만 뒤집습니다)
--
-- 무엇이 바뀌었나.
--   §8.5 를 따라 기공소에게는 마스킹 이름(박*)만 보냈습니다.
--   그런데 기공소는 완성품을 치과로 보낼 때 환자 이름으로 케이스를
--   구분합니다. 이름을 가리면 어느 봉투가 누구 것인지 알 수가 없습니다.
--
--   앞선 20260808170000 이 이미 쌓인 알림을 마스킹으로 바꿔 놨습니다.
--   이 파일은 그것을 되돌립니다.
--
-- ★ 실명 차단은 '배정받은 주문만' 이 대신합니다.
--   orders 의 select 정책이 lab_org_id = my_org_id() 로 잠가 두어,
--   기공소는 디자인센터가 넘겨준 건만 봅니다.
--   치과 전체의 환자 명단을 긁을 길은 여전히 없습니다.
--
-- ★ patient_label_masked 컬럼은 지우지 않습니다.
--   채우는 것도 그대로 둡니다 — 다시 가려야 할 날이 오면
--   읽는 쪽만 바꾸면 되도록 남겨 둡니다.
-- =========================================================

update notifications n
   set body = replace(n.body, o.patient_label_masked, o.patient_label)
  from orders o
 where n.body is not null
   and (n.payload ->> 'orderId') = o.id::text
   -- 받는 쪽이 그 주문의 기공소인 알림만
   and n.org_id = o.lab_org_id
   and o.patient_label_masked is not null
   and o.patient_label_masked <> o.patient_label
   and position(o.patient_label_masked in n.body) > 0;
