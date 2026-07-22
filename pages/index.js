import { useState } from "react";
import CleaningCalendar from "../components/CleaningCalendar";
import { supabaseServer } from "../lib/supabaseServer";

export async function getServerSideProps() {
  const supabase = supabaseServer();

  const today = new Date();
  const in14days = new Date(today);
  in14days.setDate(in14days.getDate() + 14);
  const todayISO = today.toISOString().slice(0, 10);
  const in14ISO = in14days.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select(
      `
      id,
      scheduled_date,
      status,
      same_day_checkin,
      rooms ( name, properties ( id, name ) ),
      bookings ( guest_name )
    `
    )
    .gte("scheduled_date", todayISO)
    .lte("scheduled_date", in14ISO)
    .order("scheduled_date", { ascending: true });

  if (error) {
    return { props: { tasks: [], today: todayISO, errorMessage: error.message } };
  }

  const tasks = (data ?? []).map((t) => ({
    id: t.id,
    date: t.scheduled_date,
    status: t.status,
    sameDayCheckin: t.same_day_checkin,
    propertyId: t.rooms?.properties?.id ?? "unknown",
    propertyName: t.rooms?.properties?.name ?? "(不明な施設)",
    roomName: t.rooms?.name ?? "",
    guestName: t.bookings?.guest_name ?? null,
  }));

  return { props: { tasks, today: todayISO, errorMessage: null } };
}

export default function Home({ tasks, today, errorMessage }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const runSync = async () => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const res = await fetch("/api/beds24/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "同期に失敗しました");
      setSyncMessage(`同期しました: ${JSON.stringify(data.synced)}`);
      // メッセージを読む時間を確保してからリロード
      setTimeout(() => window.location.reload(), 4000);
    } catch (e) {
      setSyncMessage(`エラー: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const onStatusChange = async (taskId, nextStatus) => {
    const res = await fetch(`/api/cleaning-tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) throw new Error("更新失敗");
  };

  return (
    <div>
      <div style={{ padding: "16px 24px 0", display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center" }}>
        {syncMessage && <span style={{ fontSize: 12, color: "#5C5850" }}>{syncMessage}</span>}
        <button
          onClick={runSync}
          disabled={syncing}
          style={{
            background: "#20302C",
            color: "#F6F5F1",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: syncing ? "default" : "pointer",
            opacity: syncing ? 0.6 : 1,
          }}
        >
          {syncing ? "同期中..." : "BEDS24と今すぐ同期"}
        </button>
      </div>

      {errorMessage && (
        <div style={{ margin: "16px 24px", padding: 12, background: "#FBE7E7", color: "#C24A4A", borderRadius: 8, fontSize: 13 }}>
          データ取得エラー: {errorMessage}
        </div>
      )}

      <CleaningCalendar tasks={tasks} today={today} onStatusChange={onStatusChange} />
    </div>
  );
}
