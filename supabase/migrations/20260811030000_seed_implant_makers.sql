-- =========================================================
-- DS Flow — 임플란트 제조사 보강
-- 파일 위치: supabase/migrations/<타임스탬프>_seed_implant_makers.sql
-- 기준: 사용자가 준 임플란트 모델 등록 화면 (2026-08-11)
--
-- 화면에 나오던 제조사 목록을 채웁니다.
-- 이미 있는 것(Osstem · Dentium · Neobiotech)은 건드리지 않습니다.
--
-- ★ 타입·사이즈·스크류는 넣지 않았습니다.
--   제조사마다 실제 값이 달라 임의로 채우면 틀린 데이터가 됩니다.
--   디자인센터가 임플란트 마스터 화면에서 채워 넣습니다.
-- =========================================================

insert into implant_makers (code, name, sort_order) values
  ('BRT', 'Bright',        10),
  ('DTS', 'Dentis',        11),
  ('DIO', 'Dio',           12),
  ('IBS', 'IBS implant',   13),
  ('MGN', 'Megagen',       14),
  ('PNT', 'Point implant', 15),
  ('STM', 'straumann',     16)
on conflict (code) do nothing;

-- 이름순으로 보이도록 기존 세 곳의 순서를 다시 잡습니다
update implant_makers set sort_order = 1 where code = 'DTM';   -- Dentium
update implant_makers set sort_order = 2 where code = 'NBT';   -- Neobiotech
update implant_makers set sort_order = 3 where code = 'OST';   -- Osstem
