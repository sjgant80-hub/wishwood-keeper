// test.mjs — PROOF-OF-PLAY for WISHWOOD KEEPER. Zero tokens. Proves the housekeeping board does what a WhatsApp
// thread can't: urgent jobs surface, a noticed low supply becomes a task automatically (deduped), NOTHING that
// needs attention is ever hidden, and the whole board is portable (export/import round-trips). Deterministic.
import K from './keeper.mjs';
const { newState, setDevice, addTask, completeTask, reopenTask, deleteTask, openFor, logReading, latestReading, lowSupplies, attention, stats, merge, stateHash, exportState, importState, UNITS, METERS } = K;

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

console.log('\n=== §1 · JOBS PER CAMP — add a job, it lands on the right unit, urgent floats to the top ===');
{
  const S = newState();
  addTask(S, { unit: 'yurt', title: 'Replace gas mantle', priority: 'normal', ts: 1 });
  addTask(S, { unit: 'yurt', title: 'Wasps nest by the door', priority: 'urgent', category: 'safety', ts: 2 });
  addTask(S, { unit: 'fern', title: 'Turnover clean', category: 'turnover / clean', ts: 3 });
  const yurt = openFor(S, 'yurt');
  ok(yurt.length === 2 && yurt[0].title.startsWith('Wasps'), 'the urgent job sorts above the normal one on The Yurt');
  ok(openFor(S, 'fern').length === 1 && openFor(S, 'caravan').length === 0, 'jobs land on the right camp only');
  ok(!addTask(S, { unit: 'yurt', title: '   ' }).ok, 'a job with no title is refused (no empty noise)');
}

console.log('\n=== §2 · LIFECYCLE — done, reopen, delete, and the counts stay honest ===');
{
  const S = newState();
  const a = addTask(S, { unit: 'hobbit', title: 'Fix step', ts: 1 }).task;
  addTask(S, { unit: 'hobbit', title: 'Sweep flue', priority: 'urgent', ts: 2 });
  ok(stats(S).open === 2 && stats(S).urgent === 1, 'two open, one urgent');
  completeTask(S, a.id, 10);
  ok(stats(S).open === 1 && stats(S).done === 1, 'completing a job moves it to done (still on the record, not deleted)');
  reopenTask(S, a.id); ok(stats(S).open === 2, 'a job can be reopened');
  deleteTask(S, a.id); ok(stats(S).open === 1 && !openFor(S, 'hobbit').some(t => t.id === a.id), 'a job can be removed — gone from every view (a tombstone stays, so the delete syncs)');
}

console.log('\n=== §3 · THE MAGIC — a low supply reading AUTO-RAISES an urgent job (deduped) ===');
{
  const S = newState();
  const r1 = logReading(S, { unit: 'yurt', meter: 'oil', value: 0.5, ts: 1 });   // ½ bottle ≤ 1-bottle low line
  ok(r1.low && r1.raised && r1.raised.priority === 'urgent' && r1.raised.category === 'supply', 'logging lamp oil at ½ bottle auto-raises an URGENT supply job for The Yurt — the shortage becomes a task, not a lost message');
  const r2 = logReading(S, { unit: 'yurt', meter: 'oil', value: 0.3, ts: 2 });   // still low, job already open
  ok(r2.low && !r2.raised && stats(S).urgent === 1, 'a second low reading does NOT pile up a duplicate job (one open per unit+supply)');
  const r3 = logReading(S, { unit: 'fern', meter: 'logs', value: 5, ts: 3 });    // above the low line
  ok(!r3.low && !r3.raised, 'a healthy reading raises nothing');
  ok(latestReading(S, 'yurt', 'oil').value === 0.3, 'the latest lamp-oil reading is remembered (a real log over time)');
  // once the supply job is cleared, a fresh low reading can raise again
  const job = S.tasks.find(t => t.auto === 'supply:yurt:oil'); completeTask(S, job.id, 20);
  const r4 = logReading(S, { unit: 'yurt', meter: 'oil', value: 0.4, ts: 21 });
  ok(r4.raised, 'after the job is done, a new low reading raises a fresh one — the loop stays live');
}

console.log('\n=== §4 · NOTHING GETS LOST — every urgent, overdue and low-supply thing surfaces in one list ===');
{
  const S = newState(); const NOW = 100;
  addTask(S, { unit: 'yurt', title: 'Guest arriving 4pm — light the burner', priority: 'urgent', ts: 1 });
  addTask(S, { unit: 'fern', title: 'Compost loo overdue', priority: 'normal', due: 50, ts: 2 });   // due < now → overdue
  addTask(S, { unit: 'caravan', title: 'Repaint trim (someday)', priority: 'low', ts: 3 });          // not pressing
  logReading(S, { unit: 'hobbit', meter: 'gas', value: 1, ts: 4 });                                   // 1 canister ≤ low → auto urgent + a low-supply flag
  const att = attention(S, NOW);
  ok(att.some(a => a.kind === 'urgent' && /light the burner/.test(a.title)), 'the urgent guest job is in the attention list');
  ok(att.some(a => a.kind === 'overdue'), 'the overdue compost-loo job is surfaced (past its due time)');
  ok(att.some(a => a.kind === 'low-supply' && a.meter === 'gas'), 'the low gas bottle is surfaced');
  ok(!att.some(a => /someday/.test(a.title)), 'the low-priority "someday" job stays OUT of the attention list — signal, not noise');
  ok(att[0].kind === 'overdue', 'overdue sorts first — the most pressing thing is at the top');
}

console.log('\n=== §5 · SOVEREIGN BACKUP — export and re-import the whole board exactly ===');
{
  const S = newState();
  addTask(S, { unit: 'yurt', title: 'Job A', ts: 1 }); addTask(S, { unit: 'fern', title: 'Job B', priority: 'urgent', ts: 2 });
  logReading(S, { unit: 'yurt', meter: 'water', value: 10, ts: 3 });
  K.toggleCheck(S, 'yurt', 0, 5);   // tick a turnover item — it must survive a backup too
  const back = importState(exportState(S));
  ok(back && back.tasks.length === S.tasks.length && back.logs.length === S.logs.length && K.turnoverProgress(back, 'yurt').done === 1, 'export → import restores every job, reading AND checklist tick (your data, portable, no server)');
  ok(exportState(back) === exportState(S), 'the round-trip is exact — a real backup');
  ok(importState('garbage{{') === null && importState('{"nope":1}') === null, 'a corrupt/foreign file is rejected safely, not half-loaded');
}

console.log('\n=== §7 · THE MAINTENANCE SCHEDULE — a per-camp turnover checklist you tick off ===');
{
  const S = newState();
  ok(K.checklistFor(S, 'yurt').length === K.CHECKLIST.length && K.checklistFor(S, 'yurt').every(c => !c.done), 'every camp starts with a full, unticked turnover checklist');
  K.toggleCheck(S, 'yurt', 0, 1); K.toggleCheck(S, 'yurt', 3, 2);
  ok(K.turnoverProgress(S, 'yurt').done === 2, 'ticking items updates progress (2 of ' + K.CHECKLIST.length + ' done)');
  ok(K.checklistFor(S, 'fern').every(c => !c.done), 'each camp has its OWN checklist — ticking The Yurt does not touch Fern Lodge');
  K.toggleCheck(S, 'yurt', 0, 3);   // untick
  ok(K.turnoverProgress(S, 'yurt').done === 1, 'a tick can be undone');
  K.resetTurnover(S, 'yurt');
  ok(K.turnoverProgress(S, 'yurt').done === 0, 'a "new turnover" wipes the camp\'s ticks fresh for the next guest');
}

console.log('\n=== §6 · DETERMINISM + FUZZ ===');
{
  const build = () => { const S = newState(); addTask(S, { unit: 'yurt', title: 'X', priority: 'urgent', ts: 1 }); logReading(S, { unit: 'yurt', meter: 'oil', value: 5, ts: 2 }); return exportState(S); };
  ok(build() === build(), 'the same actions produce the exact same board (deterministic — no clock reads inside)');
  let threw = false;
  try { const S = newState(); addTask(S, {}); addTask(S, { unit: 'nowhere', title: 'ok', priority: 'bogus', category: 'nope' }); completeTask(S, 'missing'); logReading(S, { meter: 'unobtainium', value: NaN }); logReading(S, { unit: 'yurt', meter: 'oil', value: 'lots' }); attention(S); stats(S); openFor(S, 'ghost'); }
  catch { threw = true; }
  ok(!threw, 'bad units / bad supplies / missing ids / junk values never throw');
  const S = newState(); const r = addTask(S, { unit: 'nowhere', title: 'Fallback', priority: 'bogus', category: 'nope', ts: 1 }).task;
  ok(r.unit === 'site' && r.priority === 'normal', 'an unknown unit/priority falls back to sensible defaults instead of breaking');
}

console.log('\n=== §8 · SYNC — two phones edit at once, and the merge keeps BOTH (nothing clobbered) ===');
{
  // two devices start from the same board, then edit OFFLINE, independently.
  const base = newState('A'); addTask(base, { unit: 'yurt', title: 'Shared job', ts: 1 });
  const A = importState(exportState(base)); setDevice(A, 'A');
  const B = importState(exportState(base)); setDevice(B, 'B');
  const jaA = addTask(A, { unit: 'fern', title: 'A adds: fix tap', ts: 10 }).task;
  const jbB = addTask(B, { unit: 'hobbit', title: 'B adds: sweep flue', priority: 'urgent', ts: 11 }).task;
  ok(jaA.id !== jbB.id && jaA.id.includes('-A-') && jbB.id.includes('-B-'), 'each phone mints device-unique ids — no collision is even possible');
  const m = merge(A, B);
  ok(m.tasks.filter(t => !t.deleted).length === 3, 'the merge keeps ALL THREE jobs — neither phone\'s new job is lost');
  ok(openFor(m, 'fern').some(t => /fix tap/.test(t.title)) && openFor(m, 'hobbit').some(t => /sweep flue/.test(t.title)), 'both phones\' jobs land on the right camps after the merge');

  // ORDER-INDEPENDENT + IDEMPOTENT
  ok(stateHash(merge(A, B)) === stateHash(merge(B, A)), 'merge is order-independent — A⊕B and B⊕A give the same board');
  ok(stateHash(merge(m, m)) === stateHash(m), 'merge is idempotent — syncing twice changes nothing');

  // LAST-WRITE-WINS on the SAME record: B completes the shared job later than A touches it → B wins
  const A2 = importState(exportState(m)), B2 = importState(exportState(m)); setDevice(A2, 'A'); setDevice(B2, 'B');
  const shared = m.tasks.find(t => t.title === 'Shared job').id;
  completeTask(A2, shared, 20); completeTask(B2, shared, 30);            // B later
  const done1 = merge(A2, B2).tasks.find(t => t.id === shared);
  ok(done1.status === 'done' && done1.done_at === 30, 'when both edit the same job, the newer change wins (last-write-wins, by time)');

  // a DELETE on one phone propagates (tombstone wins), even against an older copy that still has the job
  deleteTask(A2, jaA.id, 40);
  const afterDel = merge(B2, A2);   // B2 still has jaA as live; A2 deleted it later
  ok(!openFor(afterDel, 'fern').some(t => t.id === jaA.id), 'a delete on one phone removes the job everywhere after sync (tombstone, newest wins)');

  // a checklist tick from each phone both survive
  K.toggleCheck(A2, 'yurt', 0, 50); K.toggleCheck(B2, 'yurt', 2, 51);
  const mc = merge(A2, B2);
  ok(K.turnoverProgress(mc, 'yurt').done === 2, 'a checklist tick from each phone both survive the merge');
}

console.log('\n=== §9 · REPO STORE — the board round-trips through GitHub-style base64 (UTF-8 safe) ===');
{
  const S = newState('A'); addTask(S, { unit: 'yurt', title: 'Café £5 · résumé · 🔥 wasps', note: 'ünïcode', ts: 1 });
  const enc = K.b64EncodeUtf8(exportState(S));
  const round = importState(K.b64DecodeUtf8(enc));
  ok(round && openFor(round, 'yurt')[0].title.includes('£5') && openFor(round, 'yurt')[0].title.includes('🔥'), 'the board survives base64 encode→decode with £, accents and emoji intact (what gets committed to the repo)');
  ok(stateHash(round) === stateHash(S), 'and it is byte-for-byte the same board after the repo round-trip');
}

console.log('\n=== §H · GATE HARDENING — boundary + branch kills the happy-path tests fly past ===');
{
  // — logReading exactly ON the low line (line 83 `v <= m.low`) —
  const S = newState();
  const g = logReading(S, { unit: 'yurt', meter: 'gas', value: 1, ts: 1 });   // gas low = 1, value = 1 (equal)
  ok(g.low === true && g.raised && g.raised.priority === 'urgent', 'a reading EXACTLY on the low line still trips low + raises (≤, not <)');

  // — logReading picks the RIGHT meter by id (line 79 `x.id === meter`) —
  const S2 = newState();
  ok(logReading(S2, { unit: 'yurt', meter: 'water', value: 15, ts: 1 }).low === true, 'a reading uses ITS OWN meter threshold (water low=20, so 15 is low) — not a neighbouring meter’s');

  // — logReading entry id carries the device prefix (line 80 `S.dev || ‘local’`) —
  const S3 = newState(); setDevice(S3, 'A');
  ok(logReading(S3, { unit: 'yurt', meter: 'oil', value: 5, ts: 1 }).entry.id.startsWith('r-A-'), 'a supply-log id carries the device prefix (offline-unique ids)');

  // — latestReading matches unit AND meter (line 91 `&&`) —
  const S4 = newState();
  logReading(S4, { unit: 'yurt', meter: 'oil', value: 5, ts: 1 });
  logReading(S4, { unit: 'fern', meter: 'oil', value: 9, ts: 2 });
  ok(latestReading(S4, 'yurt', 'oil').value === 5, 'latestReading matches BOTH unit AND meter, never either');

  // — readingHistory: only matching rows, oldest-first (line 92 both `===` and `&&`) —
  const S5 = newState();
  logReading(S5, { unit: 'yurt', meter: 'oil', value: 5, ts: 1 });
  logReading(S5, { unit: 'yurt', meter: 'oil', value: 5, ts: 2 });
  logReading(S5, { unit: 'yurt', meter: 'gas', value: 5, ts: 3 });   // same unit, other meter
  logReading(S5, { unit: 'fern', meter: 'oil', value: 5, ts: 4 });   // other unit, same meter
  const hist = K.readingHistory(S5, 'yurt', 'oil');
  ok(hist.length === 2 && hist.every(r => r.unit === 'yurt' && r.meter === 'oil') && hist[0].ts === 1 && hist[1].ts === 2, 'readingHistory returns only the yurt/oil rows, oldest-first — not the fern or gas rows');
}
{
  // — setPriority hits the RIGHT task by id, and rejects a bad priority (line 67 `===` and `||`) —
  const S = newState();
  const a = addTask(S, { unit: 'yurt', title: 'first', ts: 1 }).task;
  const b = addTask(S, { unit: 'yurt', title: 'second', ts: 2 }).task;
  ok(K.setPriority(S, b.id, 'urgent', 3).ok && b.priority === 'urgent' && a.priority === 'normal', 'setPriority changes the addressed job only, matched by id');
  ok(!K.setPriority(S, a.id, 'bogus', 4).ok, 'setPriority refuses an invalid priority (guard is OR, not AND)');

  // — importState drops a non-object `checks` to {} (line 150 `o.checks && typeof … === ‘object’`) —
  const bad = importState('{"tasks":[],"logs":[],"checks":"nope"}');
  ok(bad && typeof bad.checks === 'object' && !Array.isArray(bad.checks) && Object.keys(bad.checks).length === 0, 'importState coerces a non-object checks field to {} (guard is AND, not OR)');
}
{
  // — stats.byUnit counts each unit (line 113 `t.unit === u.id`) —
  const S = newState();
  addTask(S, { unit: 'yurt', title: 'a', ts: 1 }); addTask(S, { unit: 'yurt', title: 'b', ts: 2 }); addTask(S, { unit: 'fern', title: 'c', ts: 3 });
  const by = stats(S, 0).byUnit;
  ok(by.yurt === 2 && by.fern === 1 && by.caravan === 0, 'stats.byUnit counts open jobs per camp (matched to the RIGHT unit)');

  // — stats.urgent counts urgents, not the rest (line 114 `priority === ‘urgent’`) —
  const S2 = newState();
  addTask(S2, { unit: 'yurt', title: 'u1', priority: 'urgent', ts: 1 });
  addTask(S2, { unit: 'yurt', title: 'u2', priority: 'urgent', ts: 2 });
  addTask(S2, { unit: 'yurt', title: 'n1', priority: 'normal', ts: 3 });   // 2 urgent, 1 not — so the count can’t coincide
  ok(stats(S2, 0).urgent === 2, 'stats.urgent counts the urgent jobs (2), not the non-urgent ones');

  // — stats.done counts DONE jobs (line 114 `status === ‘done’`) — 2 done vs 1 open so the count can’t coincide —
  const Sd = newState();
  const d1 = addTask(Sd, { unit: 'yurt', title: 'd1', ts: 1 }).task;
  const d2 = addTask(Sd, { unit: 'yurt', title: 'd2', ts: 2 }).task;
  addTask(Sd, { unit: 'yurt', title: 'still open', ts: 3 });
  completeTask(Sd, d1.id, 4); completeTask(Sd, d2.id, 5);
  ok(stats(Sd, 0).done === 2, 'stats.done counts the done jobs (2), not the open one');

  // — doneTasks returns only live, done jobs (line 116 `&&` and `=== ‘done’`) —
  const S3 = newState();
  const t2 = addTask(S3, { unit: 'yurt', title: 'done', ts: 2 }).task;
  const t3 = addTask(S3, { unit: 'yurt', title: 'del', ts: 3 }).task;
  addTask(S3, { unit: 'yurt', title: 'open', ts: 1 });                      // stays open + live
  completeTask(S3, t2.id, 4);
  completeTask(S3, t3.id, 5); deleteTask(S3, t3.id, 6);                     // done AND tombstoned
  const dt = K.doneTasks(S3);
  ok(dt.length === 1 && dt[0].id === t2.id, 'doneTasks returns only the live, done job — not the open one, not the deleted one');
}
{
  // — a job due EXACTLY at now is not yet overdue (line 72 `due < now`) —
  const S = newState();
  addTask(S, { unit: 'yurt', title: 'due now', due: 100, ts: 1 });
  ok(stats(S, 100).overdue === 0, 'a job due exactly at now is NOT overdue (strict <)');
  addTask(S, { unit: 'yurt', title: 'past due', due: 99, ts: 1 });
  ok(stats(S, 100).overdue === 1, 'a job due before now IS overdue');
}
{
  // — toggleCheck rejects out-of-range indices (line 125 `i >= len` and the `||` guard) —
  const S = newState();
  ok(K.toggleCheck(S, 'yurt', K.CHECKLIST.length, 1).ok === false, 'toggleCheck rejects an index at/above the checklist length');
  ok(K.toggleCheck(S, 'yurt', -1, 1).ok === false, 'toggleCheck rejects a negative index');

  // — resetTurnover writes exactly one key per item, none out of range (line 126 `i < len`) —
  const S2 = newState(); K.resetTurnover(S2, 'yurt', 1);
  ok(Object.keys(S2.checks).length === K.CHECKLIST.length, 'resetTurnover writes exactly one entry per checklist item (no out-of-range key)');

  // — turnoverProgress counts only real items, ignoring a stray imported key (line 127 `i < len`) —
  const S3 = importState(JSON.stringify({ tasks: [], logs: [], checks: { 'yurt:0': { t: 1, v: 1 }, 'yurt:10': { t: 1, v: 1 } } }));
  ok(K.turnoverProgress(S3, 'yurt').done === 1, 'turnoverProgress counts only real checklist items — an out-of-range yurt:10 key is ignored');
}
{
  // — attention ranks low-supply above a plain urgent (line 109 `kind === ‘low-supply’`) —
  const S = newState();
  logReading(S, { unit: 'yurt', meter: 'gas', value: 1, ts: 5 });   // low → auto-urgent job + a low-supply flag
  ok(attention(S, 0)[0].kind === 'low-supply', 'in the attention list a low-supply ranks above a plain urgent job');

  // — the created tiebreak in attention holds for BOTH insertion orders (line 107 both `created || 0`) —
  const rev = newState();
  addTask(rev, { unit: 'yurt', title: 'later', priority: 'urgent', ts: 5 });
  addTask(rev, { unit: 'yurt', title: 'earlier', priority: 'urgent', ts: 3 });
  const ra = attention(rev, 0).filter(x => x.kind === 'urgent').map(x => x.created);
  ok(ra[0] === 3 && ra[1] === 5, 'two same-rank urgents sort oldest-first even when added newest-first');
  const fwd = newState();
  addTask(fwd, { unit: 'yurt', title: 'earlier', priority: 'urgent', ts: 3 });
  addTask(fwd, { unit: 'yurt', title: 'later', priority: 'urgent', ts: 5 });
  const fa = attention(fwd, 0).filter(x => x.kind === 'urgent').map(x => x.created);
  ok(fa[0] === 3 && fa[1] === 5, 'two same-rank urgents sort oldest-first when added oldest-first too (both tiebreak operands pinned)');
}
{
  // — openFor tiebreaks: oldest-first within a band, then by id (line 71 both `||`) —
  const S = newState();
  addTask(S, { unit: 'fern', title: 'later', priority: 'urgent', ts: 5 });
  addTask(S, { unit: 'fern', title: 'earlier', priority: 'urgent', ts: 3 });
  const of = openFor(S, 'fern');
  ok(of[0].created === 3 && of[1].created === 5, 'within a priority band openFor is oldest-first (created tiebreak)');

  const S2 = newState();
  addTask(S2, { unit: 'yurt', title: 'A', priority: 'urgent', ts: 5 });
  addTask(S2, { unit: 'yurt', title: 'B', priority: 'urgent', ts: 5 });   // same priority AND created
  S2.tasks.reverse();                                                     // array order now disagrees with id order
  const of2 = openFor(S2, 'yurt');
  ok(of2[0].id.endsWith('-1') && of2[1].id.endsWith('-2'), 'a full tie (priority+created) resolves by id, not by array order');
}
{
  // — merge is last-write-wins by TIME, not by JSON size (line 136 `===` and `&&`) —
  const a = newState(); a.tasks = [{ id: 'x', title: 'aaa', updated: 20 }];   // newer, smaller JSON
  const b = newState(); b.tasks = [{ id: 'x', title: 'zzz', updated: 10 }];   // older, larger JSON
  const rec = merge(a, b).tasks.find(t => t.id === 'x');
  ok(rec.updated === 20 && rec.title === 'aaa', 'merge keeps the NEWEST write even when the older record has a larger JSON (LWW by time)');

  // — a timestamp tie resolves to the SAME record regardless of merge order (line 136 first `>`).
  //   Compare the winning title directly — stateHash omits title, so it can't see this flip. —
  const c = newState(); c.tasks = [{ id: 'y', title: 'aaa', updated: 5 }];
  const d = newState(); d.tasks = [{ id: 'y', title: 'zzz', updated: 5 }];
  ok(merge(c, d).tasks[0].title === merge(d, c).tasks[0].title, 'a same-timestamp task tie resolves to the same record in A⊕B and B⊕A (order-independent)');

  // — a checklist tie keeps the first board deterministically (line 138 `nv.t > cur.t`) —
  const e = newState(); e.checks = { 'yurt:0': { t: 5, v: 1 } };
  const f = newState(); f.checks = { 'yurt:0': { t: 5, v: 0 } };
  ok(K.turnoverProgress(merge(e, f), 'yurt').done === 1, 'on a same-timestamp checklist tie the first board wins — no silent flip on merge');
}
{
  // — stateHash is pinned to a FIXED vector: locks the FNV loop bound (line 142) and cval’s
  //   object/number handling (line 132 `===` and `&&`) against any single-operator drift —
  const H = newState('A');
  addTask(H, { unit: 'yurt', title: 'Hash me', priority: 'urgent', ts: 7 });
  logReading(H, { unit: 'fern', meter: 'gas', value: 5, ts: 9 });   // healthy, raises nothing
  H.checks = { 'yurt:0': { t: 7, v: 1 }, 'fern:2': 3 };             // object-form + legacy numeric-form
  ok(stateHash(H) === 'd476965d', 'stateHash matches its fixed vector — the hash loop and cval normalisation are locked');
}


console.log('\n=== §9 · SYNC INTEGRITY — merge/export/import preserve logs, device id & seq (kills silent data-loss) ===');
{
  // merge must keep BOTH boards' supply-log readings. Auditor-found: a.logs||[] -> && drops one camp's logs on sync.
  const A = newState('A'); logReading(A, { unit: 'yurt', meter: 'oil', value: 5, ts: 1 });
  const B = newState('B'); logReading(B, { unit: 'fern', meter: 'oil', value: 2, ts: 2 });
  const m = merge(A, B);
  ok(m.logs.length === 2 && m.logs.some(r => r.unit === 'yurt') && m.logs.some(r => r.unit === 'fern'),
     "merge keeps BOTH phones' supply-log readings — neither camp's oil log is dropped on sync");
  // merged device id: a.dev || b.dev || 'local' — pin both branches.
  ok(merge(newState('phoneA'), newState('phoneB')).dev === 'phoneA', 'merge keeps the first device id (a.dev)');
  ok(merge({ ...newState('phoneA'), dev: '' }, newState('phoneB')).dev === 'phoneB', 'merge falls through to b.dev when a has none — not forced to local');
  // merged seq = max of both — pin each operand as the max so an `x && 1` mutant changes it.
  const s1 = merge(Object.assign(newState('A'), { seq: 9 }), Object.assign(newState('B'), { seq: 5 }));
  const s2 = merge(Object.assign(newState('A'), { seq: 5 }), Object.assign(newState('B'), { seq: 9 }));
  ok(s1.seq === 9 && s2.seq === 9, 'merge seq is the max of both sides (9), never reset to 1');
  // export / import preserve a real device id (not masked to 'local').
  ok(JSON.parse(exportState(newState('myphone'))).dev === 'myphone', 'export preserves the device id');
  ok(importState(JSON.stringify({ v: 1, dev: 'myphone', tasks: [], logs: [], checks: {}, seq: 1 })).dev === 'myphone', 'import preserves the device id');
  // import rejects a structurally-invalid board (missing tasks OR logs array) — pins the guard OR-chain.
  ok(importState('{"tasks":[]}') === null && importState('{"logs":[]}') === null,
     'a board missing its tasks OR logs array is rejected, not half-loaded');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ WISHWOOD KEEPER — jobs, issues and off-grid supply logs for the four camps, on one board; the urgent stuff surfaces, a low supply raises itself, nothing is lost in a message · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
