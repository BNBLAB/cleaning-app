import { useState, useEffect } from "react";
import { supabaseServer } from "../lib/supabaseServer";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');`;
const BORDER = "1px solid #DEDACE";
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

function toISO(d) {
  return d.toISOString().slice(0, 10);
}
function addMonths(y, m, n) {
  const d = new Date(y, m - 1 + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export async function getServerSideProps({ query }) {
  const supabase = supabaseServer();

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (query.month && /^\d{4}-\d{2}$/.test(query.month)) {
    const [y, m] = query.month.split("-").map(Number);
    year = y;
    month = m;
  }
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const monthStartISO = toISO(monthStart);
  const monthEndISO = toISO(monthEnd);

  // 富津にシフト登録されているスタッフは集計から除外する
  const { data: futtsuShifts } = await supabase
    .from("shifts")
    .select("staff_name")
    .eq("shift_area", "futtsu")
    .eq("available", true);
  const futtsuNames = new Set((futtsuShifts ?? []).map((s) => s.staff_name));

  const { data: tasks } = await supabase
    .from("cleaning_tasks")
    .select("assignee, scheduled_date, room_id, rooms ( name, properties ( name ) )")
    .gte("scheduled_date", monthStartISO)
    .lte("scheduled_date", monthEndISO)
    .not("assignee", "is", null);

  const { data: specialRows } = await supabase
    .from("special_task_assignments")
    .select("row_key, date, assignee")
    .gte("date", monthStartISO)
    .lte("date", monthEndISO)
    .not("assignee", "is", null);

  const ROW_LABELS = {
    takobeya_common: "Takobeya 共用部",
    harada_entrance: "原田ビル エントランス",
    office_morning: "事務バイト朝",
    office_after: "事務バイト清掃後",
    other: "その他",
    special_cleaning: "富津 特別清掃",
    message_parttime: "メッセージバイト",
    message_staff: "メッセージ対応社員",
  };

  const entries = [];
  (tasks ?? []).forEach((t) => {
    entries.push({
      name: t.assignee,
      date: t.scheduled_date,
      label: `${t.rooms?.properties?.name ?? ""} ${t.rooms?.name ?? ""}`.trim(),
    });
  });
  (specialRows ?? []).forEach((r) => {
    entries.push({ name: r.assignee, date: r.date, label: ROW_LABELS[r.row_key] ?? r.row_key });
  });

  const filteredEntries = entries.filter((e) => !futtsuNames.has(e.name));

  const counts = {};
  filteredEntries.forEach((e) => {
    counts[e.name] = (counts[e.name] || 0) + 1;
  });

  return {
    props: { year, month, entries: filteredEntries, counts },
  };
}

export default function StaffSummaryPage({ year, month, entries, counts }) {
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [selectedName, setSelectedName] = useState(null);

  useEffect(() => {
    setUnlocked(localStorage.getItem("cleaningAppUnlocked") === "1");
    setCheckedAuth(true);
  }, []);

  if (!checkedAuth) return null;

  if (!unlocked) {
    return (
      <div style={{ padding: 40, fontFamily: "'Noto Sans JP', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <p>このページは社員のログインが必要です。<a href="/">清掃カレンダー</a>のページから右上の「🔒 閲覧のみ」ボタンでログインしてください。</p>
      </div>
    );
  }

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const monthDays = [];
  for (let d = new Date(monthStart); d <= monthEnd; d.setUTCDate(d.getUTCDate() + 1)) monthDays.push(new Date(d));

  const selectedEntries = selectedName
    ? entries.filter((e) => e.name === selectedName).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const selectedDates = new Set(selectedEntries.map((e) => e.date));

  return (
    <div style={{ background: "#F6F5F1", minHeight: "100vh", padding: 24, fontFamily: "'Noto Sans JP', sans-serif", color: "#1E2422" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#8A8578", fontFamily: "'JetBrains Mono', monospace" }}>SHOEI CLEANING OPERATIONS</div>
          <h1 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: 24, margin: "2px 0 0", color: "#20302C" }}>👤 スタッフ月間集計</h1>
        </div>
        <a href="/" style={{ fontSize: 13, color: "#5C5850" }}>← 清掃カレンダーに戻る</a>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <a href={`/staff-summary?month=${prev.y}-${String(prev.m).padStart(2, "0")}`} style={{ border: BORDER, borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff", textDecoration: "none", color: "#3B3833" }}>◀ 前の月</a>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{year}年{month}月</div>
        <a href={`/staff-summary?month=${next.y}-${String(next.m).padStart(2, "0")}`} style={{ border: BORDER, borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff", textDecoration: "none", color: "#3B3833" }}>次の月 ▶</a>
      </div>

      <div style={{ fontSize: 11, color: "#8A8578", marginBottom: 10 }}>富津にシフト登録されているスタッフは、この一覧には表示されません。</div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.length === 0 && <div style={{ color: "#B0AC9F", fontSize: 13 }}>今月の担当はまだありません。</div>}
          {sorted.map(([name, c]) => (
            <button
              key={name}
              onClick={() => setSelectedName(name)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: selectedName === name ? "#20302C" : "#fff",
                color: selectedName === name ? "#F6F5F1" : "#1E2422",
                border: BORDER,
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              <span>{name}</span>
              <span style={{ fontWeight: 700 }}>{c}件</span>
            </button>
          ))}
        </div>

        {selectedName && (
          <div style={{ flex: "1 1 320px", background: "#fff", border: BORDER, borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{selectedName}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 12 }}>
              {WEEKDAY_JA.map((w) => <div key={w} style={{ textAlign: "center", fontSize: 11, color: "#8A8578" }}>{w}</div>)}
              {Array.from({ length: monthDays[0].getUTCDay() }).map((_, i) => <div key={"pad" + i} />)}
              {monthDays.map((d) => {
                const iso = toISO(d);
                const hit = selectedDates.has(iso);
                return (
                  <div key={iso} style={{ textAlign: "center", padding: "6px 0", borderRadius: 8, background: hit ? "#20302C" : "#F1EFE7", color: hit ? "#F6F5F1" : "#8A8578", fontSize: 12, fontWeight: hit ? 700 : 400 }}>
                    {d.getUTCDate()}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selectedEntries.map((e, i) => (
                <div key={i} style={{ fontSize: 12.5, padding: "6px 10px", background: "#FAFAF7", border: BORDER, borderRadius: 8 }}>
                  {e.date} — {e.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
