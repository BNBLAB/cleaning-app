import { useState, useEffect, useMemo } from "react";
import { supabaseServer } from "../lib/supabaseServer";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');`;
const BORDER = "1px solid #DEDACE";
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

const SHIFT_AREAS = [
  { key: "hatagaya", label: "幡ヶ谷" },
  { key: "futtsu", label: "富津" },
  { key: "message", label: "メッセージバイト" },
];

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

  const { data: staff } = await supabase.from("staff").select("name").order("name", { ascending: true });
  const { data: shifts } = await supabase
    .from("shifts")
    .select("shift_area, staff_name, date, available, two_plus, no_same_day")
    .gte("date", monthStartISO)
    .lte("date", monthEndISO);

  return {
    props: {
      year,
      month,
      staffList: (staff ?? []).map((s) => s.name),
      shifts: shifts ?? [],
    },
  };
}

function ShiftCellModal({ name, date, initial, onClose, onSave }) {
  const [available, setAvailable] = useState(initial?.available ?? false);
  const [twoPlus, setTwoPlus] = useState(initial?.two_plus ?? false);
  const [noSameDay, setNoSameDay] = useState(initial?.no_same_day ?? false);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,36,34,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(320px, 92vw)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{name} — {date}</div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} /> 出勤可能
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" disabled={!available} checked={twoPlus} onChange={(e) => setTwoPlus(e.target.checked)} /> 同日2件以上OK
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" disabled={!available} checked={noSameDay} onChange={(e) => setNoSameDay(e.target.checked)} /> 当日チェックイン不可
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "#F1EFE7", color: "#5C5850", cursor: "pointer" }}>キャンセル</button>
          <button
            onClick={() => { onSave({ available, twoPlus, noSameDay }); onClose(); }}
            style={{ border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "#20302C", color: "#F6F5F1", cursor: "pointer" }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftsPage({ year, month, staffList: initialStaffList, shifts: initialShifts }) {
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [area, setArea] = useState("hatagaya");
  const [staffList, setStaffList] = useState(initialStaffList);
  const [shiftMap, setShiftMap] = useState(() => {
    const m = {};
    initialShifts.forEach((s) => (m[`${s.shift_area}|${s.staff_name}|${s.date}`] = s));
    return m;
  });
  const [editingCell, setEditingCell] = useState(null);

  useEffect(() => {
    setUnlocked(localStorage.getItem("cleaningAppUnlocked") === "1");
    setCheckedAuth(true);
  }, []);

  const monthDays = useMemo(() => {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    const days = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(new Date(d));
    return days;
  }, [year, month]);

  const prev = addMonths(year, month, -1);
  const next = addMonths(year, month, 1);

  const saveCell = async (name, iso, rec) => {
    const key = `${area}|${name}|${iso}`;
    setShiftMap((prev) => ({ ...prev, [key]: { shift_area: area, staff_name: name, date: iso, available: rec.available, two_plus: rec.twoPlus, no_same_day: rec.noSameDay } }));
    await fetch("/api/shifts/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftArea: area, staffName: name, date: iso, available: rec.available, twoPlus: rec.twoPlus, noSameDay: rec.noSameDay }),
    });
  };

  const addStaff = async () => {
    const name = window.prompt("新しいスタッフの名前を入力してください");
    if (!name || !name.trim()) return;
    await fetch("/api/staff/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setStaffList((prev) => (prev.includes(name.trim()) ? prev : [...prev, name.trim()]));
  };

  if (!checkedAuth) return null;

  if (!unlocked) {
    return (
      <div style={{ padding: 40, fontFamily: "'Noto Sans JP', sans-serif" }}>
        <style>{FONT_IMPORT}</style>
        <p>このページは社員のログインが必要です。<a href="/">清掃カレンダー</a>のページから右上の「🔒 閲覧のみ」ボタンでログインしてください。</p>
      </div>
    );
  }

  return (
    <div style={{ background: "#F6F5F1", minHeight: "100vh", padding: 24, fontFamily: "'Noto Sans JP', sans-serif", color: "#1E2422" }}>
      <style>{FONT_IMPORT}</style>

      {editingCell && (
        <ShiftCellModal
          name={editingCell.name}
          date={editingCell.date}
          initial={shiftMap[`${area}|${editingCell.name}|${editingCell.date}`]}
          onClose={() => setEditingCell(null)}
          onSave={(rec) => saveCell(editingCell.name, editingCell.date, rec)}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#8A8578", fontFamily: "'JetBrains Mono', monospace" }}>SHOEI CLEANING OPERATIONS</div>
          <h1 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: 24, margin: "2px 0 0", color: "#20302C" }}>🗓 シフト管理</h1>
        </div>
        <a href="/" style={{ fontSize: 13, color: "#5C5850" }}>← 清掃カレンダーに戻る</a>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, background: "#E9E6DC", padding: 4, borderRadius: 10 }}>
          {SHIFT_AREAS.map((a) => (
            <button key={a.key} onClick={() => setArea(a.key)} style={{ border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: area === a.key ? "#20302C" : "transparent", color: area === a.key ? "#F6F5F1" : "#5C5850" }}>
              {a.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href={`/shifts?month=${prev.y}-${String(prev.m).padStart(2, "0")}`} style={{ border: BORDER, borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff", textDecoration: "none", color: "#3B3833" }}>◀ 前の月</a>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{year}年{month}月</div>
          <a href={`/shifts?month=${next.y}-${String(next.m).padStart(2, "0")}`} style={{ border: BORDER, borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff", textDecoration: "none", color: "#3B3833" }}>次の月 ▶</a>
        </div>
        <button onClick={addStaff} style={{ border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "#F1EFE7", color: "#5C5850", cursor: "pointer" }}>＋ スタッフ追加</button>
      </div>

      <div style={{ fontSize: 11, color: "#8A8578", marginBottom: 8 }}>
        セルをクリックして登録してください。マスの色: 緑=出勤可能のみ／黄=同日2件以上OK／赤=当日チェックイン不可
      </div>

      <div style={{ overflowX: "auto", border: BORDER, borderRadius: 12, background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: `120px repeat(${monthDays.length}, 42px)`, minWidth: 120 + monthDays.length * 42 }}>
          <div style={{ borderBottom: BORDER, borderRight: BORDER, background: "#F1EFE7" }} />
          {monthDays.map((d) => (
            <div key={toISO(d)} style={{ textAlign: "center", padding: "6px 0", borderBottom: BORDER, borderRight: BORDER, background: "#F1EFE7", fontSize: 10 }}>
              <div style={{ opacity: 0.7 }}>{WEEKDAY_JA[d.getUTCDay()]}</div>
              <div style={{ fontWeight: 700 }}>{d.getUTCDate()}</div>
            </div>
          ))}

          {staffList.length === 0 && (
            <div style={{ gridColumn: `1 / span ${monthDays.length + 1}`, padding: 20, textAlign: "center", color: "#B0AC9F", fontSize: 13 }}>
              スタッフが登録されていません。「＋ スタッフ追加」から登録してください。
            </div>
          )}

          {staffList.map((name, rIdx) => (
            <div key={name} style={{ display: "contents" }}>
              <div style={{ padding: "8px 10px", borderBottom: BORDER, borderRight: BORDER, background: rIdx % 2 === 0 ? "#fff" : "#FAFAF7", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center" }}>{name}</div>
              {monthDays.map((d) => {
                const iso = toISO(d);
                const rec = shiftMap[`${area}|${name}|${iso}`];
                let bg = rIdx % 2 === 0 ? "#fff" : "#FAFAF7";
                let color = "#3A6B4C";
                const parts = [];
                if (rec?.available) {
                  parts.push("✓");
                  if (rec.two_plus) parts.push("2件◎");
                  if (rec.no_same_day) parts.push("当日×");
                  if (rec.no_same_day) { bg = "#FBE7E7"; color = "#C0392B"; }
                  else if (rec.two_plus) { bg = "#FBF1DE"; color = "#9C7A1E"; }
                  else { bg = "#E7F1EA"; color = "#3A6B4C"; }
                }
                return (
                  <button
                    key={iso}
                    onClick={() => setEditingCell({ name, date: iso })}
                    style={{ border: "none", borderBottom: BORDER, borderRight: BORDER, background: bg, cursor: "pointer", fontSize: 8, lineHeight: 1.3, color, fontWeight: 700, padding: "2px 0" }}
                  >
                    {parts.map((p, i) => <div key={i}>{p}</div>)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
