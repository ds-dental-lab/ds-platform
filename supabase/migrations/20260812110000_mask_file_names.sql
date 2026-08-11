-- =========================================================
-- DS Flow — 파일 이름에서 환자 이름을 걷어냅니다
-- 파일 위치: supabase/migrations/<타임스탬프>_mask_file_names.sql
--
-- 왜 필요한가.
--   치과가 보내는 스캔 파일 이름에 환자 이름이 그대로 들어 있습니다 —
--   `2026-08-11-박나래-26.obj`, `2026-08-07_노승희(23384)-17-...stl`.
--   지금 열여덟 개 중 열세 개가 그렇습니다.
--
--   저장소 **경로**는 진작 이름을 뗐습니다(uuid). 그런데 표시용 file_name 이
--   원본 그대로였고, 내려받기 주소에 그 이름을 실어 보냅니다.
--   그래서 기공소가 받으면 **그 이름 그대로 PC 에 저장**됩니다.
--
--   그 순간 환자 이름이 우리 손을 떠납니다. 열람기록도 보관기간도 파기도
--   닿지 않는 곳으로 — 폴더에 쌓이고, 메일에 실리고, 백업에 들어갑니다.
--
-- ★ 원본 이름을 어디에도 안 남깁니다.
--   한 칸이라도 남겨 두면 RLS 로는 그 칸만 가릴 수 없습니다 (행 단위라서).
--   제품 판매가에서 이미 겪은 일입니다.
--
-- ★ 코드가 안 보내는 것과 DB 가 못 받는 것은 다릅니다 (설계서 §5.3 결정 2).
--   화면은 이제 지은 이름만 보내지만, 손으로 부른 요청은 아무 이름이나
--   보낼 수 있습니다. 트리거가 마지막 문입니다.
-- =========================================================

-- ---------- 조각 ----------

-- 종류마다 붙는 말. src/server/domain/file-name 의 FILE_KIND_TAG 와 같아야 합니다
create or replace function order_file_kind_tag(p_kind order_file_kind)
returns text
language sql immutable as $$
  select case p_kind
    when 'scan'   then '스캔'
    when 'design' then '디자인'
    when 'photo'  then '사진'
    else '기타'
  end;
$$;

-- 확장자만. 영문·숫자가 아닌 글자가 섞이면 그건 확장자가 아니라 이름의 일부입니다
create or replace function order_file_ext(p_name text)
returns text
language sql immutable as $$
  select coalesce(substring(p_name from '\.([A-Za-z0-9]{1,10})$'), '');
$$;

-- ---------- 있던 것 고치기 ----------
--
-- 올라온 차례대로 1, 2, 3 을 붙입니다. 종류가 다르면 따로 셉니다.
with numbered as (
  select
    f.id,
    o.order_no,
    f.kind,
    row_number() over (
      partition by f.order_id, f.kind order by f.created_at, f.id
    ) as seq,
    order_file_ext(f.file_name) as ext
  from order_files f
  join orders o on o.id = f.order_id
)
update order_files f
set file_name = n.order_no || '_' || order_file_kind_tag(n.kind) || n.seq
                || case when n.ext = '' then '' else '.' || n.ext end
from numbered n
where n.id = f.id;

-- ---------- 앞으로 들어올 것 막기 ----------

create or replace function mask_order_file_name()
returns trigger
language plpgsql as $$
declare
  v_no text;
begin
  select order_no into v_no from orders where id = new.order_id;

  if v_no is null then
    return new;  -- 주문이 없으면 외래키가 막습니다
  end if;

  -- 화면이 지어 보낸 이름이면 그대로 씁니다.
  -- ★ 이 규칙은 domain/file-name 의 isMaskedName 과 글자 그대로 같아야 합니다.
  --   여기서 다시 고쳐 쓰면 화면에 보이는 이름과 내려받는 이름이 어긋납니다.
  if new.file_name ~ ('^' || v_no || '_(스캔|디자인|사진|기타)[0-9]+(\.[A-Za-z0-9]{1,10})?$')
  then
    return new;
  end if;

  -- 그 밖의 이름은 여기서 버립니다.
  -- 번호를 세지 않고 행 id 에서 뽑습니다 — 한 문장으로 여러 줄을 넣을 때
  -- 아직 안 보이는 형제 줄이 있어, 세면 전부 같은 번호가 됩니다.
  new.file_name :=
    v_no || '_' || order_file_kind_tag(new.kind)
    || (abs(hashtext(new.id::text)) % 100000)::text
    || case when order_file_ext(new.file_name) = ''
            then '' else '.' || order_file_ext(new.file_name) end;

  return new;
end;
$$;

create trigger order_files_mask_name
  before insert or update of file_name on order_files
  for each row execute function mask_order_file_name();
