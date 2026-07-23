import { supabaseServer } from "../../../lib/supabaseServer";

// 物件を1つ上または下に入れ替える（隣同士のsort_orderを交換する）
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { propertyId, direction } = req.body || {}; // direction: 'up' | 'down'
  if (!propertyId || !["up", "down"].includes(direction)) {
    return res.status(400).json({ error: "propertyId と direction('up'|'down') が必要です" });
  }

  const supabase = supabaseServer();

  const { data: all, error: listErr } = await supabase
    .from("properties")
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  if (listErr) return res.status(500).json({ error: listErr.message });

  const idx = all.findIndex((p) => p.id === propertyId);
  if (idx === -1) return res.status(404).json({ error: "物件が見つかりません" });

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) {
    return res.status(200).json({ ok: true }); // 端なので何もしない
  }

  const a = all[idx];
  const b = all[swapIdx];

  const { error: err1 } = await supabase.from("properties").update({ sort_order: b.sort_order }).eq("id", a.id);
  if (err1) return res.status(500).json({ error: err1.message });
  const { error: err2 } = await supabase.from("properties").update({ sort_order: a.sort_order }).eq("id", b.id);
  if (err2) return res.status(500).json({ error: err2.message });

  return res.status(200).json({ ok: true });
}
