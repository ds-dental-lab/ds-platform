-- =========================================================
-- designer_user_id 가 가리키는 곳을 user_profiles 로 맞춥니다.
--
-- ★ 처음에 auth.users 를 가리켰는데, 이 스키마의 다른 '사람' 열은
--   전부 user_profiles 입니다 (orders.created_by, order_files.uploaded_by,
--   order_status_history.actor_user_id …). 혼자 다른 곳을 가리키면
--   ① 이름을 붙여 읽을 때 한 번 더 물어봐야 하고
--   ② 다음 사람이 "왜 여기만 다르지" 를 매번 다시 확인합니다.
--
--   user_profiles.id 자체가 auth.users(id) 를 가리키므로 무결성은 같습니다.
-- =========================================================

alter table orders drop constraint orders_designer_user_id_fkey;

alter table orders
  add constraint orders_designer_user_id_fkey
  foreign key (designer_user_id) references user_profiles(id) on delete set null;
