-- =========================================================
-- DS Flow — 기공소는 스캔 원본을 못 받습니다 (저장소 문)
-- 파일 위치: supabase/migrations/20260820140000_lab_cannot_read_scan.sql
-- 기준: 사용자 결정 2026-08-20 —
--   "기공소 계정은 스캔 데이터를 다운받을 수 없어야 해.
--    기공소는 쉐이드 파일만 봐야 하고 스캔 파일을 열어 봐서는 안 된다"
--
-- ★★ **화면과 서버 액션만으로는 못 막습니다.**
--   저장소 읽기 정책이 "이 주문의 당사자인가" 만 봤습니다. 그래서
--   기공소 계정이 우리 화면을 안 거치고 저장소 API 를 직접 불러
--   **서명 주소를 스스로 만들 수 있었습니다.** 앱에 문을 달아도
--   그 문 옆으로 지나가는 길이 열려 있던 셈입니다.
--   (이 프로젝트가 8/13 점검에서 같은 자리를 한 번 좁혔는데,
--    그때는 '지우기' 였고 '읽기' 는 셋 다 열어 뒀습니다)
--
-- ★ 무엇을 막는가 — **막을 것을 세지 않고 열 것만 셉니다.**
--   `.stl .obj .dxd .ply` 를 막는 식이면 새 스캐너가 `.3oxz` 를 뱉는
--   날 그대로 새어 나갑니다. 기공소에게는 **사진만** 엽니다.
--   목록은 domain/file-access 의 LAB_OPEN_EXTENSIONS 와 같아야 하고,
--   어긋나면 tests/domain/file-access.test.ts 가 잡습니다.
--
-- ★ 디자인 파일은 확장자를 안 따집니다. 센터가 기공소에게 주라고
--   올린 것이고, 거기 stl 이 들어 있는 것이 정상입니다 — 그게 곧
--   기공소가 깎을 원본입니다.
--
-- ★ 표에 없는 덩어리는 기공소에게 **닫습니다**(coalesce false).
--   경로만 알고 찌르는 것을 막습니다.
--
-- ★ 치과·디자인센터는 그대로입니다. 스캔은 치과가 올린 자기 자료이고
--   센터는 그걸로 설계합니다. 자사 제작이어도 센터는 센터입니다 —
--   my_org_type() 으로 보므로 통합 모델에서도 안 막힙니다.
-- =========================================================

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
      false   -- 표에 없는 덩어리는 닫습니다
    )
  end;
$$;

comment on function can_read_order_file(text) is
  '기공소가 이 덩어리를 읽어도 되는가. 기공소는 디자인 파일과 사진만 (2026-08-20)';

drop policy if exists "order files read" on storage.objects;

create policy "order files read" on storage.objects
  for select using (
    bucket_id = 'order-files'
    and can_access_order(((storage.foldername(name))[2])::uuid)
    and can_read_order_file(name)
  );
