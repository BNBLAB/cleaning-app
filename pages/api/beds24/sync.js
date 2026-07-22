// pages/api/beds24/sync.js
//
// BEDS24 API v2 から予約データを取得し、Supabaseへ反映する。
// 用途: (1) 初回の全件取り込み (2) Webhookが取りこぼした際の日次バックアップ同期
//
// 2つのBEDS24アカウントに対応: 同じ数字のpropertyId/roomId/bookingIdが
// アカウントをまたいで重複しうるため、account_key（'account1' / 'account2'）で
// 必ず組み合わせて区別する。
//
// 事前準備 (.env.local に設定):
//   BEDS24_REFRESH_TOKEN_ACCOUNT1=...
//   BEDS24_REFRESH_TOKEN_ACCOUNT2=...
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
//
// 参考: BEDS24 API v2は厳しいレート制限があるため、頻繁な呼び出しは避け、
// 通常はWebhook(/api/beds24/webhook)で差分を受け取る運用を基本とする。
// このsyncは「初回の一括取り込み」と「日次のバックアップ同期」用。

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// account_key -> refreshTokenの環境変数名 の対応
const ACCOUNTS = {
  account1: process.env.BEDS24_REFRESH_TOKEN_ACCOUNT1,
  account2: process.env.BEDS24_REFRESH_TOKEN_ACCOUNT2,
};

// 清掃タスクを作る対象とみなす予約ステータス
// BEDS24のデフォルトフィルタが対象にするのは confirmed / new / request。
// cancelled はここには含めない（=清掃タスク対象外）。
const ACTIVE_STATUSES = new Set(["new", "confirmed", "request"]);

async function getAccessToken(refreshToken) {
  const res = await fetch("https://api.beds24.com/v2/authentication/token", {
    headers: { refreshToken },
  });
  if (!res.ok) throw new Error(`BEDS24 token取得失敗: ${res.status}`);
  const data = await res.json();
  return data.token; // 24時間有効
}

async function fetchAllBookings(token) {
  let all = [];
  let page = 1;
  // BEDS24はページネーションされる（count: 100件区切り、nextPageExists で判定）
  while (true) {
    const res = await fetch(`https://api.beds24.com/v2/bookings?page=${page}`, {
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
  // 「個人予約」スコープを許可していない場合、これらのフィールドは
  // レスポンスに含まれず undefined になる。その場合は null のままにする。
  const first = b.firstName ?? "";
  const last = b.lastName ?? "";
  const full = `${last} ${first}`.trim();
  return full || null;
}

async function syncAccount(accountKey, refreshToken) {
  const token = await getAccessToken(refreshToken);
  const bookings = await fetchAllBookings(token);

  let upserted = 0;

  for (const b of bookings) {
    const { data: room } = await supabase
      .from("rooms")
      .select("id, property_id")
      .eq("account_key", accountKey)
      .eq("beds24_room_id", b.roomId)
      .maybeSingle();

    // room / property が未登録ならスキップ（先に properties, rooms を投入しておく想定）
    if (!room) continue;

    const isActive = ACTIVE_STATUSES.has(b.status);

    const { data: bookingRow, error: bookingErr } = await supabase
      .from("bookings")
      .upsert(
        {
          account_key: accountKey,
          beds24_booking_id: String(b.id),
          room_id: room.id,
          guest_name: extractGuestName(b),
          check_in: b.arrival,
          check_out: b.departure,
          status: isActive ? b.status : "cancelled",
          raw_payload: b,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_key,beds24_booking_id" }
      )
      .select()
      .single();

    if (bookingErr) throw bookingErr;

    if (isActive) {
      await supabase.from("cleaning_tasks").upsert(
        {
          booking_id: bookingRow.id,
          room_id: room.id,
          scheduled_date: bookingRow.check_out,
          same_day_checkin: isSameDayCheckin(b, bookings),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "booking_id", ignoreDuplicates: false }
      );
    } else {
      // キャンセルされた予約に紐づく未対応タスクは削除
      await supabase
        .from("cleaning_tasks")
        .delete()
        .eq("booking_id", bookingRow.id)
        .eq("status", "pending");
    }

    upserted += 1;
  }

  return upserted;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POSTのみ対応しています" });
  }

  try {
    const results = {};
    for (const [accountKey, refreshToken] of Object.entries(ACCOUNTS)) {
      if (!refreshToken) continue; // 未設定のアカウントはスキップ
      results[accountKey] = await syncAccount(accountKey, refreshToken);
    }
    return res.status(200).json({ ok: true, synced: results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
