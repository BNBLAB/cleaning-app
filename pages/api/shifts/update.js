import { supabaseServer } from "../../../lib/supabaseServer";

// シフト（出勤可能／同日2件以上OK／当日チェックイン不可）の登録・更新
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { shiftArea, staffName, date, available, twoPlus, noSameDay } = req.body || {};
  if (!shiftArea || !staffName || !date) {
    return res.status(400).json({ error: "shiftArea, staffName, date は必須です" });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("shifts").upsert(
    {
      shift_area: shiftArea,
      staff_name: staffName,
      date,
      available: !!available,
      two_plus: !!available && !!twoPlus,
      no_same_day: !!available && !!noSameDay,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shift_area,staff_name,date" }
  );

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
