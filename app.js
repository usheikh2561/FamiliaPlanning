// ============================================================
//  FamiliaPlanning — app logic
//
//  Beginner-friendly notes are sprinkled throughout. The big idea:
//
//  1. We figure out the next several weekends.
//  2. Family members each mark Free / Maybe / Busy per weekend.
//  3. We tally the results and suggest the best weekends.
//
//  The app uses a free cloud database (Supabase) if you've filled
//  in config.js. If not, it falls back to "localStorage" — a little
//  storage box inside your own browser — so it works right away.
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, WEEKENDS_TO_SHOW } from "./config.js";

// The three states a person can pick, in the order tapping cycles through.
// "unknown" means not set yet (we don't store it; it's just the default).
const STATUS_CYCLE = ["unknown", "free", "maybe", "busy"];
const STATUS_LABEL = { unknown: "—", free: "Free", maybe: "Maybe", busy: "Busy" };

// ------------------------------------------------------------
//  STORAGE LAYER
//  Two interchangeable "stores" with the same functions, so the
//  rest of the app doesn't care where data lives.
// ------------------------------------------------------------

// ---- Store A: the browser (no setup needed) ----
const LocalStore = {
  key: "familiaplanning-data-v1",
  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || { members: [], availability: {} };
    } catch {
      return { members: [], availability: {} };
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
    // Also drop that person's answers.
    for (const k of Object.keys(data.availability)) {
      if (k.startsWith(id + "|")) delete data.availability[k];
    }
    this._write(data);
  },
  async setAvailability(memberId, weekend, status) {
    const data = this._read();
    const k = `${memberId}|${weekend}`;
    if (status === "unknown") delete data.availability[k];
    else data.availability[k] = status;
    this._write(data);
  },
};

// ---- Store B: Supabase cloud (shared with the family) ----
// We only build this if config.js has been filled in.
function makeSupabaseStore(client) {
  return {
    async load() {
      const [{ data: members }, { data: rows }] = await Promise.all([
        client.from("members").select("id, name").order("created_at"),
        client.from("availability").select("member_id, weekend, status"),
      ]);
      const availability = {};
      for (const r of rows || []) availability[`${r.member_id}|${r.weekend}`] = r.status;
      return { members: members || [], availability };
    },
    async addMember(name) {
      const { data, error } = await client
        .from("members")
        .insert({ name })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    async removeMember(id) {
      // Remove the person's answers first, then the person.
      await client.from("availability").delete().eq("member_id", id);
      await client.from("members").delete().eq("id", id);
    },
    async setAvailability(memberId, weekend, status) {
      if (status === "unknown") {
        await client.from("availability").delete().match({ member_id: memberId, weekend });
      } else {
        // "upsert" = insert, or update if this person already answered this weekend.
        await client
          .from("availability")
          .upsert({ member_id: memberId, weekend, status }, { onConflict: "member_id,weekend" });
      }
    },
  };
}

// Decide which store to use. If Supabase is configured, load its
// library from the internet and connect; otherwise use the browser.
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
//  WEEKENDS
//  Build a list of the next N weekends (Saturday + Sunday).
// ------------------------------------------------------------
function upcomingWeekends(count) {
  const weekends = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the coming Saturday (day 6). If today is Saturday, start today.
  const saturday = new Date(today);
  const daysUntilSat = (6 - today.getDay() + 7) % 7;
  saturday.setDate(today.getDate() + daysUntilSat);

  for (let i = 0; i < count; i++) {
    const sat = new Date(saturday);
    sat.setDate(saturday.getDate() + i * 7);
    const sun = new Date(sat);
    sun.setDate(sat.getDate() + 1);
    weekends.push({
      key: isoDate(sat), // a stable id like "2026-06-27"
      label: shortDate(sat) + " – " + shortDate(sun),
      sub: sat.getFullYear() === sun.getFullYear() ? String(sat.getFullYear()) : "",
    });
  }
  return weekends;
}

// Turn a Date into "2026-06-27" (used as a stable id).
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
// Turn a Date into "Sat, Jun 27" (used for display).
function shortDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// ------------------------------------------------------------
//  APP STATE + STARTUP
// ------------------------------------------------------------
let store;
let state = { members: [], availability: {} };
const WEEKENDS = upcomingWeekends(WEEKENDS_TO_SHOW);

async function start() {
  store = await chooseStore();
  state = await store.load();
  renderAll();
  wireUpForms();
}

// ------------------------------------------------------------
//  RENDERING (drawing the screen from the current state)
// ------------------------------------------------------------
function renderAll() {
  renderMembers();
  renderGrid();
  renderSummary();
}

function renderMembers() {
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

function renderGrid() {
  const head = document.getElementById("grid-head");
  const body = document.getElementById("grid-body");
  const emptyMsg = document.getElementById("grid-empty");
  const table = document.getElementById("grid");

  if (state.members.length === 0) {
    table.style.display = "none";
    emptyMsg.style.display = "block";
    return;
  }
  table.style.display = "";
  emptyMsg.style.display = "none";

  // Header row: "Weekend" then one column per person.
  head.innerHTML = "<th>Weekend</th>";
  for (const m of state.members) {
    const th = document.createElement("th");
    th.textContent = m.name;
    head.appendChild(th);
  }

  // One row per weekend.
  body.innerHTML = "";
  for (const w of WEEKENDS) {
    const tr = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.className = "weekend-cell";
    dateCell.innerHTML = `${w.label}${w.sub ? `<small>${w.sub}</small>` : ""}`;
    tr.appendChild(dateCell);

    for (const m of state.members) {
      const td = document.createElement("td");
      const status = state.availability[`${m.id}|${w.key}`] || "unknown";
      const btn = document.createElement("button");
      btn.className = "cell-btn " + status;
      btn.textContent = STATUS_LABEL[status];
      btn.addEventListener("click", () => cycleCell(m.id, w.key));
      td.appendChild(btn);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}

function renderSummary() {
  const container = document.getElementById("summary");

  if (state.members.length === 0) {
    container.innerHTML = '<p class="empty">Add some people and mark a few weekends to see suggestions.</p>';
    return;
  }

  // Score each weekend: count Free and Maybe and Busy.
  const scored = WEEKENDS.map((w) => {
    let free = 0, maybe = 0, busy = 0;
    for (const m of state.members) {
      const s = state.availability[`${m.id}|${w.key}`];
      if (s === "free") free++;
      else if (s === "maybe") maybe++;
      else if (s === "busy") busy++;
    }
    return { w, free, maybe, busy };
  });

  // Sort: most Free first; break ties with fewest Busy, then most Maybe.
  scored.sort((a, b) => b.free - a.free || a.busy - b.busy || b.maybe - a.maybe);

  // Only suggest weekends where at least one person said Free.
  const suggestions = scored.filter((s) => s.free > 0).slice(0, 3);

  if (suggestions.length === 0) {
    container.innerHTML = '<p class="empty">No one has marked a weekend as "Free" yet.</p>';
    return;
  }

  const total = state.members.length;
  container.innerHTML = "";
  suggestions.forEach((s, i) => {
    const allFree = s.free === total;
    const div = document.createElement("div");
    div.className = "summary-item" + (i === 0 ? " top" : "");
    div.innerHTML = `
      <span class="date">${i === 0 ? "⭐ " : ""}${s.w.label}</span>
      <span class="tally">
        <strong>${s.free}/${total} free</strong>${s.maybe ? ` · ${s.maybe} maybe` : ""}${s.busy ? ` · ${s.busy} busy` : ""}
        ${allFree ? " 🎉 everyone!" : ""}
      </span>`;
    container.appendChild(div);
  });
}

// ------------------------------------------------------------
//  ACTIONS (things that change data, then re-draw)
// ------------------------------------------------------------
async function addMember(name) {
  const clean = name.trim();
  if (!clean) return;
  const member = await store.addMember(clean);
  state.members.push(member);
  renderAll();
}

async function removeMember(id) {
  const member = state.members.find((m) => m.id === id);
  if (!confirm(`Remove ${member ? member.name : "this person"} and their answers?`)) return;
  await store.removeMember(id);
  state.members = state.members.filter((m) => m.id !== id);
  for (const k of Object.keys(state.availability)) {
    if (k.startsWith(id + "|")) delete state.availability[k];
  }
  renderAll();
}

async function cycleCell(memberId, weekend) {
  const k = `${memberId}|${weekend}`;
  const current = state.availability[k] || "unknown";
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];

  // Update the screen optimistically (feels instant), then save.
  if (next === "unknown") delete state.availability[k];
  else state.availability[k] = next;
  renderGrid();
  renderSummary();

  try {
    await store.setAvailability(memberId, weekend, next);
  } catch (err) {
    console.error("Could not save:", err);
    alert("Hmm, that didn't save. Check your internet and try again.");
  }
}

// ------------------------------------------------------------
//  WIRING + small helpers
// ------------------------------------------------------------
function wireUpForms() {
  const form = document.getElementById("add-member-form");
  const input = document.getElementById("member-name");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    addMember(input.value);
    input.value = "";
    input.focus();
  });
}

function setStorageStatus(text) {
  document.getElementById("storage-status").textContent = text;
}

// Go!
start();
