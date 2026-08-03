// test.mjs — PROOF-OF-PLAY for WISHWOOD KEEPER. Zero tokens. Proves the housekeeping board does what a WhatsApp
// thread can't: urgent jobs surface, a noticed low supply becomes a task automatically (deduped), NOTHING that
// needs attention is ever hidden, and the whole board is portable (export/import round-trips). Deterministic.
import K from './keeper.mjs';
const { newState, addTask, completeTask, reopenTask, deleteTask, openFor, logReading, latestReading, lowSupplies, attention, stats, exportState, importState, UNITS, METERS } = K;

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
  deleteTask(S, a.id); ok(stats(S).open === 1 && !S.tasks.some(t => t.id === a.id), 'a job can be removed entirely');
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

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ WISHWOOD KEEPER — jobs, issues and off-grid supply logs for the four camps, on one board; the urgent stuff surfaces, a low supply raises itself, nothing is lost in a message · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
