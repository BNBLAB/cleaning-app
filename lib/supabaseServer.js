// サーバーサイド（API Routes / getServerSideProps）でのみ使うクライアント。
// service role key はブラウザに絶対出さないこと（クライアント側では使わない）。
import { createClient } from "@supabase/supabase-js";

export function supabaseServer() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
