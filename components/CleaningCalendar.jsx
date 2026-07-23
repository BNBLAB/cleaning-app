import React, { useMemo, useState, useEffect } from "react";

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
  { key: "message", label: "メッセージ" },
];

const SPECIAL_ROWS = {
  hatagaya: [
    { key: "takobeya_common", label: "Takobeya 共用部", slots: 1 },
    { key: "harada_entrance", label: "原田ビル エントランス", slots: 1 },
    { key: "office_morning", label: "事務バイト朝", slots: 1 },
    { key: "office_after", label: "事務バイト清掃後", slots: 1 },
    { key: "other", label: "その他", slots: 1 },
  ],
  futtsu: [{ key: "special_cleaning", label: "富津 特別清掃", slots: 1 }],
  message: [
    { key: "message_parttime", label: "メッセージバイト（19時-25時）", slots: 2 },
    { key: "message_staff", label: "メッセージ対応社員", slots: 1 },
  ],
};

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

const pillBtn = { border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif" };
const navBtnStyle = { border: BORDER, borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#FFFFFF", color: "#3B3833", cursor: "pointer", fontFamily: "'Noto Sans JP', sans-serif", textDecoration: "none", display: "inline-block" };

function LockBadge({ unlocked, onUnlock, onLock }) {
  const [showInput, setShowInput] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  if (unlocked) {
    return <button onClick={onLock} style={{ ...pillBtn, background: "#E7F1EA", color: "#3A6B4C", border: "1px solid #B9DCC4" }}>🔓 編集可能（ログアウト）</button>;
  }

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        onUnlock();
        setShowInput(false);
        setPw("");
      } else {
        alert("パスワードが違います");
      }
    } catch (e) {
      alert("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  if (showInput) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="パスワード"
          style={{ border: BORDER, borderRadius: 8, padding: "6px 10px", fontSize: 13, width: 110 }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} disabled={busy} style={pillBtn}>{busy ? "..." : "ログイン"}</button>
      </div>
    );
  }
  return (
    <button onClick={() => setShowInput(true)} style={{ ...pillBtn, background: "#F1EFE7", color: "#5C5850" }}>
      🔒 閲覧のみ（社員はここからログイン）
    </button>
  );
}

function AssigneeSelect({ value, unlocked, onChange, options, requestUnlock, small }) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (!unlocked) return requestUnlock();
        const v = e.target.value;
        if (v === "__new__") {
          const name = window.prompt("担当者の名前を入力してください");
          if (name) onChange(name);
          return;
        }
        onChange(v);
      }}
      onMouseDown={(e) => { if (!unlocked) e.preventDefault(); }}
      style={{
        fontSize: small ? 11 : 13,
        border: BORDER,
        borderRadius: 6,
        padding: small ? "3px 4px" : "6px 8px",
        color: value ? "#20302C" : "#B0AC9F",
        background: unlocked ? "#FAFAF9" : "#F1EFE7",
        cursor: unlocked ? "pointer" : "not-allowed",
        width: "100%",
      }}
    >
      <option value="">未設定</option>
      {list.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
      <option value="__new__">＋ 新しい担当者を追加</option>
    </select>
  );
}

function TaskCard({ t, prop, unlocked, onCycle, onAssignee, onNotes, options, compact, requestUnlock }) {
  const guard = (fn) => (...args) => { if (!unlocked) { requestUnlock(); return; } fn(...args); };
  const unassigned = !t.assignee;
  return (
    <div style={{ background: unassigned ? "#FCE8E8" : "#FFFFFF", border: cardBorder(t), borderRadius: 10, padding: compact ? "12px 14px" : "8px 10px", display: "flex", flexDirection: "column", gap: compact ? 8 : 5 }}>
      {compact && <div style={{ fontSize: 11, color: prop.color, fontWeight: 700 }}>{prop.name}</div>}
      <button onClick={guard(() => onCycle(t.id))} title="クリックでステータスを切り替え（未清掃⇔完了）" style={{ all: "unset", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: compact ? 14 : 11, fontWeight: 700, color: prop.color }}>{t.roomName}</span>
          <span style={{ fontSize: compact ? 12 : 11, fontWeight: 700, color: STATUS[effectiveStatus(t)].color, background: STATUS[effectiveStatus(t)].bg, padding: compact ? "3px 10px" : "2px 8px", borderRadius: 999 }}>
            {STATUS[effectiveStatus(t)].label}
          </span>
        </div>
        <div style={{ fontSize: compact ? 15 : 12, color: "#3B3833", fontWeight: 700 }}>{t.guestName || "(氏名未取得)"}</div>
      </button>

      <div style={{ fontSize: compact ? 12.5 : 10.5, color: "#6B675E", lineHeight: 1.6, borderTop: "1px dashed #E4E1D8", paddingTop: 4, display: "flex", gap: compact ? 16 : 10 }}>
        <div>前回: {t.prevGuests ?? "?"}名 / {t.prevNights ?? "?"}泊</div>
        <div>次回: {t.nextGuests != null ? `${t.nextGuests}名 / ${t.nextNights}泊` : "予約なし"}</div>
      </div>

      {t.sameDayCheckin && <div style={{ fontSize: compact ? 12 : 10, color: "#C24A4A", fontWeight: 700 }}>⚠ 同日チェックイン</div>}

      {t.notes ? (
        <button
          onClick={guard(() => {
            const input = window.prompt("備考を入力してください（例: エアコン工事あり 13:00-15:00 / アーリーチェックイン / レイトチェックアウト）", t.notes ?? "");
            if (input === null) return;
            onNotes(t.id, input.trim());
          })}
          style={{ all: "unset", cursor: "pointer", fontSize: compact ? 12.5 : 10.5, color: "#8A5A1E", background: "#FDF0DC", border: "1px solid #EBCB9A", borderRadius: 6, padding: "5px 8px", lineHeight: 1.5 }}
        >
          📝 {t.notes}
        </button>
      ) : (
        <button
          onClick={guard(() => {
            const input = window.prompt("備考を入力してください（例: エアコン工事あり 13:00-15:00 / アーリーチェックイン / レイトチェックアウト）", "");
            if (input === null) return;
            onNotes(t.id, input.trim());
          })}
          style={{ all: "unset", cursor: "pointer", fontSize: compact ? 12 : 10, color: "#B0AC9F" }}
        >
          ＋ 備考を追加
        </button>
      )}

      <AssigneeSelect value={t.assignee} unlocked={unlocked} onChange={(v) => onAssignee(t.id, v)} options={options} requestUnlock={requestUnlock} small={!compact} />
    </div>
  );
}

/**
 * props.tasks / properties / specialAssignees / today / weekStart / assigneeOptions
 * props.onStatusChange / onAssigneeChange / onNotesChange / onSpecialAssigneeChange / onReorder / onAmenitiesChange
 */
export default function CleaningCalendar({
  tasks: initialTasks,
  properties: initialProperties,
  specialAssignees: initialSpecialAssignees,
  today: todayISO,
  weekStart: weekStartISO,
  showHidden = false,
  assigneeOptions = [],
  onStatusChange,
  onAssigneeChange,
  onNotesChange,
  onSpecialAssigneeChange,
  onReorder,
  onAmenitiesChange,
  onPropertyUpdate,
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [specialAssignees, setSpecialAssignees] = useState(initialSpecialAssignees);
  const [area, setArea] = useState("all");
  const [unlocked, setUnlocked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  useEffect(() => {
    setUnlocked(localStorage.getItem("cleaningAppUnlocked") === "1");
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const lock = () => {
    localStorage.removeItem("cleaningAppUnlocked");
    setUnlocked(false);
  };
  const unlock = () => {
    localStorage.setItem("cleaningAppUnlocked", "1");
    setUnlocked(true);
  };

  const requestUnlock = () => alert("編集には社員のログインが必要です。右上の「🔒 閲覧のみ」ボタンからログインしてください。");

  const today = useMemo(() => new Date(todayISO + "T00:00:00"), [todayISO]);
  const weekStart = useMemo(() => new Date(weekStartISO + "T00:00:00"), [weekStartISO]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const filteredTasks = useMemo(() => {
    if (area === "message") return [];
    if (area === "all") return tasks;
    return tasks.filter((t) => t.area === area);
  }, [tasks, area]);

  const visibleProperties = useMemo(() => {
    let list;
    if (area === "all") list = initialProperties;
    else if (area === "message") list = [];
    else list = initialProperties.filter((p) => p.area === area);
    return list.map((p, i) => ({ ...p, color: PALETTE[i % PALETTE.length] }));
  }, [initialProperties, area]);

  const specialRowsForArea = useMemo(() => {
    if (area === "message") return SPECIAL_ROWS.message;
    if (area === "hatagaya") return SPECIAL_ROWS.hatagaya;
    if (area === "futtsu") return SPECIAL_ROWS.futtsu;
    if (area === "all") return [...SPECIAL_ROWS.hatagaya, ...SPECIAL_ROWS.futtsu];
    return [];
  }, [area]);

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
      alert("ステータスの更新に失敗しました。");
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

  const changeSpecialAssignee = async (rowKey, slotIndex, iso, value) => {
    setSpecialAssignees((prev) => ({ ...prev, [`${rowKey}|${iso}|${slotIndex}`]: value || null }));
    try {
      if (onSpecialAssigneeChange) await onSpecialAssigneeChange(rowKey, slotIndex, iso, value || null);
    } catch (e) {
      alert("担当者の更新に失敗しました。");
    }
  };

  const handleAmenitiesEdit = async (prop) => {
    if (!unlocked) return requestUnlock();
    const input = window.prompt(`${prop.name} のアメニティ情報`, prop.amenities || "");
    if (input === null) return;
    try {
      if (onAmenitiesChange) await onAmenitiesChange(prop.id, input.trim());
      window.location.reload();
    } catch (e) {
      alert("更新に失敗しました。");
    }
  };

  const handleReorder = async (propertyId, direction) => {
    if (!unlocked) return requestUnlock();
    try {
      if (onReorder) await onReorder(propertyId, direction);
    } catch (e) {
      alert("並び替えに失敗しました。");
    }
  };

  const handleRename = async (prop) => {
    if (!unlocked) return requestUnlock();
    const input = window.prompt("施設名を入力してください", prop.name);
    if (input === null || !input.trim()) return;
    try {
      if (onPropertyUpdate) await onPropertyUpdate(prop.id, { name: input.trim() });
    } catch (e) {
      alert("名前の更新に失敗しました。");
    }
  };

  const handleToggleActive = async (prop) => {
    if (!unlocked) return requestUnlock();
    const hiding = prop.active !== false;
    const msg = hiding ? `「${prop.name}」を一覧から非表示にしますか？` : `「${prop.name}」を再表示しますか？`;
    if (!window.confirm(msg)) return;
    try {
      if (onPropertyUpdate) await onPropertyUpdate(prop.id, { active: !hiding });
    } catch (e) {
      alert("更新に失敗しました。");
    }
  };

  const todayCounts = useMemo(() => {
    const todayTasks = filteredTasks.filter((t) => t.date === toISO(today));
    const c = { pending: 0, done: 0, needs_check: 0 };
    todayTasks.forEach((t) => (c[effectiveStatus(t)] += 1));
    return { total: todayTasks.length, ...c };
  }, [filteredTasks, today]);

  const prevWeekHref = `/?start=${toISO(addDays(weekStart, -7))}`;
  const nextWeekHref = `/?start=${toISO(addDays(weekStart, 7))}`;
  const todayHref = "/";

  const showPropertyGrid = area !== "message";

  const renderSpecialRowDesktop = (row, rowIdx, offset) => (
    <React.Fragment key={row.key}>
      <div style={{ padding: "10px 12px", borderBottom: BORDER, borderRight: BORDER, background: (offset + rowIdx) % 2 === 0 ? "#FFFFFF" : "#FAFAF7", display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#5C5850" }}>{row.label}</span>
      </div>
      {days.map((d) => {
        const iso = toISO(d);
        return (
          <div key={row.key + iso} style={{ minHeight: 72, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", padding: 8, borderBottom: BORDER, borderRight: BORDER, background: (offset + rowIdx) % 2 === 0 ? "#FFFFFF" : "#FAFAF7" }}>
            {Array.from({ length: row.slots }, (_, slotIdx) => (
              <AssigneeSelect
                key={slotIdx}
                value={specialAssignees[`${row.key}|${iso}|${slotIdx}`]}
                unlocked={unlocked}
                onChange={(v) => changeSpecialAssignee(row.key, slotIdx, iso, v)}
                options={assigneeOptions}
                requestUnlock={requestUnlock}
              />
            ))}
          </div>
        );
      })}
    </React.Fragment>
  );

  const renderSpecialRowMobile = (row) => {
    const iso = toISO(days[selectedDayIdx]);
    return (
      <div key={row.key} style={{ background: "#FFFFFF", border: BORDER, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#5C5850" }}>{row.label}</div>
        {Array.from({ length: row.slots }, (_, slotIdx) => (
          <AssigneeSelect
            key={slotIdx}
            value={specialAssignees[`${row.key}|${iso}|${slotIdx}`]}
            unlocked={unlocked}
            onChange={(v) => changeSpecialAssignee(row.key, slotIdx, iso, v)}
            options={assigneeOptions}
            requestUnlock={requestUnlock}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ background: "#F6F5F1", minHeight: "100%", padding: isMobile ? 14 : 24, fontFamily: "'Noto Sans JP', sans-serif", color: "#1E2422" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, color: "#8A8578", fontFamily: "'JetBrains Mono', monospace" }}>SHOEI CLEANING OPERATIONS</div>
          <h1 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: isMobile ? 22 : 26, margin: "2px 0 0", color: "#20302C" }}>清掃カレンダー</h1>
        </div>
        <LockBadge unlocked={unlocked} onUnlock={unlock} onLock={lock} />
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <a href={prevWeekHref} style={navBtnStyle}>◀ 前の週</a>
          <a href={todayHref} style={{ ...navBtnStyle, fontWeight: 700 }}>今日</a>
          <a href={nextWeekHref} style={navBtnStyle}>次の週 ▶</a>
          <input
            type="date"
            onChange={(e) => {
              if (e.target.value) window.location.href = `/?start=${e.target.value}`;
            }}
            style={{ border: BORDER, borderRadius: 8, padding: "6px 8px", fontSize: 13 }}
          />
          {unlocked && (
            
              href={showHidden ? "/" : "/?showHidden=1"}
              style={{ ...navBtnStyle, background: showHidden ? "#20302C" : "#FFFFFF", color: showHidden ? "#F6F5F1" : "#3B3833" }}
            >
              {showHidden ? "非表示物件を隠す" : "👁 非表示物件を管理"}
            </a>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, background: "#E9E6DC", padding: 4, borderRadius: 10, flexWrap: "wrap" }}>
          {AREAS.map((a) => (
            <button
              key={a.key}
              onClick={() => setArea(a.key)}
              style={{ border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: area === a.key ? "#20302C" : "transparent", color: area === a.key ? "#F6F5F1" : "#5C5850" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {area !== "message" && (
        <div style={{ display: "flex", gap: 1, background: "#E4E1D8", borderRadius: 14, overflow: "hidden", border: BORDER, marginBottom: 20, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <div style={{ flex: isMobile ? "1 1 100%" : "0 0 180px", background: "#20302C", color: "#F6F5F1", padding: "16px 18px" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>{formatMonthDay(today)}</div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 900, fontSize: 28, marginTop: 6 }}>
              {todayCounts.total}<span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4, opacity: 0.75 }}>件 本日</span>
            </div>
          </div>
          {Object.entries(STATUS).map(([key, s]) => (
            <div key={key} style={{ flex: isMobile ? "1 1 25%" : 1, background: "#FFFFFF", padding: "16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#5C5850" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />{s.label}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 22, color: "#20302C", marginTop: 4 }}>{todayCounts[key]}</div>
            </div>
          ))}
        </div>
      )}

      {isMobile ? (
        <>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 10 }}>
            {days.map((d, i) => {
              const isToday = toISO(d) === todayISO;
              const selected = i === selectedDayIdx;
              return (
                <button key={toISO(d)} onClick={() => setSelectedDayIdx(i)} style={{ flex: "0 0 auto", border: isToday ? "1.5px solid #20302C" : BORDER, borderRadius: 10, padding: "8px 12px", background: selected ? "#20302C" : "#FFFFFF", color: selected ? "#F6F5F1" : "#3B3833", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", opacity: 0.8 }}>{formatWeekdayShort(d)}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{d.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {showPropertyGrid &&
              [...visibleProperties]
                .sort((a, b) => {
                  const iso = toISO(days[selectedDayIdx]);
                  const aHas = filteredTasks.some((x) => x.propertyId === a.id && x.date === iso) ? 0 : 1;
                  const bHas = filteredTasks.some((x) => x.propertyId === b.id && x.date === iso) ? 0 : 1;
                  return aHas - bHas;
                })
                .map((prop) => {
                  const iso = toISO(days[selectedDayIdx]);
                  const t = filteredTasks.find((x) => x.propertyId === prop.id && x.date === iso);
                  if (!t) return null;
                  return (
                    <TaskCard key={t.id} t={t} prop={prop} compact unlocked={unlocked} requestUnlock={requestUnlock} onCycle={cycleStatus} onAssignee={changeAssignee} onNotes={changeNotes} options={assigneeOptions} />
                  );
                })}
            {specialRowsForArea.map((row) => renderSpecialRowMobile(row))}
          </div>
        </>
      ) : (
        <div style={{ overflowX: "auto", border: BORDER, borderRadius: 12, background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${days.length}, minmax(200px, 1fr))`, minWidth: 1000 }}>
            <div style={{ borderBottom: BORDER, borderRight: BORDER, background: "#F1EFE7" }} />
            {days.map((d) => {
              const isToday = toISO(d) === todayISO;
              return (
                <div key={toISO(d)} style={{ textAlign: "center", padding: "10px 0", borderBottom: BORDER, borderRight: BORDER, background: isToday ? "#20302C" : "#F1EFE7", color: isToday ? "#F6F5F1" : "#5C5850" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, opacity: 0.75 }}>{formatWeekdayShort(d)}</div>
                  <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 }}>{d.getDate()}</div>
                </div>
              );
            })}

            {showPropertyGrid &&
              visibleProperties.map((prop, propIdx) => (
                <React.Fragment key={prop.id}>
                  <div style={{ padding: "10px 12px", borderBottom: BORDER, borderRight: BORDER, background: prop.active === false ? "#F1EFE7" : propIdx % 2 === 0 ? "#FFFFFF" : "#FAFAF7", opacity: prop.active === false ? 0.6 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#20302C" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: prop.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{prop.name}{prop.active === false && <span style={{ fontSize: 10, color: "#C24A4A", marginLeft: 6 }}>(非表示中)</span>}</span>
                      {unlocked && (
                        <div style={{ display: "flex", gap: 2 }}>
                          <button onClick={() => handleReorder(prop.id, "up")} style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "#8A8578", padding: "0 2px" }} title="上へ">▲</button>
                          <button onClick={() => handleReorder(prop.id, "down")} style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "#8A8578", padding: "0 2px" }} title="下へ">▼</button>
                          <button onClick={() => handleRename(prop)} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "#8A8578", padding: "0 2px" }} title="名前を変更">🏷️</button>
                          <button onClick={() => handleAmenitiesEdit(prop)} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "#8A8578", padding: "0 2px" }} title="アメニティ編集">✏️</button>
                          <button onClick={() => handleToggleActive(prop)} style={{ all: "unset", cursor: "pointer", fontSize: 11, color: "#8A8578", padding: "0 2px" }} title={prop.active === false ? "再表示する" : "非表示にする"}>
                            {prop.active === false ? "👁" : "🙈"}
                          </button>
                        </div>
                      )}
                    </div>
                    {prop.amenities && <div style={{ fontSize: 10.5, color: "#8A8578", marginTop: 4, lineHeight: 1.5 }}>🧴 {prop.amenities}</div>}
                  </div>
                  {days.map((d) => {
                    const iso = toISO(d);
                    const dayTasks = filteredTasks.filter((t) => t.propertyId === prop.id && t.date === iso);
                    return (
                      <div key={prop.id + iso} style={{ minHeight: 72, display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", padding: 8, borderBottom: BORDER, borderRight: BORDER, background: propIdx % 2 === 0 ? "#FFFFFF" : "#FAFAF7" }}>
                        {dayTasks.length === 0 ? (
                          <div style={{ fontSize: 11, color: "#C9C5B8", textAlign: "center" }}>—</div>
                        ) : (
                          dayTasks.map((t) => (
                            <TaskCard key={t.id} t={t} prop={prop} unlocked={unlocked} requestUnlock={requestUnlock} onCycle={cycleStatus} onAssignee={changeAssignee} onNotes={changeNotes} options={assigneeOptions} />
                          ))
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}

            {specialRowsForArea.map((row, i) => renderSpecialRowDesktop(row, i, showPropertyGrid ? visibleProperties.length : 0))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18, fontSize: 11, color: "#8A8578" }}>
        ステータスはクリックで「未清掃⇔完了」を切り替えられます。「要確認」は担当者が未選択のときに自動表示されます。物件名の▲▼で並び替え、✏️でアメニティを編集できます（ログイン時のみ）。
      </div>
    </div>
  );
}
