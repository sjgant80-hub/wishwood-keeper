// keeper.mjs — WISHWOOD KEEPER. The housekeeping brain for the four camps: jobs, issues, and off-grid supply
// logs in ONE place, so the urgent stuff is on a board — not lost in a WhatsApp thread. Sovereign: it lives in
// the browser (localStorage), works offline, no accounts, no server. Pure kernel; the UI is just a view of this.
//
// The one clever move: logging a low reading (heating oil, gas, water, solar, firewood) AUTO-RAISES an urgent
// supply job — so "the oil's low" becomes a visible task the moment it's noticed, instead of a message that
// scrolls away. Every urgent / overdue / low-supply thing is guaranteed to surface in attention(). Deterministic
// (timestamps are passed in, never read from the clock here), so the gate can prove it. Zero-dep, Node + browser.

// ── the four camps (+ the shared grounds) ──
export const UNITS = [
  { id: 'yurt', name: 'The Yurt' },
  { id: 'fern', name: 'Fern Lodge' },
  { id: 'caravan', name: 'Thistle Caravan' },
  { id: 'hobbit', name: 'The Hobbit' },
  { id: 'site', name: 'Grounds & shared' },
];
// off-grid consumables worth tracking — each with a LOW threshold that trips an alert + an auto supply-job.
export const METERS = [
  { id: 'gas', name: 'Gas canister', unit: 'canisters', low: 1 },
  { id: 'oil', name: 'Lamp oil', unit: 'bottles', low: 1 },
  { id: 'citronella', name: 'Citronella oil', unit: 'bottles', low: 1 },
  { id: 'logs', name: 'Firewood', unit: 'crates', low: 2 },
  { id: 'firestarters', name: 'Firestarters', unit: 'packs', low: 1 },
  { id: 'water', name: 'Water tank', unit: '%', low: 20 },
];
// the MAINTENANCE SCHEDULE — the standing turnover checks done in every camp between guests.
export const CHECKLIST = [
  'Bins emptied',
  'Lamp oil topped up',
  'Battery lamps checked & charged',
  'Firewood logs stocked',
  'Firestarters stocked',
  'Water check',
  'Shower barrel — water check',
  'Fireplace cleaned',
  'Furniture back to original',
  'Wi-Fi working',
];
export const CATEGORIES = ['maintenance', 'turnover / clean', 'supply', 'safety', 'grounds', 'issue / fault', 'guest'];
export const PRIORITIES = ['urgent', 'normal', 'low'];
const PRANK = { urgent: 0, normal: 1, low: 2 };
const unitOk = id => UNITS.some(u => u.id === id);
const meterOk = id => METERS.some(m => m.id === id);
const clampNum = (x, d = 0) => { const n = +x; return Number.isFinite(n) ? n : d; };
const str = (x, max = 400) => (x == null ? '' : String(x)).slice(0, max);

// `dev` is a short per-device id so two phones never mint the same task id (offline-first → conflict-free merge).
export function newState(dev = 'local') { return { v: 1, dev: String(dev), tasks: [], logs: [], checks: {}, seq: 1 }; }
export function setDevice(S, dev) { S.dev = String(dev || 'local'); return S; }
const live = t => t && !t.deleted;   // a tombstoned (deleted) task is kept for sync but hidden everywhere

// ── JOBS / ISSUES ──
// a task is a job, an issue, a turnover clean — anything to do. urgent + overdue float to the top.
export function addTask(S, { unit = 'site', title, note = '', priority = 'normal', category = 'maintenance', due = null, ts = 0, auto = null } = {}) {
  if (!title || !str(title).trim()) return { ok: false, why: 'a job needs a title' };
  const t = {
    id: 'j-' + (S.dev || 'local') + '-' + (S.seq++), unit: unitOk(unit) ? unit : 'site', title: str(title, 160).trim(), note: str(note),
    priority: PRIORITIES.includes(priority) ? priority : 'normal', category: CATEGORIES.includes(category) ? category : 'maintenance',
    due: due || null, status: 'open', created: clampNum(ts), done_at: null, auto: auto || null, updated: clampNum(ts), deleted: false,
  };
  S.tasks.push(t); return { ok: true, task: t };
}
export function completeTask(S, id, ts = 0) { const t = S.tasks.find(x => x.id === id); if (!live(t)) return { ok: false, why: 'no such job' }; t.status = 'done'; t.done_at = clampNum(ts); t.updated = clampNum(ts); return { ok: true, task: t }; }
export function reopenTask(S, id, ts = 0) { const t = S.tasks.find(x => x.id === id); if (!live(t)) return { ok: false, why: 'no such job' }; t.status = 'open'; t.done_at = null; t.updated = clampNum(ts); return { ok: true, task: t }; }
export function deleteTask(S, id, ts = 0) { const t = S.tasks.find(x => x.id === id); if (!t) return { ok: false, why: 'no such job' }; t.deleted = true; t.updated = clampNum(ts); return { ok: true, task: t }; }   // tombstone, so the delete syncs
export function setPriority(S, id, priority, ts = 0) { const t = S.tasks.find(x => x.id === id); if (!live(t) || !PRIORITIES.includes(priority)) return { ok: false }; t.priority = priority; t.updated = clampNum(ts); return { ok: true, task: t }; }

// open jobs for a unit, urgent → normal → low, then oldest-first within a band.
export function openFor(S, unitId) { return S.tasks.filter(t => live(t) && t.status === 'open' && t.unit === unitId).sort(sortJobs); }
function sortJobs(a, b) { return (PRANK[a.priority] - PRANK[b.priority]) || (a.created - b.created) || a.id.localeCompare(b.id); }
const isOverdue = (t, now) => live(t) && t.status === 'open' && t.due != null && clampNum(t.due) < now;

// ── SUPPLY LOGS ──
// record a reading. If it's at/below the meter's LOW line, auto-raise an urgent SUPPLY job (deduped: one open
// auto-job per unit+meter) — so a noticed shortage becomes a task on the board, not a message that scrolls away.
export function logReading(S, { unit = 'site', meter, value, ts = 0, note = '' } = {}) {
  if (!meterOk(meter)) return { ok: false, why: 'unknown supply' };
  const m = METERS.find(x => x.id === meter), v = clampNum(value);
  const entry = { id: 'r-' + (S.dev || 'local') + '-' + (S.seq++), unit: unitOk(unit) ? unit : 'site', meter, value: v, ts: clampNum(ts), note: str(note) };
  S.logs.push(entry);
  let raised = null;
  const low = v <= m.low;
  if (low) {
    const key = `supply:${entry.unit}:${meter}`;
    const already = S.tasks.some(t => live(t) && t.status === 'open' && t.auto === key);
    if (!already) raised = addTask(S, { unit: entry.unit, title: `${m.name} low (${v} ${m.unit}) — reorder / top up`, priority: 'urgent', category: 'supply', ts, auto: key }).task;
  }
  return { ok: true, entry, low, raised };
}
export function latestReading(S, unitId, meter) { const rs = S.logs.filter(r => r.unit === unitId && r.meter === meter); return rs.length ? rs[rs.length - 1] : null; }
export function readingHistory(S, unitId, meter) { return S.logs.filter(r => r.unit === unitId && r.meter === meter).sort((a, b) => a.ts - b.ts); }

// current low supplies across everything (latest reading per unit+meter that sits at/below its low line).
export function lowSupplies(S) {
  const out = [];
  for (const u of UNITS) for (const m of METERS) { const r = latestReading(S, u.id, m.id); if (r && r.value <= m.low) out.push({ unit: u.id, unitName: u.name, meter: m.id, meterName: m.name, value: r.value, unitLabel: m.unit, low: m.low }); }
  return out;
}

// ── THE POINT: everything that needs attention, in one list, nothing lost ──
// every urgent open job + every overdue job + every low supply — sorted so the most pressing is first.
export function attention(S, now = 0) {
  const jobs = S.tasks.filter(t => live(t) && t.status === 'open' && (t.priority === 'urgent' || isOverdue(t, now)))
    .map(t => ({ kind: isOverdue(t, now) ? 'overdue' : 'urgent', id: t.id, unit: t.unit, title: t.title, priority: t.priority, due: t.due, created: t.created }));
  const supplies = lowSupplies(S).map(s => ({ kind: 'low-supply', unit: s.unit, title: `${s.meterName} low — ${s.value} ${s.unitLabel}`, meter: s.meter }));
  return [...jobs, ...supplies].sort((a, b) => rank(a) - rank(b) || (a.created || 0) - (b.created || 0));
}
const rank = x => x.kind === 'overdue' ? 0 : x.kind === 'low-supply' ? 1 : 2;

export function stats(S, now = 0) {
  const open = S.tasks.filter(t => live(t) && t.status === 'open');
  const byUnit = Object.fromEntries(UNITS.map(u => [u.id, open.filter(t => t.unit === u.id).length]));
  return { open: open.length, urgent: open.filter(t => t.priority === 'urgent').length, overdue: open.filter(t => isOverdue(t, now)).length, done: S.tasks.filter(t => live(t) && t.status === 'done').length, low: lowSupplies(S).length, byUnit };
}
export const doneTasks = S => S.tasks.filter(t => live(t) && t.status === 'done');

// ── THE MAINTENANCE SCHEDULE — a per-camp turnover checklist. Tick items as you do them; "new turnover" resets
//    the camp's list fresh for the next guest. (Ticks are the CURRENT turnover; the record is the reset.) ──
// each tick is stored as { t: when, v: 0|1 } so a tick OR an untick both carry a timestamp and can be merged
// (newest wins) — un-ticking is not a delete, it's v:0, so it propagates across phones too.
const ckey = (unit, i) => `${unit}:${i}`;
const ckDone = c => !!(c && (typeof c === 'object' ? c.v : c));   // tolerate the old plain-number form on import
export function checklistFor(S, unitId) { const u = unitOk(unitId) ? unitId : 'site'; return CHECKLIST.map((item, i) => ({ i, item, done: ckDone(S.checks[ckey(u, i)]) })); }
export function toggleCheck(S, unitId, i, ts = 0) { const u = unitOk(unitId) ? unitId : 'site'; if (i < 0 || i >= CHECKLIST.length) return { ok: false }; const k = ckey(u, i); S.checks[k] = { t: clampNum(ts), v: ckDone(S.checks[k]) ? 0 : 1 }; return { ok: true, done: !!S.checks[k].v }; }
export function resetTurnover(S, unitId, ts = 0) { const u = unitOk(unitId) ? unitId : 'site'; for (let i = 0; i < CHECKLIST.length; i++) S.checks[ckey(u, i)] = { t: clampNum(ts), v: 0 }; return { ok: true }; }
export function turnoverProgress(S, unitId) { const u = unitOk(unitId) ? unitId : 'site'; let done = 0; for (let i = 0; i < CHECKLIST.length; i++) if (ckDone(S.checks[ckey(u, i)])) done++; return { done, total: CHECKLIST.length }; }

// ── SYNC — a conflict-free MERGE of two boards. Order-independent, idempotent, safe to run any time. Because ids
//    are device-prefixed, no two phones ever mint the same task; merge is a union with last-write-wins per record
//    (a delete is a tombstone that also wins by time), so no edit is ever clobbered by a stale copy. ──
const cval = c => (typeof c === 'object' && c) ? c : { t: c ? 1 : 0, v: c ? 1 : 0 };
export function merge(a, b) {
  a = a || newState(); b = b || newState();
  const byId = new Map();
  for (const t of [...(a.tasks || []), ...(b.tasks || [])]) { const p = byId.get(t.id); if (!p || (t.updated || 0) > (p.updated || 0) || ((t.updated || 0) === (p.updated || 0) && JSON.stringify(t) > JSON.stringify(p))) byId.set(t.id, t); }
  const logs = new Map(); for (const r of [...(a.logs || []), ...(b.logs || [])]) if (!logs.has(r.id)) logs.set(r.id, r);
  const checks = {}; for (const src of [a.checks || {}, b.checks || {}]) for (const k of Object.keys(src)) { const nv = cval(src[k]), cur = checks[k]; if (!cur || nv.t > cur.t) checks[k] = nv; }
  return { v: 1, dev: a.dev || b.dev || 'local', tasks: [...byId.values()].sort((x, y) => x.id.localeCompare(y.id)), logs: [...logs.values()].sort((x, y) => x.id.localeCompare(y.id)), checks, seq: Math.max(a.seq || 1, b.seq || 1) };
}
// a cheap content hash of the shareable board — so the sync loop only pushes when something actually changed.
export function stateHash(S) { const core = { tasks: (S.tasks || []).map(t => [t.id, t.updated, t.deleted]).sort(), logs: (S.logs || []).map(r => r.id).sort(), checks: Object.entries(S.checks || {}).map(([k, c]) => [k, cval(c).t, cval(c).v]).sort() }; const s = JSON.stringify(core); let h = 0x811c9dc5 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; return (h >>> 0).toString(16); }

// ── SOVEREIGN BACKUP — export / import the whole board as portable JSON (yours to keep, no server) ──
export function exportState(S) { return JSON.stringify({ v: 1, dev: S.dev || 'local', tasks: S.tasks, logs: S.logs, checks: S.checks || {}, seq: S.seq }); }
export function importState(json) { try { const o = typeof json === 'string' ? JSON.parse(json) : json; if (!o || !Array.isArray(o.tasks) || !Array.isArray(o.logs)) return null; return { v: 1, dev: o.dev || 'local', tasks: o.tasks, logs: o.logs, checks: (o.checks && typeof o.checks === 'object') ? o.checks : {}, seq: clampNum(o.seq, 1) || 1 }; } catch { return null; } }

export default { UNITS, METERS, CHECKLIST, CATEGORIES, PRIORITIES, newState, setDevice, addTask, completeTask, reopenTask, deleteTask, setPriority, openFor, logReading, latestReading, readingHistory, lowSupplies, attention, stats, doneTasks, checklistFor, toggleCheck, resetTurnover, turnoverProgress, merge, stateHash, exportState, importState };
