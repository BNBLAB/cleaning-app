// pages/api/beds24/sync.js
//
// BEDS24 API v2 から予約データを取得し、Supabaseへ反映する。
// 用途: (1) 初回の全件取り込み (2) Webhookが取りこぼした際の日次バックアップ同期
//
// 2つのBEDS24アカウントに対応: 同じ数字のpropertyId/roomId/bookingIdが
// アカウントをまたいで重複しうるため、account_key（'account1' / 'account2'）で
// 必ず組み合わせて区別する。
//
// パフォーマンス対策:
// - Vercel Hobbyプランは1リクエスト最大10秒までしか動けないため、
//   maxDurationを60秒まで引き上げている（Hobbyプランで設定できる上限）
// - 予約1件ごとにDBへ問い合わせる方式をやめ、まとめて取得・まとめて書き込みする方式に変更
// - チェックアウトが過去のもの（清掃対象にならない）はBEDS24への問い合わせ段階で除外

import { createClient } from "@supabase/supabase-js";

// Vercel Hobbyプランで設定できる最大値（60秒）まで引き上げる
export const config = { maxDuration: 60 };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ACCOUNTS = {
  account1: process.env.BEDS24_REFRESH_TOKEN_ACCOUNT1,
  account2: process.env.BEDS24_REFRESH_TOKEN_ACCOUNT2,
};

const ACTIVE_STATUSES = new Set(["new", "confirmed", "request"]);

async function getAccessToken(refreshToken) {
  const res = await fetch("https://api.beds24.com/v2/authentication/token", {
    headers: { refreshToken },
  });
  if (!res.ok) throw new Error(`BEDS24 token取得失敗: ${res.status}`);
  const data = await res.json();
  return data.token;
}

// 運用開始日。この日より前にチェックアウトする予約は同期しない。
// 過去分の同期が必要になったら、この日付を早める（または下のfetchRelevantBookings内の
// 参照を外す）だけで対応できます。
const SYNC_FROM_DATE = "2026-08-01";

async function fetchRelevantBookings(token) {
  let all = [];
  let page = 1;
  while (true) {
    const params = new URLSearchParams({ page: String(page), departureFrom: SYNC_FROM_DATE, includeCancelled: "true" });
    const res = await fetch(`https://api.beds24.com/v2/bookings?${params.toString()}`, {
      headers: { token, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`BEDS24 予約取得失敗: ${res.status}`);
    const data = await res.json();
    all = all.concat(data.data ?? []);
    if (!data.pages?.nextPageExists) break;
    page += 1;
  }
  return all;
}

function isSameDayCheckin(booking, allBookings) {
  return allBookings.some(
    (b) => b.roomId === booking.roomId && b.arrival === booking.departure && b.id !== booking.id
  );
}

function extractGuestName(b) {
  const first = b.firstName ?? "";
  const last = b.lastName ?? "";
  const full = `${last} ${first}`.trim();
  return full || null;
}

async function syncAccount(accountKey, refreshToken) {
  const token = await getAccessToken(refreshToken);
  const bookings = await fetchRelevantBookings(token);

  if (bookings.length === 0) return { fetched: 0, synced: 0 };

  // 1回のクエリで、このアカウントの部屋を全部まとめて取得（roomIdごとのマップを作る）
  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("id, beds24_room_id")
    .eq("account_key", accountKey);
  if (roomsErr) throw roomsErr;
  const roomByBeds24Id = new Map(rooms.map((r) => [r.beds24_room_id, r.id]));

  const bookingRows = [];
  const skippedNoRoom = [];
  for (const b of bookings) {
    const roomId = roomByBeds24Id.get(b.roomId);
    if (!roomId) {
      skippedNoRoom.push(b.roomId);
      continue;
    }
    const isActive = ACTIVE_STATUSES.has(b.status);
    bookingRows.push({
      account_key: accountKey,
      beds24_booking_id:
