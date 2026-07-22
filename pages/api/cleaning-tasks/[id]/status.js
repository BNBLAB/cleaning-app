import { supabaseServer } from "../../../../lib/supabaseServer";

const VALID = new Set(["pending", "in_progress", "done", "needs_check"]);

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).end();

  const { id } = req.query;
  const { status } = req.body;

  if (!VALID.has(status)) {
    return res.status(400).json({ error: "不正なstatusです" });
  }

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("cleaning_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
