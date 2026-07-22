-- 清掃管理カレンダー DBスキーマ（Supabase / PostgreSQL）
-- 複数施設・複数部屋を BEDS24 の propertyId / roomId に紐付けて管理する

-- BEDS24のアカウントが2つあり、それぞれ別のpropertyId体系を持つため、
-- account_key（例: 'account1' / 'account2'）で必ず組み合わせて区別する
create table properties (
  id uuid primary key default gen_random_uuid(),
  account_key text not null, -- 'account1' / 'account2' など、.envのキーと対応させる
  beds24_property_id integer not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (account_key, beds24_property_id)
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  account_key text not null, -- propertiesと同じaccount_keyを入れる（重複roomId対策）
  beds24_room_id integer not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (account_key, beds24_room_id)
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  account_key text not null,
  beds24_booking_id text not null,
  room_id uuid not null references rooms(id) on delete cascade,
  guest_name text, -- 「個人予約」スコープを許可した場合のみ入る。無ければNULL
  check_in date not null,
  check_out date not null,
  status text not null default 'new', -- BEDS24の値: new / confirmed / request / cancelled
  raw_payload jsonb, -- BEDS24からの生データを保持（デバッグ・再処理用）
  updated_at timestamptz not null default now(),
  unique (account_key, beds24_booking_id)
);

create index bookings_check_out_idx on bookings(check_out);

-- 清掃タスクは基本的に checkout日から自動生成されるが、
-- ステータスや担当者などアプリ側でしか持たない情報を別テーブルで管理する
create table cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  scheduled_date date not null, -- 通常は booking.check_out と同じ
  status text not null default 'pending', -- pending / in_progress / done / needs_check
  assignee text,
  same_day_checkin boolean not null default false, -- 同日に次のチェックインがあるか
  updated_at timestamptz not null default now(),
  unique (booking_id)
);

create table cleaning_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references cleaning_tasks(id) on delete cascade,
  photo_urls text[] default '{}',
  comment text,
  submitted_at timestamptz not null default now()
);

-- 同日チェックインの自動判定用ビュー（同じroomに対して当日中に次のcheck_inがあるか）
create or replace view v_same_day_checkin as
select
  b1.id as booking_id,
  exists (
    select 1 from bookings b2
    where b2.room_id = b1.room_id
      and b2.check_in = b1.check_out
      and b2.status = 'confirmed'
      and b2.id <> b1.id
  ) as same_day_checkin
from bookings b1;
