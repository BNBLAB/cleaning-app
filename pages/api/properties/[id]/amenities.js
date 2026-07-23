import { supabaseServer } from "../../../../lib/supabaseServer";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).end();

  const { id } = req.query;
  const { amenities } = req.body || {};

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("properties")
    .update({ amenities: amenities || null })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
