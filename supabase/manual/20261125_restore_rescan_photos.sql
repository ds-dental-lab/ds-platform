-- 재스캔 재등록 때 스캔과 함께 치워진 사진·대화 첨부를 되살립니다. (일회용, 2026-11-25)
--
-- 까닭: 화면이 '디자인 파일이 아닌 것 전부' 를 치울 목록으로 보내서
--       스캔을 새로 올리면 사진까지 deleted_at 이 채워졌습니다.
--       파일 자체는 저장소에 그대로 있습니다 — 표시만 되돌리면 다시 보입니다.
--
-- 대상: 재스캔 → 접수로 돌아간 시각 앞뒤 30초 안에 치워진 photo·etc 줄.
--       (2026-11-25 기준 2줄, 주문 2건)
-- 여러 번 돌려도 같습니다 — 두 번째부터는 0줄입니다.

with back as (
  select order_id, created_at
  from order_status_history
  where from_status = 'rescan' and to_status = 'received'
),
restored as (
  update order_files f
  set deleted_at = null
  from back b
  where b.order_id = f.order_id
    and f.kind in ('photo', 'etc')
    and f.deleted_at between b.created_at - interval '30 seconds'
                         and b.created_at + interval '30 seconds'
  returning f.id
)
select count(*) as restored from restored;
