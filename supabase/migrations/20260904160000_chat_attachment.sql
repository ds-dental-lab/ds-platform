-- =========================================================
-- 대화에 파일을 붙입니다. (사용자 요청 2026-09-04 —
--   "대화창에서 카톡처럼 다운로드받고 바로 볼 수 있게")
--
-- ★★ 대화가 파일을 **가지지 않고 가리킵니다.**
--   떨어뜨린 파일은 그 주문의 order_files 로 들어가고(kind photo·etc),
--   대화 줄은 그 id 하나만 듭니다. 그래야 있는 규칙을 그대로 탑니다 —
--   보관기간·파기, 기공소는 사진만, 열람 기록, 용량 셈, 주문상세 파일 칸.
--   첨부 저장을 따로 두면 이 다섯을 다시 만들어야 하고 하나는 빠집니다.
--
-- ★ 파일이 지워지면 줄은 남고 file_id 만 비웁니다(set null).
--   "파일을 보냈다" 는 사실과 그 시각은 대화의 일부입니다.
--
-- ★ 글 없이 파일만 보낼 수 있어야 합니다. 그래서 본문 제약을 풉니다 —
--   파일이 있으면 본문이 비어도 되고, 없으면 전처럼 한 글자는 있어야
--   합니다. 200자 상한은 그대로입니다.
-- =========================================================

alter table order_messages
  add column file_id uuid references order_files(id) on delete set null;

alter table order_messages
  drop constraint if exists order_messages_body_check;

alter table order_messages
  add constraint order_messages_body_check
    check (
      char_length(body) <= 200
      and (file_id is not null or char_length(btrim(body)) >= 1)
    );

comment on column order_messages.file_id is
  '대화에 붙인 파일. 그 주문의 order_files 를 가리킵니다 — 대화가 파일을 갖지 않습니다';

create index order_messages_file_idx on order_messages (file_id) where file_id is not null;
