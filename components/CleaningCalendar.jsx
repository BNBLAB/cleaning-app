import React, { useMemo, useState } from "react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&family=Noto+Sans+JP:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');`;

const STATUS = {
  pending: { label: "未清掃", color: "#D9A441", bg: "#FBF1DE" },
  done: { label: "完了", color: "#5B8C6E", bg: "#E7F1EA" },
  needs_check: { label: "要確認", color: "#C24A4A", bg: "#FBE7E7" },
};
const STATUS_ORDER = ["pending", "done"];
function effectiveStatus(t) {
  return t.assignee ? t.status : "needs_check";
}

const AREAS = [
  { key: "all", label: "すべて" },
  { key: "hatagaya", label: "幡ヶ谷" },
  { key: "futtsu", label: "富津" },
];

const PALETTE = ["#C4703A", "#4A7A9B", "#8A6BAE", "#6B8E4E", "#B2854A", "#4E8A8A", "#A65C7A", "#7A8A4E"];
const BORDER = "1px solid #DEDACE";
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

function cardBorder(t) {
  if (t.sameDayCheckin) return "1.5px solid #C24A4A";
  const notes = t.notes || "";
  if (notes.includes("アーリーチェックイン") || notes.includes("レイトチェックアウト")) return "1.5px solid #D9A441";
  if (notes.trim()) return "1.5px solid #9B9689";
  return BORDER;
}

export default function CleaningCalendar({ tasks: initialTasks, today: todayISO, assigneeOptions = [], onStatusChange, onAssigneeChange, onNotesChange }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [area, setArea] = useState("all");
  const today = useMemo(() => (todayISO ? new Date(todayISO + "T00:00:00") : new Date()), [todayISO]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

  const filteredTasks = useMemo(() => (area === "all" ? tasks : tasks.filter((t) => t.area === area)), [tasks, area]);

  const properties = useMemo(() => {
    const map = new Map();
    filteredTasks.forEach((t) => {
      if (!map.has(t.propertyId)) {
        map.set(t.propertyId, {
          id: t.propertyId,
          name: t.propertyName,
          amenities: t.amenities,
          color: PALETTE[map.size % PALETTE.length],
        });
      }
    });
    return Array.from(map.values());
  }, [filteredTasks]);

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

  const changeAssignee = async (taskId, value) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assignee: value || null } : t)));
    try {
      if (onAssigneeChange) await onAssigneeChange(taskId, value || null);
    } catch (e) {
      alert("担当者の更新に失敗しました。");
    }
  };

  const changeNotes = async (taskId, notes) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, notes: notes || null } : t)));
    try {
      if (onNotesChange) await onNotesChange(taskId, notes || null);
    } catch (e) {
      alert("備考の更新に失敗しました。");
    }
  };

  const todayCounts = useMemo(() => {
    const todayTasks = filteredTasks.filter((t) => t.date === toISO(today));
    const c = { pending: 0, done: 0, needs_check: 0 };
    todayTasks.forEach((t) => (c[effectiveStatus(t)] += 1));
    return { total: todayTasks.length, ...c };
  }, [filteredTasks, today]);

  return (
    <div style={{ background: "#F6F5F1", minHeight: "100%", padding: 24, fontFamily: "'Noto Sans JP', sans-serif", color: "#1E2422" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#8A8578", fontFamily: "'JetBrains Mono', monospace" }}>SHOEI CLEANING OPERATIONS</div>
          <h1 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: 26, margin: "2px 0 0", color: "#20302C" }}>
            清掃カレンダー
          </h1>
        </div>

        <div style={{ display: "flex", gap: 6, background: "#E9E6DC", padding: 4, borderRadius: 10 }}>
          {AREAS.map((a) => (
            <button
              key={a.key}
              onClick={() => setArea(a.key)}
              style={{
                border: "none",
                borderRadius: 7,
                padding: "7px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
                background: area === a.key ? "#20302C" : "transparent",
                color: area === a.key ? "#F6F5F1" : "#5C5850",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 1, background: "#E4E1D8", borderRadius: 14, overflow: "hidden", border: BORDER, marginBottom: 20 }}>
        <div style={{ flex: "0 0 180px", background: "#20302C", color: "#F6F5F1", padding: "18px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>{formatMonthDay(today)}</div>
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
        <div style={{ padding: 24, textAlign: "center", color: "#8A8578", background: "#fff", borderRadius: 12, border: BORDER }}>
          今後7日間に予定されている清掃タスクはありません。
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: BORDER, borderRadius: 12, background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: `210px repeat(${days.length}, minmax(200px, 1fr))`, minWidth: 990 }}>
            <div style={{ borderBottom: BORDER, borderRight: BORDER, background: "#F1EFE7" }} />
            {days.map((d) => {
              const isToday = toISO(d) === toISO(today);
              return (
                <div key={toISO(d)} style={{ textAlign: "center", padding: "10px 0", borderBottom: BORDER, borderRight: BORDER, background: isToday ? "#20302C" : "#F1EFE7", color: isToday ? "#F6F5F1" : "#5C5850" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.75 }}>{formatWeekdayShort(d)}</div>
                  <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 }}>{d.getDate()}</div>
                </div>
              );
            })}

            {properties.map((prop, propIdx) => (
              <React.Fragment key={prop.id}>
                <div style={{ padding: "10px 12px", borderBottom: BORDER, borderRight: BORDER, background: propIdx % 2 === 0 ? "#FFFFFF" : "#FAFAF7" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#20302C" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: prop.color, display: "inline-block", flexShrink: 0 }} />
                    {prop.name}
                  </div>
                  {prop.amenities && <div style={{ fontSize: 10.5, color: "#8A8578", marginTop: 4, lineHeight: 1.5 }}>🧴 {prop.amenities}</div>}
                </div>
                {days.map((d) => {
                  const iso = toISO(d);
                  const dayTasks = filteredTasks.filter((t) => t.propertyId === prop.id && t.date === iso);
                  return (
                    <div
                      key={prop.id + iso}
                      style={{ minHeight: 72, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", padding: 8, borderBottom: BORDER, borderRight: BORDER, background: propIdx % 2 === 0 ? "#FFFFFF" : "#FAFAF7" }}
                    >
                      {dayTasks.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#C9C5B8", textAlign: "center" }}>—</div>
                      ) : (
                        dayTasks.map((t) => {
                          const unassigned = !t.assignee;
                          return (
                            <div
                              key={t.id}
                              style={{
                                background: unassigned ? "#FCE8E8" : "#FFFFFF",
                                border: cardBorder(t),
                                borderRadius: 10,
                                padding: "8px 10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 5,
                              }}
                            >
                              <button
                                onClick={() => cycleStatus(t.id)}
                                title="クリックでステータスを切り替え（未清掃⇔完了）"
                                style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: prop.color }}>{t.roomName}</span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: STATUS[effectiveStatus(t)].color,
                                      background: STATUS[effectiveStatus(t)].bg,
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                    }}
                                  >
                                    {STATUS[effectiveStatus(t)].label}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: "#3B3833" }}>{t.guestName || "(氏名未取得)"}</div>
                              </button>

                              <div style={{ fontSize: 10.5, color: "#6B675E", lineHeight: 1.6, borderTop: "1px dashed #E4E1D8", paddingTop: 4 }}>
                                <div>
                                  前回: {t.prevGuests ?? "?"}名 / {t.prevNights ?? "?"}泊
                                </div>
                                <div>
                                  次回: {t.nextGuests != null ? `${t.nextGuests}名 / ${t.nextNights}泊` : "予約なし"}
                                </div>
                              </div>

                              {t.sameDayCheckin && <div style={{ fontSize: 10, color: "#C24A4A", fontWeight: 700 }}>⚠ 同日チェックイン</div>}

                              {t.notes ? (
                                <button
                                  onClick={() => {
                                    const input = window.prompt("備考を入力してください（例: エアコン工事あり 13:00-15:00 / アーリーチェックイン / レイトチェックアウト）", t.notes ?? "");
                                    if (input === null) return;
                                    changeNotes(t.id, input.trim());
                                  }}
                                  style={{
                                    all: "unset",
                                    cursor: "pointer",
                                    fontSize: 10.5,
                                    color: "#8A5A1E",
                                    background: "#FDF0DC",
                                    border: "1px solid #EBCB9A",
                                    borderRadius: 6,
                                    padding: "4px 6px",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  📝 {t.notes}
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    const input = window.prompt("備考を入力してください（例: エアコン工事あり 13:00-15:00 / アーリーチェックイン / レイトチェックアウト）", "");
                                    if (input === null) return;
                                    changeNotes(t.id, input.trim());
                                  }}
                                  style={{ all: "unset", cursor: "pointer", fontSize: 10, color: "#B0AC9F" }}
                                >
                                  ＋ 備考を追加
                                </button>
                              )}

                              <select
                                value={t.assignee ?? ""}
                                onChange={(e) => changeAssignee(t.id, e.target.value)}
                                style={{
                                  fontSize: 11,
                                  border: BORDER,
                                  borderRadius: 6,
                                  padding: "3px 4px",
                                  color: t.assignee ? "#20302C" : "#B0AC9F",
                                  background: "#FAFAF9",
                                }}
                              >
                                <option value="">清掃担当: 未設定</option>
                                {assigneeOptions.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 11, color: "#8A8578" }}>
        ステータスはクリックで「未清掃⇔完了」を切り替えられます。「要確認」は担当者が未選択のときに自動表示されます。枠線の色: 赤=同日チェックイン／黄=アーリーチェックイン・レイトチェックアウト（備考に記載）／グレー=その他の備考あり。担当者未選択のカードは背景がピンク色になります。
      </div>
    </div>
  );
}
