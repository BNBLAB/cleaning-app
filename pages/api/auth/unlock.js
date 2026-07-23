// パスワードを確認するだけのAPI。実際の編集APIはこれとは別に開いたままなので、
// 「うっかり編集を防ぐ」ためのものであり、強固なセキュリティではない点に注意。
export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { password } = req.body || {};
  const correct = process.env.EDIT_PASSWORD;

  if (!correct) {
    return res.status(500).json({ error: "サーバー側にEDIT_PASSWORDが設定されていません" });
  }

  if (password === correct) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: "パスワードが違います" });
}
