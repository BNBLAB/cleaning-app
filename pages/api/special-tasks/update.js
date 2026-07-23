import { supabaseServer } from "../../../lib/supabaseServer";

// Takobeya共用部・原田ビルエントランス・事務バイト・その他・メッセージバイト等の
// 担当者を更新する共通API
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { rowKey, slotIndex, date, assignee } = req.body || {};
  if (!rowKey || date === undefined || slotIndex === undefined) {
    return res.status(400).json({ error: "rowKey, slotIndex, date は必須です" });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("special_task_assignments").upsert(
    {
      row_key: rowKey,
      slot_index: slotIndex,
      date,
      assignee: assignee || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "row_key,slot_index,date" }
  );

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
