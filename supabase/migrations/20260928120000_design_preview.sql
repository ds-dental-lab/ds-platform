-- =========================================================
-- 디자인 파일 미리보기 (2026-09-28, 사용자 요청)
--
-- 신터링이 끝난 크라운이 어느 환자 것인지 눈으로 찾으려고, STL 을 여섯 방향에서
-- 그린 그림 한 장을 파일마다 붙입니다 (런처의 'STL → 이미지' 와 같은 그림).
--
-- ★ 그림은 **올리는 브라우저**가 만듭니다 — 서버에서 3D 를 돌리면 느리고 큽니다.
-- ★ 같은 버킷(order-files)에 두되 order_files 에는 줄을 만들지 않습니다.
--   줄을 만들면 '파일 개수' 와 목록에 그림이 섞입니다. 대신 칸 하나를 답니다.
-- ★ 기공소도 봐야 합니다(디자인 파일을 받는 쪽) — 읽기 문지기에 미리보기를 엽니다.
-- =========================================================

alter table order_files
  add column if not exists preview_path text;

comment on column order_files.preview_path is
  '여섯 방향 미리보기 그림의 저장소 경로. 디자인 STL 에만 붙습니다 (2026-09-28)';

create or replace function can_read_order_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- 기공소가 아니면 볼 것 다 봅니다
    when my_org_type() is distinct from 'lab' then true
    else coalesce(
      (
        select f.kind = 'design'
            or lower(regexp_replace(f.file_name, '^.*\.', '')) in
               ('png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'heif')
          from order_files f
         where f.storage_path = object_name
         limit 1
      ),
      -- 미리보기 그림 — 디자인 파일에 붙은 것이므로 기공소도 봅니다 (2026-09-28)
      (select exists (select 1 from order_files p where p.preview_path = object_name)),
      false   -- 표에 없는 덩어리는 닫습니다
    )
  end;
$$;

comment on function can_read_order_file(text) is
  '기공소가 이 덩어리를 읽어도 되는가. 기공소는 디자인 파일·사진·미리보기만 (2026-08-20, 2026-09-28)';
