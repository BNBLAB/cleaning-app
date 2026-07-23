import { supabaseServer } from "../../../../lib/supabaseServer";

// 施設の情報（アメニティ・名前・表示/非表示）をまとめて更新するAPI
// ファイル名はamenities.jsのままですが、名前・非表示切り替えにも対応しています
export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).end();

  const { id } = req.query;
  const { amenities, name, active } = req.body || {};

  const update = {};
  if (amenities !== undefined) update.amenities = amenities || null;
  if (name !== undefined && name.trim()) update.name = name.trim();
  if (active !== undefined) update.active = active;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "更新する項目がありません" });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("properties").update(update).eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
