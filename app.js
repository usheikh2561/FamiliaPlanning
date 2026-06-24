// ============================================================
//  FamiliaPlanning — app logic (month calendar edition)
//
//  The big idea (new model):
//  - Everyone is FREE by default.
//  - Each person marks the days they're BUSY (or MAYBE), with a
//    reason icon (work, vacation, wedding, etc.).
//  - The app then highlights the upcoming days/weekends where the
//    MOST people are free — so you can pick a trip date fast.
//
//  Data is saved to a free cloud database (Supabase) if you've
//  filled in config.js; otherwise it uses your browser's storage
//  so everything works right away.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// The three statuses. "free" is the default and is NOT stored
// (a free day = simply no entry). Picking "Free" clears the day.
const STATUS_LABEL = { free: "Free", maybe: "Maybe", busy: "Busy" };

// The reasons a day is busy/maybe, each with an icon. Edit freely!
const REASONS = [
  { id: "work",        icon: "💼", label: "Work" },
  { id: "family",      icon: "👪", label: "Visiting family" },
  { id: "vacation",    icon: "🏖️", label: "Vacation" },
  { id: "travel",      icon: "✈️", label: "Travel" },
  { id: "wedding",     icon: "💒", label: "Wedding" },
  { id: "event",       icon: "🎉", label: "Event / party" },
  { id: "appointment", icon: "🩺", label: "Appointment" },
  { id: "school",      icon: "🎓", label: "School / exam" },
  { id: "other",       icon: "📌", label: "Other" },
];
const REASON_BY_ID = Object.fromEntries(REASONS.map((r) => [r.id, r]));

// How many days ahead the "Best upcoming days" panel looks.
const LOOKAHEAD_DAYS = 60;

// ------------------------------------------------------------
//  STORAGE LAYER — two interchangeable stores, same functions.
//  An "entry" = one person's status (+reason) for one date.
//  Key format used in memory: `${memberId}|${date}` e.g. "abc|2026-06-27"
// ------------------------------------------------------------

// ---- Store A: the browser (no setup needed) ----
const LocalStore = {
  key: "familiaplanning-data-v2",
  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || { members: [], entries: {} };
    } catch {
      return { members: [], entries: {} };
    }
  },
  _write(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  },
  async load() {
    return this._read();
  },
  async addMember(name) {
    const data = this._read();
    const member = { id: crypto.randomUUID(), name };
    data.members.push(member);
    this._write(data);
    return member;
  },
  async removeMember(id) {
    const data = this._read();
    data.members = data.members.filter((m) => m.id !== id);
    for (const k of Object.keys(data.entries)) {
      if (k.startsWith(id + "|")) delete data.entries[k];
    }
    this._write(data);
  },
  async setEntry(memberId, date, status, reason) {
    const data = this._read();
    const k = `${memberId}|${date}`;
    if (status === "free") delete data.entries[k];
    else data.entries[k] = { status, reason };
    this._write(data);
  },
};

// ---- Store B: Supabase cloud (shared with the family) ----
function makeSupabaseStore(client) {
  return {
    async load() {
      const [{ data: members }, { data: rows }] = await Promise.all([
        client.from("members").select("id, name").order("created_at"),
        client.from("entries").select("member_id, date, status, reason"),
      ]);
      const entries = {};
      for (const r of rows || []) {
        entries[`${r.member_id}|${r.date}`] = { status: r.status, reason: r.reason };
      }
      return { members: members || [], entries };
    },
    async addMember(name) {
      const { data, error } = await client
        .from("members").insert({ name }).select("id, name").single();
      if (error) throw error;
      return data;
    },
    async removeMember(id) {
      await client.from("entries").delete().eq("member_id", id);
      await client.from("members").delete().eq("id", id);
    },
    async setEntry(memberId, date, status, reason) {
      if (status === "free") {
        await client.from("entries").delete().match({ member_id: memberId, date });
      } else {
        await client.from("entries").upsert(
          { member_id: memberId, date, status, reason: reason || null },
          { onConflict: "member_id,date" }
        );
      }
    },
  };
}

async function chooseStore() {
  const configured = SUPABASE_URL && SUPABASE_ANON_KEY;
  if (!configured) {
    setStorageStatus("📦 Saving to this device only (cloud not set up yet — see SETUP.md)");
    return LocalStore;
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    setStorageStatus("☁️ Connected to the family cloud — everyone shares this calendar");
    return makeSupabaseStore(client);
  } catch (err) {
    console.error("Could not connect to Supabase, falling back to this device:", err);
    setStorageStatus("⚠️ Cloud connection failed — using this device only for now");
    return LocalStore;
  }
}

// ------------------------------------------------------------
//  DATE HELPERS (built from local time to avoid timezone shifts)
// ------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const isoFromYMD = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-11
function todayISO() {
  const t = new Date();
  return isoFromYMD(t.getFullYear(), t.getMonth(), t.getDate());
}
function isWeekend(dateObj) {
  const day = dateObj.getDay();
  return day === 0 || day === 6;
}
function prettyDate(dateObj) {
  return dateObj.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ------------------------------------------------------------
//  APP STATE
// ------------------------------------------------------------
let store;
let state = { members: [], entries: {} };
let currentMemberId = null;          // whose calendar you're editing
let editDate = null;                 // date currently open in the editor
let viewMode = "mine";               // "mine" = your status; "everyone" = group heat-map
const view = { year: 0, month: 0 };  // which month the calendar shows

function entryFor(memberId, date) {
  return state.entries[`${memberId}|${date}`];
}

// Count statuses for everyone on a given date.
function tallyDate(date) {
  let free = 0, maybe = 0, busy = 0;
  const busyPeople = []; // {member, entry} for those busy/maybe
  for (const m of state.members) {
    const e = entryFor(m.id, date);
    if (!e || e.status === "free") free++;
    else {
      if (e.status === "maybe") maybe++; else busy++;
      busyPeople.push({ member: m, entry: e });
    }
  }
  return { free, maybe, busy, busyPeople, total: state.members.length };
}

// ------------------------------------------------------------
//  STARTUP
// ------------------------------------------------------------
async function start() {
  store = await chooseStore();
  state = await store.load();

  const now = new Date();
  view.year = now.getFullYear();
  view.month = now.getMonth();

  if (state.members.length) currentMemberId = state.members[0].id;

  buildReasonOptions();
  buildReasonLegend();
  wireUpControls();
  renderAll();
}

function renderAll() {
  renderMemberControls();
  renderCalendar();
  renderSummary();
}

// ------------------------------------------------------------
//  MEMBERS
// ------------------------------------------------------------
function renderMemberControls() {
  // "I am" dropdown
  const sel = document.getElementById("current-member");
  sel.innerHTML = "";
  if (state.members.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "— add someone first —";
    opt.value = "";
    sel.appendChild(opt);
    sel.disabled = true;
  } else {
    sel.disabled = false;
    for (const m of state.members) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      sel.appendChild(opt);
    }
    if (!state.members.some((m) => m.id === currentMemberId)) {
      currentMemberId = state.members[0].id;
    }
    sel.value = currentMemberId;
  }

  // The little chips list
  const list = document.getElementById("member-list");
  list.innerHTML = "";
  for (const m of state.members) {
    const li = document.createElement("li");
    li.textContent = m.name;
    const btn = document.createElement("button");
    btn.className = "remove";
    btn.title = `Remove ${m.name}`;
    btn.textContent = "×";
    btn.addEventListener("click", () => removeMember(m.id));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function addMember(name) {
  const clean = name.trim();
  if (!clean) return;
  const member = await store.addMember(clean);
  state.members.push(member);
  currentMemberId = member.id; // editing the person you just added is handy
  renderAll();
}

async function removeMember(id) {
  const member = state.members.find((m) => m.id === id);
  if (!confirm(`Remove ${member ? member.name : "this person"} and their days?`)) return;
  await store.removeMember(id);
  state.members = state.members.filter((m) => m.id !== id);
  for (const k of Object.keys(state.entries)) {
    if (k.startsWith(id + "|")) delete state.entries[k];
  }
  if (currentMemberId === id) currentMemberId = state.members[0]?.id || null;
  renderAll();
}

// ------------------------------------------------------------
//  CALENDAR
// ------------------------------------------------------------
function renderCalendar() {
  const title = document.getElementById("cal-title");
  const grid = document.getElementById("calendar");
  const monthName = new Date(view.year, view.month, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" });
  title.textContent = monthName;

  grid.innerHTML = "";
  const firstDay = new Date(view.year, view.month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const today = todayISO();

  // Leading blank cells so the 1st lands under the right weekday.
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "day blank";
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(view.year, view.month, d);
    const date = isoFromYMD(view.year, view.month, d);
    const cell = document.createElement("div");
    cell.className = "day";
    if (isWeekend(dateObj)) cell.classList.add("weekend");
    if (date < today) cell.classList.add("past");
    if (date === today) cell.classList.add("today");

    // Group info: who's busy/maybe that day (everyone).
    const t = tallyDate(date);

    // How the cell is tinted depends on the view mode.
    if (viewMode === "mine") {
      // Your own status tints the cell, so marking feels personal.
      const myEntry = currentMemberId ? entryFor(currentMemberId, date) : null;
      if (myEntry) cell.classList.add("mine-" + myEntry.status);
    } else if (t.total > 0) {
      // "Everyone" = a heat-map of how free the whole family is.
      if (t.free === t.total) cell.classList.add("group-allfree");
      else if (t.free === 0) cell.classList.add("group-none");
      else cell.classList.add("group-some");
    }

    // Top: date number + (if everyone free with a real family) a check.
    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = d;
    cell.appendChild(num);

    // Middle: little reason icons for anyone busy/maybe that day.
    if (t.busyPeople.length) {
      const icons = document.createElement("div");
      icons.className = "day-icons";
      t.busyPeople.slice(0, 4).forEach(({ member, entry }) => {
        const span = document.createElement("span");
        span.className = "rs " + entry.status;
        const r = REASON_BY_ID[entry.reason];
        span.textContent = r ? r.icon : (entry.status === "busy" ? "⛔" : "❔");
        span.title = `${member.name}: ${STATUS_LABEL[entry.status]}${r ? " — " + r.label : ""}`;
        icons.appendChild(span);
      });
      if (t.busyPeople.length > 4) {
        const more = document.createElement("span");
        more.className = "rs more";
        more.textContent = "+" + (t.busyPeople.length - 4);
        icons.appendChild(more);
      }
      cell.appendChild(icons);
    }

    // Bottom: free count. Always shown in "Everyone" mode; in "My
    // calendar" mode only when there's a conflict worth flagging.
    if (t.total > 0 && (viewMode === "everyone" || t.busy > 0 || t.maybe > 0)) {
      const foot = document.createElement("div");
      foot.className = "day-foot";
      foot.textContent = `${t.free}/${t.total} free`;
      cell.appendChild(foot);
    }

    cell.addEventListener("click", () => openEditor(date));
    grid.appendChild(cell);
  }
}

function changeMonth(delta) {
  view.month += delta;
  if (view.month < 0) { view.month = 11; view.year--; }
  if (view.month > 11) { view.month = 0; view.year++; }
  renderCalendar();
}

// ------------------------------------------------------------
//  DAY EDITOR (pop-up with dropdowns)
// ------------------------------------------------------------
function buildReasonOptions() {
  const sel = document.getElementById("editor-reason");
  sel.innerHTML = "";
  for (const r of REASONS) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = `${r.icon} ${r.label}`;
    sel.appendChild(opt);
  }
}

function openEditor(date) {
  if (!currentMemberId) {
    alert('First choose who you are (the "I am" dropdown), or add a person.');
    return;
  }
  editDate = date;
  const member = state.members.find((m) => m.id === currentMemberId);
  const dateObj = new Date(date + "T00:00:00");
  document.getElementById("editor-title").textContent =
    `${member.name} — ${prettyDate(dateObj)}`;

  const existing = entryFor(currentMemberId, date);
  const statusSel = document.getElementById("editor-status");
  const reasonSel = document.getElementById("editor-reason");
  statusSel.value = existing ? existing.status : "free";
  reasonSel.value = existing && existing.reason ? existing.reason : "work";

  // End-date field defaults to this same day (= single day). Pick a
  // later date to mark a whole trip in one go.
  const endInput = document.getElementById("editor-end");
  endInput.min = date;
  endInput.value = date;

  toggleReasonField();
  document.getElementById("editor-overlay").classList.remove("hidden");
}

function closeEditor() {
  document.getElementById("editor-overlay").classList.add("hidden");
  editDate = null;
}

// Reason only matters when you're not free.
function toggleReasonField() {
  const status = document.getElementById("editor-status").value;
  document.getElementById("reason-field").style.display =
    status === "free" ? "none" : "";
}

async function saveEditor() {
  if (!editDate || !currentMemberId) return closeEditor();
  const status = document.getElementById("editor-status").value;
  const reason = document.getElementById("editor-reason").value;
  const endDate = document.getElementById("editor-end").value || editDate;

  // Every day from the start through the (optional) end date.
  const dates = datesBetween(editDate, endDate);
  const member = currentMemberId;

  // Update the screen right away (feels instant), then save each day.
  for (const date of dates) {
    const key = `${member}|${date}`;
    if (status === "free") delete state.entries[key];
    else state.entries[key] = { status, reason };
  }
  renderCalendar();
  renderSummary();
  closeEditor();

  try {
    await Promise.all(
      dates.map((date) => store.setEntry(member, date, status, reason))
    );
  } catch (err) {
    console.error("Could not save:", err);
    alert("Hmm, that didn't save. Check your internet and try again.");
  }
}

// All ISO dates from start to end (inclusive). Capped for safety.
function datesBetween(startISO, endISO) {
  if (endISO < startISO) endISO = startISO;
  const out = [];
  const cur = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let i = 0; i < 366 && cur <= end; i++) {
    out.push(isoFromYMD(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ------------------------------------------------------------
//  BEST UPCOMING DAYS
// ------------------------------------------------------------
function renderSummary() {
  const container = document.getElementById("summary");
  if (state.members.length === 0) {
    container.innerHTML =
      '<p class="empty">Add the family below, then mark your busy days to see the best options.</p>';
    return;
  }

  const total = state.members.length;
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const scored = [];
  for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = isoFromYMD(d.getFullYear(), d.getMonth(), d.getDate());
    const t = tallyDate(date);
    scored.push({ date, dateObj: d, ...t, weekend: isWeekend(d) });
  }

  // Best = most free, then fewest busy, then fewest maybe. Soonest wins ties.
  scored.sort((a, b) => b.free - a.free || a.busy - b.busy || a.maybe - b.maybe);
  const top = scored.slice(0, 6);

  container.innerHTML = "";
  top.forEach((s, i) => {
    const allFree = s.free === total;
    const div = document.createElement("div");
    div.className = "summary-item" + (i === 0 ? " top" : "");
    div.innerHTML = `
      <span class="date">
        ${i === 0 ? "⭐ " : ""}${prettyDate(s.dateObj)}
        ${s.weekend ? '<span class="tag">weekend</span>' : ""}
      </span>
      <span class="tally">
        <strong>${s.free}/${total} free</strong>${s.maybe ? ` · ${s.maybe} maybe` : ""}${s.busy ? ` · ${s.busy} busy` : ""}
        ${allFree ? " 🎉 everyone!" : ""}
      </span>`;
    container.appendChild(div);
  });
}

// ------------------------------------------------------------
//  LEGEND
// ------------------------------------------------------------
function buildReasonLegend() {
  const box = document.getElementById("reason-legend");
  box.innerHTML = "";
  for (const r of REASONS) {
    const span = document.createElement("span");
    span.className = "legend-reason";
    span.innerHTML = `<span class="ic">${r.icon}</span> ${r.label}`;
    box.appendChild(span);
  }
}

// ------------------------------------------------------------
//  WIRING + helpers
// ------------------------------------------------------------
function wireUpControls() {
  document.getElementById("add-member-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("member-name");
    addMember(input.value);
    input.value = "";
    input.focus();
  });

  document.getElementById("current-member").addEventListener("change", (e) => {
    currentMemberId = e.target.value || null;
    renderCalendar();
  });

  document.getElementById("prev-month").addEventListener("click", () => changeMonth(-1));
  document.getElementById("next-month").addEventListener("click", () => changeMonth(1));

  // View toggle: "My calendar" vs "Everyone".
  document.querySelectorAll("#view-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.mode;
      document.querySelectorAll("#view-toggle button")
        .forEach((b) => b.classList.toggle("active", b === btn));
      document.getElementById("cal-hint").textContent =
        viewMode === "mine"
          ? 'Click any day to set your status. Default is "Free" until you mark otherwise.'
          : "Green = everyone free, amber = some free, red = no one free. Click a day to edit your own status.";
      renderCalendar();
    });
  });

  document.getElementById("editor-status").addEventListener("change", toggleReasonField);
  document.getElementById("editor-save").addEventListener("click", saveEditor);
  document.getElementById("editor-cancel").addEventListener("click", closeEditor);
  // Click the dark backdrop (but not the white modal) to close.
  document.getElementById("editor-overlay").addEventListener("click", (e) => {
    if (e.target.id === "editor-overlay") closeEditor();
  });
}

function setStorageStatus(text) {
  document.getElementById("storage-status").textContent = text;
}

// Go!
start();
