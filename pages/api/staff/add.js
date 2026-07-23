import { supabaseServer } from "../../../lib/supabaseServer";

// 新しいスタッフを名簿に追加する
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "name は必須です" });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("staff")
    .upsert({ name: name.trim() }, { onConflict: "name", ignoreDuplicates: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
