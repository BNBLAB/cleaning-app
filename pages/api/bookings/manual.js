import { supabaseServer } from "../../../lib/supabaseServer";

// 予約の手動追加（BEDS24を通さない、社長・社員の直接利用など）
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { roomId, guestName, checkIn, checkOut, adults, children, notes } = req.body || {};
  if (!roomId || !guestName || !checkIn || !checkOut) {
    return res.status(400).json({ error: "roomId, guestName, checkIn, checkOut は必須です" });
  }
  if (checkOut <= checkIn) {
    return res.status(400).json({ error: "チェックアウトはチェックインより後の日付にしてください" });
  }

  const supabase = supabaseServer();

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("id, account_key")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) return res.status(500).json({ error: roomErr.message });
  if (!room) return res.status(404).json({ error: "部屋が見つかりません" });

  const manualId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .insert({
      account_key: room.account_key,
      beds24_booking_id: manualId,
      is_manual: true,
      room_id: roomId,
      guest_name: guestName,
      num_adult: adults ?? 1,
      num_child: children ?? 0,
      check_in: checkIn,
      check_out: checkOut,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (bookingErr) return res.status(500).json({ error: bookingErr.message });

  const { error: taskErr } = await supabase.from("cleaning_tasks").insert({
    booking_id: booking.id,
    room_id: roomId,
    scheduled_date: checkOut,
    same_day_checkin: false,
    notes: notes || null,
  });
  if (taskErr) return res.status(500).json({ error: taskErr.message });

  return res.status(200).json({ ok: true });
}
