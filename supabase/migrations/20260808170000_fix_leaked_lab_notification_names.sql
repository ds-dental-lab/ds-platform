-- =========================================================
-- DS Flow — 기공소 알림에 남은 환자 실명 정리
-- Sprint 5 (수습)
-- 파일 위치: supabase/migrations/<타임스탬프>_fix_leaked_lab_notification_names.sql
-- 기준: 시스템설계서 §8.5 민감 필드 차단
--
-- 무슨 일이 있었나.
--   인앱 알림을 처음 붙일 때 본문을 orders.patient_label(실명)로 만들었습니다.
--   조회 화면에서는 기공소에게 마스킹 값만 주도록 막아 뒀는데,
--   알림 본문이라는 다른 길로 실명이 나갔습니다.
--
--   코드는 고쳤습니다(domain/notification 이 받는 쪽을 보고 값을 고릅니다).
--   이 파일은 그 전에 이미 쌓인 알림을 되돌립니다.
--
-- ★ 알림을 지우지 않고 본문만 바꿉니다.
--   기공소 입장에서는 받은 알림이 사라지는 편이 더 혼란스럽습니다.
-- =========================================================

update notifications n
   set body = replace(n.body, o.patient_label, o.patient_label_masked)
  from orders o
 where n.body is not null
   and (n.payload ->> 'orderId') = o.id::text
   -- 받는 쪽이 그 주문의 기공소인 알림만
   and n.org_id = o.lab_org_id
   and position(o.patient_label in n.body) > 0;
