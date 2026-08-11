-- =========================================================
-- DS Flow — 보철 종류에 성질을 싣습니다
-- 파일 위치: supabase/migrations/<타임스탬프>_type_attributes.sql
-- 기준: 사용자 결정 2026-08-11 — 종류도 추가할 수 있어야 한다
--       (덴쳐 · 교정, 그리고 아직 모르는 것들)
--
-- ★ 종류를 늘릴 수 있게 하려면, 종류에 걸린 규칙도 데이터여야 합니다.
--   코드에 아직 둘이 남아 있었습니다 —
--     ① 임플란트면 모델(제조사·타입)을 반드시 고른다
--     ② 임플란트는 약칭을 'Zir-Cr' 처럼 합치지 않고 재료 이름을 그대로 쓴다
--   덴쳐를 넣는 순간 이 둘이 어디에 걸릴지 알 수 없어집니다.
--
-- ★ 색도 표에서 읽습니다.
--   이미 color 컬럼을 만들어 두고 코드의 TYPE_COLOR 를 쓰고 있었습니다.
--   새 종류를 만들면 색이 회색으로만 나옵니다.
-- =========================================================

alter table prosthesis_types
  add column needs_implant_model boolean not null default false,
  add column abbr_material_only  boolean not null default false,
  -- 치식도에서 옅게 칠하는 색. line 은 이미 color 로 있습니다
  add column color_soft          text not null default '#F4F6F9';

comment on column prosthesis_types.needs_implant_model is '모델(제조사·타입)을 반드시 고르는 종류인가. 임플란트가 그렇습니다';
comment on column prosthesis_types.abbr_material_only  is '약칭에 재료 이름만 쓰는가. 켜면 Zir-Cr 이 아니라 Abut+Zir(SCRP) 처럼 나옵니다';
comment on column prosthesis_types.color_soft          is '치식도·칩의 옅은 바탕색';

-- 지금 코드에 박혀 있던 값을 그대로 옮겨 심습니다
update prosthesis_types
   set needs_implant_model = (code = 'implant'),
       abbr_material_only  = (code = 'implant');

update prosthesis_types set color = '#E0409A', color_soft = '#FCEAF3' where code = 'crown';
update prosthesis_types set color = '#1B63E8', color_soft = '#EDF3FE' where code = 'inlay';
update prosthesis_types set color = '#7C6BE8', color_soft = '#EDEBFB' where code = 'implant';
