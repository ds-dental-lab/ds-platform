-- =========================================================
-- DS Flow — 미분류 촬영 (명세서 SPEC_shade-photo S5·S6)
-- 파일 위치: supabase/migrations/<타임스탬프>_unsorted_photos.sql
--
-- ★★ **왜 새 표가 필요한가.**
--   order_files 는 주문 없이는 한 줄도 못 만듭니다. 그런데 진료실에서
--   제일 흔한 길은 **일단 찍고 나중에 고르는 것**입니다 — 환자가 입을
--   벌리고 있는데 목록에서 이름을 찾고 있을 수는 없습니다.
--
--   order_files.order_id 를 비울 수 있게 바꾸는 길도 있지만, 그 칸은
--   지금 정책·조회·트리거 수십 군데가 '있다' 고 믿고 씁니다. 거기에
--   null 을 흘리면 어디가 깨지는지 아무도 모릅니다. 새 표가 쌉니다.
--
-- ★ 붙이고 나서도 **줄은 남깁니다**(matched_order_id). 어느 묶음이
--   어디로 갔는지가 남아야 "그 사진 어디 갔지" 에 답할 수 있습니다.
--
-- ★ 치과만 씁니다. 명세의 '데스크에서 나중에 분류' 도 그 치과의
--   데스크톱을 말합니다 — 디자인센터가 남의 미분류 사진을 뒤질 일은
--   없습니다.
-- =========================================================

create table unsorted_photos (
  id            uuid primary key default gen_random_uuid(),
  clinic_org_id uuid not null references organizations(id) on delete cascade,

  /*
    ★ 한 번에 찍은 것들을 묶는 값. 매칭은 **묶음 단위**로 합니다 —
      한 환자를 세 장 찍었으면 세 장이 같이 갑니다. 장마다 고르게
      하면 그게 곧 카톡에서 하던 그 일입니다.
  */
  session_id    uuid not null,

  storage_path  text not null,
  file_name     text not null,
  file_size     bigint,
  mime_type     text,

  taken_by      uuid references user_profiles(id),
  upload_status file_upload_status not null default 'pending',

  -- 붙인 뒤에 채웁니다. 채워진 줄은 미분류함에서 내려갑니다
  matched_order_id uuid references orders(id) on delete set null,
  matched_at    timestamptz,

  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table  unsorted_photos is
  '아직 의뢰서에 안 붙은 쉐이드 사진. 묶음(session_id) 단위로 붙입니다';
comment on column unsorted_photos.session_id is
  '한 번의 촬영 묶음. 매칭은 장이 아니라 이 단위로 합니다';
comment on column unsorted_photos.matched_order_id is
  '어느 주문으로 갔는가. 채워지면 미분류함에서 내려갑니다';

create index unsorted_photos_box_idx
  on unsorted_photos (clinic_org_id, session_id, created_at)
  where matched_order_id is null and deleted_at is null;

-- ---------- 정책 ----------
--
-- ★ 자기 치과 것만입니다. 디자인센터도 기공소도 못 봅니다 —
--   아직 아무 주문에도 안 붙은 사진이라 볼 이유가 없습니다.
alter table unsorted_photos enable row level security;

create policy unsorted_photo_select on unsorted_photos
  for select to authenticated
  using (clinic_org_id = my_org_id() and my_org_type() = 'clinic');

create policy unsorted_photo_insert on unsorted_photos
  for insert to authenticated
  with check (clinic_org_id = my_org_id() and my_org_type() = 'clinic');

create policy unsorted_photo_update on unsorted_photos
  for update to authenticated
  using (clinic_org_id = my_org_id() and my_org_type() = 'clinic');

create policy unsorted_photo_delete on unsorted_photos
  for delete to authenticated
  using (clinic_org_id = my_org_id() and my_org_type() = 'clinic');

-- ---------- 저장소 ----------
--
-- ★ 경로는 `unsorted/{치과조직id}/{묶음id}/{uuid}_file.jpg` 입니다.
--   기존 정책은 `orders/{주문id}/...` 를 보고 두 번째 칸을 주문으로
--   읽습니다. 미분류 경로에서는 그 값이 조직 id 라 can_access_order 가
--   false 를 돌려주고, 그래서 서로 안 부딪힙니다.
--
-- ★ 붙일 때 **옮깁니다**(move). 옮기는 것은 원본에 delete, 새 자리에
--   insert 가 필요합니다 — 아래 정책이 둘 다 열어 줍니다.
create policy "unsorted photos read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'unsorted'
    and (storage.foldername(name))[2] = my_org_id()::text
  );

create policy "unsorted photos write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'unsorted'
    and (storage.foldername(name))[2] = my_org_id()::text
    and my_org_type() = 'clinic'
  );

create policy "unsorted photos remove" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'order-files'
    and (storage.foldername(name))[1] = 'unsorted'
    and (storage.foldername(name))[2] = my_org_id()::text
    and my_org_type() = 'clinic'
  );
