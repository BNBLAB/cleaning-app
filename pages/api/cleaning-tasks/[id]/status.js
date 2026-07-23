import { supabaseServer } from "../../../../lib/supabaseServer";

const VALID_STATUS = new Set(["pending", "in_progress", "done", "needs_check"]);

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).end();

  const { id } = req.query;
  const { status, assignee, notes } = req.body;

  const update = { updated_at: new Date().toISOString() };

  if (status !== undefined) {
    if (!VALID_STATUS.has(status)) {
      return res.status(400).json({ error: "不正なstatusです" });
    }
    update.status = status;
  }

  if (assignee !== undefined) {
    update.assignee = assignee === "" ? null : assignee;
  }

  if (notes !== undefined) {
    update.notes = notes === "" ? null : notes;
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("cleaning_tasks").update(update).eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
