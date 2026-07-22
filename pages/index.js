-- ============================================================
-- Phase 1: データベースの土台
-- Supabaseの SQL Editor にコピペして実行してください（1回だけでOK）
-- ============================================================

-- 1. 施設にエリア区分とアメニティ情報を追加
alter table properties add column if not exists area text not null default 'hatagaya';
alter table properties add column if not exists amenities text;

-- 富津グループの施設だけ area を 'futtsu' に更新
update properties
set area = 'futtsu'
where name in ('Gold Valley Villa A', 'Gold Valley Villa B', 'Gold Valley Villa C');

-- 2. 手動追加した予約かどうかを区別するフラグ
alter table bookings add column if not exists is_manual boolean not null default false;
-- 手動予約はBEDS24のbooking_idが無いので、nullも許可する
alter table bookings alter column beds24_booking_id drop not null;

-- 3. スタッフ名簿（担当者・シフト登録の候補一覧）
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- 4. 予約に紐づかない「特別枠」（Takobeya共用部・原田ビルエントランス・
--    事務バイト・その他・メッセージバイト等）の担当者割り当て
create table if not exists special_task_assignments (
  id uuid primary key default gen_random_uuid(),
  row_key text not null,       -- 'takobeya_common' / 'harada_entrance' / 'office_morning' /
                                -- 'office_after' / 'other' / 'special_cleaning' /
                                -- 'message_parttime' / 'message_staff'
  slot_index integer not null default 0,  -- メッセージバイトのみ0と1の2枠
  date date not null,
  assignee text,
  updated_at timestamptz not null default now(),
  unique (row_key, slot_index, date)
);

-- 5. シフト登録（幡ヶ谷／富津／メッセージバイト、それぞれ独立して登録）
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  shift_area text not null,    -- 'hatagaya' / 'futtsu' / 'message'
  staff_name text not null,
  date date not null,
  available boolean not null default false,
  two_plus boolean not null default false,   -- 同日2件以上OK
  no_same_day boolean not null default false, -- 当日チェックイン不可
  updated_at timestamptz not null default now(),
  unique (shift_area, staff_name, date)
);
