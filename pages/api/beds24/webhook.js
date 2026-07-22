// pages/api/beds24/webhook.js
//
// BEDS24コントロールパネルの
//   Settings > Properties > Access > Booking webhooks
// で設定するURL:
//   https://<あなたのドメイン>/api/beds24/webhook?account=account1
//   https://<あなたのドメイン>/api/beds24/webhook?account=account2
// のように、アカウントごとに ?account= を変えて2つ登録する
// （2つのBEDS24アカウントを区別するため）。
//
// 新規予約・変更・キャンセルが発生するたびにBEDS24からPOSTが届く。
// ここではペイロードをそのままDBに反映し、清掃タスクを自動更新する。
//
// 注意: 実際のWebhookペイロードの形はまだ未確認。実際に届いた通知の中身を
// 見てから、下の `booking` の取り出し方を調整する必要があるかもしれない。

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ACTIVE_STATUSES = new Set(["new", "confirmed", "request"]);

function extractGuestName(b) {
  const first = b.firstName ?? "";
  const last = b.lastName ?? "";
  const full = `${last} ${first}`.trim();
  return full || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const accountKey = req.query.account;
  if (!accountKey) {
    return res.status(400).json({ error: "account クエリパラメータが必要です（例: ?account=account1）" });
  }

  // TODO: 本番運用では、BEDS24から送られる署名/シークレットの検証を追加する
  // (BEDS24のWebhook設定画面で秘密トークンを発行できる場合はヘッダーで照合する)

  const payload = req.body;
  const booking = payload.booking ?? payload; // 実際のペイロード構造が分かり次第調整

  try {
    const { data: room } = await supabase
      .from("rooms")
      .select("id")
      .eq("account_key", accountKey)
      .eq("beds24_room_id", booking.roomId)
      .maybeSingle();

    if (!room) {
      console.warn(`未登録room (account=${accountKey}, roomId=${booking.roomId}) の予約通知`);
      return res.status(204).end();
    }

    const isActive = ACTIVE_STATUSES.has(booking.status);

    const { data: bookingRow, error } = await supabase
      .from("bookings")
      .upsert(
        {
          account_key: accountKey,
          beds24_booking_id: String(booking.id),
          room_id: room.id,
          guest_name: extractGuestName(booking),
          check_in: booking.arrival,
          check_out: booking.departure,
          status: isActive ? booking.status : "cancelled",
          raw_payload: booking,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_key,beds24_booking_id" }
      )
      .select()
      .single();

    if (error) throw error;

    if (isActive) {
      await supabase.from("cleaning_tasks").upsert(
        {
          booking_id: bookingRow.id,
          room_id: room.id,
          scheduled_date: bookingRow.check_out,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "booking_id" }
      );
    } else {
      await supabase
        .from("cleaning_tasks")
        .delete()
        .eq("booking_id", bookingRow.id)
        .eq("status", "pending");
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
