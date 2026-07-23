import { useState } from "react";
import CleaningCalendar from "../components/CleaningCalendar";
import { supabaseServer } from "../lib/supabaseServer";

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn + "T00:00:00");
  const b = new Date(checkOut + "T00:00:00");
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
function toISO(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export async function getServerSideProps({ query }) {
  const supabase = supabaseServer();

  const todayReal = new Date();
  todayReal.setHours(0, 0, 0, 0);
  const todayISO = toISO(todayReal);

  // ?start=YYYY-MM-DD があればその週を表示。無ければ今日から7日間。
  let weekStart = todayReal;
  if (query.start && /^\d{4}-\d{2}-\d{2}$/.test(query.start)) {
    weekStart = new Date(query.start + "T00:00:00");
  }
  const weekStartISO = toISO(weekStart);
  const weekEndISO = toISO(addDays(weekStart, 6));

  // 物件一覧（並び順つき）。?showHidden=1 のときは非表示の物件も含める
  const showHidden = query.showHidden === "1";
  let propertiesQuery = supabase
    .from("properties")
    .select("id, name, area, amenities, sort_order, active")
    .order("sort_order", { ascending: true });
  if (!showHidden) propertiesQuery = propertiesQuery.eq("active", true);
  const { data: properties } = await propertiesQuery;

  const { data, error } = await supabase
    .from("cleaning_tasks")
    .select(
      `
      id,
      scheduled_date,
      status,
      same_day_checkin,
      assignee,
      notes,
      room_id,
      rooms ( name, properties ( id, name, area, amenities ) ),
      bookings ( check_in, check_out, guest_name, num_adult, num_child )
    `
    )
    .gte("scheduled_date", weekStartISO)
    .lte("scheduled_date", weekEndISO)
    .order("scheduled_date", { ascending: true });

  if (error) {
    return {
      props: {
        tasks: [],
        properties: properties ?? [],
        specialAssignees: {},
        today: todayISO,
        weekStart: weekStartISO,
        errorMessage: error.message,
        assigneeOptions: [],
      },
    };
  }

  const roomIds = Array.from(new Set((data ?? []).map((t) => t.room_id).filter(Boolean)));

  let nextBookingsByRoom = {};
  if (roomIds.length > 0) {
    const { data: upcoming } = await supabase
      .from("bookings")
      .select("room_id, check_in, check_out, num_adult, num_child, status")
      .in("room_id", roomIds)
      .neq("status", "cancelled")
      .gte("check_in", weekStartISO)
      .order("check_in", { ascending: true });

    (upcoming ?? []).forEach((b) => {
      if (!nextBookingsByRoom[b.room_id]) nextBookingsByRoom[b.room_id] = [];
      nextBookingsByRoom[b.room_id].push(b);
    });
  }

  const tasks = (data ?? []).map((t) => {
    const departing = t.bookings;
    const candidates = (nextBookingsByRoom[t.room_id] || []).filter((b) => b.check_in >= t.scheduled_date);
    const next = candidates[0] ?? null;

    return {
      id: t.id,
      date: t.scheduled_date,
      status: t.status,
      assignee: t.assignee ?? null,
      notes: t.notes ?? null,
      sameDayCheckin: t.same_day_checkin,
      propertyId: t.rooms?.properties?.id ?? "unknown",
      propertyName: t.rooms?.properties?.name ?? "(不明な施設)",
      area: t.rooms?.properties?.area ?? "hatagaya",
      roomName: t.rooms?.name ?? "",
      guestName: departing?.guest_name ?? null,
      prevGuests: departing ? (departing.num_adult ?? 0) + (departing.num_child ?? 0) : null,
      prevNights: departing ? nightsBetween(departing.check_in, departing.check_out) : null,
      nextGuests: next ? (next.num_adult ?? 0) + (next.num_child ?? 0) : null,
      nextNights: next ? nightsBetween(next.check_in, next.check_out) : null,
    };
  });

  // 特別枠（Takobeya共用部・エントランス・事務バイト・メッセージバイト等）
  const { data: specialRows } = await supabase
    .from("special_task_assignments")
    .select("row_key, slot_index, date, assignee")
    .gte("date", weekStartISO)
    .lte("date", weekEndISO);

  const specialAssignees = {};
  (specialRows ?? []).forEach((r) => {
    specialAssignees[`${r.row_key}|${r.date}|${r.slot_index}`] = r.assignee;
  });

  const assigneeSet = new Set();
  tasks.forEach((t) => t.assignee && assigneeSet.add(t.assignee));
  (specialRows ?? []).forEach((r) => r.assignee && assigneeSet.add(r.assignee));

  // シフト登録（担当者プルダウンの絞り込みに使う）
  const { data: shiftsInWeek } = await supabase
    .from("shifts")
    .select("shift_area, staff_name, date, available, two_plus, no_same_day")
    .gte("date", weekStartISO)
    .lte("date", weekEndISO)
    .eq("available", true);

  // 手動予約追加のフォーム用に部屋一覧を取得
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, property_id, properties ( name, active )")
    .order("name", { ascending: true });
  const roomOptions = (rooms ?? [])
    .filter((r) => r.properties?.active !== false)
    .map((r) => ({ id: r.id, name: r.name, propertyId: r.property_id, propertyName: r.properties?.name ?? "" }));

  return {
    props: {
      tasks,
      properties: properties ?? [],
      specialAssignees,
      today: todayISO,
      weekStart: weekStartISO,
      showHidden,
      errorMessage: null,
      assigneeOptions: Array.from(assigneeSet),
      shiftsInWeek: shiftsInWeek ?? [],
      roomOptions,
    },
  };
}

export default function Home({ tasks, properties, specialAssignees, today, weekStart, showHidden, errorMessage, assigneeOptions, shiftsInWeek, roomOptions }) {
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "更新失敗");
    }
  };

  const onAssigneeChange = async (taskId, assignee) => {
    const res = await fetch(`/api/cleaning-tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "更新失敗");
    }
  };

  const onNotesChange = async (taskId, notes) => {
    const res = await fetch(`/api/cleaning-tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "更新失敗");
    }
  };

  const onSpecialAssigneeChange = async (rowKey, slotIndex, date, assignee) => {
    const res = await fetch("/api/special-tasks/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowKey, slotIndex, date, assignee }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "更新失敗");
    }
  };

  const onReorder = async (propertyId, direction) => {
    const res = await fetch("/api/properties/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, direction }),
    });
    if (!res.ok) throw new Error("並び替えに失敗しました");
    window.location.reload();
  };

  const onAmenitiesChange = async (propertyId, amenities) => {
    const res = await fetch(`/api/properties/${propertyId}/amenities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amenities }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "更新失敗");
    }
  };

  const onPropertyUpdate = async (propertyId, fields) => {
    const res = await fetch(`/api/properties/${propertyId}/amenities`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "更新失敗");
    }
    window.location.reload();
  };

  const onAddManualBooking = async (fields) => {
    const res = await fetch("/api/bookings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "追加に失敗しました");
    }
    window.location.reload();
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

      <CleaningCalendar
        tasks={tasks}
