import React, { useMemo, useState } from "react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');`;

const STATUS = {
  pending: { label: "未着手", color: "#D9A441", bg: "#FBF1DE" },
  in_progress: { label: "清掃中", color: "#4A7AC4", bg: "#E7EEFB" },
  done: { label: "完了", color: "#5B8C6E", bg: "#E7F1EA" },
  needs_check: { label: "要確認", color: "#C24A4A", bg: "#FBE7E7" },
};
const STATUS_ORDER = ["pending", "in_progress", "done", "needs_check"];

const PALETTE = ["#C4703A", "#4A7A9B", "#8A6BAE", "#6B8E4E", "#B2854A", "#4E8A8A", "#A65C7A", "#7A8A4E"];

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
function formatMonthDay(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_JA[d.getDay()]})`;
}
function formatWeekdayShort(d) {
  return WEEKDAY_JA[d.getDay()];
}

function toISO(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * props.tasks: [{ id, propertyId, propertyName, roomName, date, status, guestName, sameDayCheckin }]
 * props.today: 'YYYY-MM-DD'（サーバー側の日付。省略時はクライアントの今日）
 * props.onStatusChange: async (taskId, nextStatus) => void
 */
export default function CleaningCalendar({ tasks: initialTasks, today: todayISO, onStatusChange }) {
  const [tasks, setTasks] = useState(initialTasks);
  const today = useMemo(() => (todayISO ? new Date(todayISO + "T00:00:00") : new Date()), [todayISO]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

  const properties = useMemo(() => {
    const map = new Map();
    tasks.forEach((t) => {
      if (!map.has(t.propertyId)) {
        map.set(t.propertyId, {
          id: t.propertyId,
          name: t.propertyName,
          color: PALETTE[map.size % PALETTE.length],
        });
      }
    });
    return Array.from(map.values());
  }, [tasks]);

  const cycleStatus = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const idx = STATUS_ORDER.indexOf(task.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: next } : t)));

    try {
      if (onStatusChange) await onStatusChange(taskId, next);
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)));
      alert("ステータスの更新に失敗しました。もう一度お試しください。");
    }
  };

  const todayCounts = useMemo(() => {
    const todayTasks = tasks.filter((t) => t.date === toISO(today));
    const c = { pending: 0, in_progress: 0, done: 0, needs_check: 0 };
    todayTasks.forEach((t) => (c[t.status] += 1));
    return { total: todayTasks.length, ...c };
  }, [tasks, today]);

  return (
    <div style={{ background: "#F6F5F1", minHeight: "100%", padding: 24, fontFamily: "'Noto Sans JP', sans-serif", color: "#1E2422" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, color: "#8A8578", fontFamily: "'JetBrains Mono', monospace" }}>CLEANING OPERATIONS</div>
        <h1 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: 26, margin: "2px 0 0", color: "#20302C" }}>
          清掃カレンダー
        </h1>
      </div>

      <div style={{ display: "flex", gap: 1, background: "#E4E1D8", borderRadius: 14, overflow: "hidden", border: "1px solid #E4E1D8", marginBottom: 20 }}>
        <div style={{ flex: "0 0 180px", background: "#20302C", color: "#F6F5F1", padding: "18px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>
            {formatMonthDay(today)}
          </div>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: 30, marginTop: 6 }}>
            {todayCounts.total}
            <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4, opacity: 0.75 }}>件 本日</span>
          </div>
        </div>
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} style={{ flex: 1, background: "#FFFFFF", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5C5850" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
              {s.label}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 24, color: "#20302C", marginTop: 4 }}>
              {todayCounts[key]}
            </div>
          </div>
        ))}
      </div>

      {properties.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "#8A8578", background: "#fff", borderRadius: 12 }}>
          今後7日間に予定されている清掃タスクはありません。
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `160px repeat(${days.length}, minmax(160px, 1fr))`, gap: 10, minWidth: 900 }}>
            <div />
            {days.map((d) => {
              const isToday = toISO(d) === toISO(today);
              return (
                <div key={toISO(d)} style={{ textAlign: "center", padding: "6px 0", borderRadius: 8, background: isToday ? "#20302C" : "transparent", color: isToday ? "#F6F5F1" : "#5C5850" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.75 }}>{formatWeekdayShort(d)}</div>
                  <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 }}>{d.getDate()}</div>
                </div>
              );
            })}

            {properties.map((prop) => (
              <React.Fragment key={prop.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#20302C", paddingLeft: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: prop.color, display: "inline-block", flexShrink: 0 }} />
                  {prop.name}
                </div>
                {days.map((d) => {
                  const iso = toISO(d);
                  const dayTasks = tasks.filter((t) => t.propertyId === prop.id && t.date === iso);
                  return (
                    <div key={prop.id + iso} style={{ minHeight: 64, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
                      {dayTasks.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#C9C5B8", textAlign: "center" }}>—</div>
                      ) : (
                        dayTasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => cycleStatus(t.id)}
                            title="クリックでステータスを切り替え"
                            style={{
                              width: "100%",
                              textAlign: "left",
                              background: "#FFFFFF",
                              border: t.sameDayCheckin ? "1.5px solid #C24A4A" : "1px solid #E4E1D8",
                              borderRadius: 10,
                              padding: "8px 10px",
                              cursor: "pointer",
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: prop.color }}>{t.roomName}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: STATUS[t.status].color, background: STATUS[t.status].bg, padding: "2px 8px", borderRadius: 999 }}>
                                {STATUS[t.status].label}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#3B3833" }}>{t.guestName || "(氏名未取得)"}</div>
                            {t.sameDayCheckin && <div style={{ fontSize: 10, color: "#C24A4A", fontWeight: 700 }}>⚠ 同日チェックイン</div>}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 11, color: "#8A8578" }}>カードをクリックするとステータスが切り替わります（未着手 → 清掃中 → 完了 → 要確認）。</div>
    </div>
  );
}
