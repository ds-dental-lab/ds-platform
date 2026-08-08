create type order_file_kind as enum ('scan', 'design', 'photo', 'etc');

create table order_files (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  kind         order_file_kind not null default 'scan',
  storage_path text not null unique,
  file_name    text not null,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid references user_profiles(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index order_files_order_idx on order_files (order_id, kind);

alter table order_files enable row level security;

create policy order_file_select on order_files
  for select using (
    exists (select 1 from orders o where o.id = order_files.order_id)
  );

create policy order_file_insert on order_files
  for insert with check (
    exists (select 1 from orders o where o.id = order_files.order_id)
  );

create policy order_file_update on order_files
  for update using (
    exists (select 1 from orders o where o.id = order_files.order_id)
  );
