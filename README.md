# Wishwood Keeper — site housekeeping for the four camps

**▶ Live: https://sjgant80-hub.github.io/wishwood-keeper/**  (open it on your phone, add it to your home screen — it works with no signal)

Jobs, issues and off-grid supply logs for **The Yurt · Fern Lodge · Thistle Caravan · The Hobbit**, on **one
board** — so the urgent stuff is in front of you, not buried in a WhatsApp thread. **Anyone can add an issue and
tick things off. No login, no app store, no server.**

## What it does

- **Add a job or issue in one tap** — pick a camp, type it, mark it 🔥 urgent if it can't wait.
- **⚑ Needs attention now** — a single strip at the top with every urgent job, anything overdue, and every low
  supply. Nothing that matters is hidden.
- **Off-grid supply logs** — log the gas canisters, lamp oil, citronella, firewood, firestarters and water. **A low
  reading raises its own urgent job automatically** — "1 canister left" becomes a *reorder* task the moment it's
  logged, instead of a message that scrolls away.
- **Maintenance schedule** — a turnover checklist per camp (bins · lamp oil · battery lamps checked & charged ·
  firewood · firestarters · water · shower-barrel water · fireplace cleaned · furniture back to original · Wi-Fi
  working). Tick as you go; hit **↻ New turnover** to start the list fresh for the next guest.
- **Back up / restore / print** — save a copy of the whole board as a file (yours to keep), or print/share it.

Everything is saved on the device and works fully offline. It's the four camps' housekeeping in one calm place.

## Share it between phones (sync)

Optional, and sovereign — no SaaS. Every phone with the same **board code** sees the same live board; each still
works offline and catches up when there's signal. Two phones can edit at the same time and **nothing gets
clobbered** — the merge is conflict-free (device-unique ids, last-write-wins per record, deletes propagate).

Turn it on once:

```bash
# deploy the tiny worker to YOUR Cloudflare (free tier)
npx wrangler kv namespace create KEEPER   # paste the printed id into wrangler.toml
npx wrangler deploy                       # prints your worker URL
```

Then in the app tap the **⚪ Local only** pill → paste the worker URL → tap **✨ new** for a board code → **Turn
sync on** → **🔗 Copy invite link** and send it to the team. They open the link and they're on the same board.
(Or fold the two `/b/:code` routes into Wishwood's existing worker instead of deploying a new one.)

*Honest note:* the board **code is the key** — anyone with the code/link can read and edit the board. That's right
for a small trusted team; use the long generated code and don't post the link publicly.

## Proven — `node test.mjs`, zero tokens, 36/36

`§1` jobs land on the right camp, urgent sorts to the top · `§2` done / reopen / delete keep the counts honest ·
`§3` **the magic** — a low supply reading auto-raises an urgent job, deduped, and the loop re-arms after it's done ·
`§4` **nothing gets lost** — every urgent, overdue and low-supply item surfaces in one list, most-pressing first
(low-priority "someday" jobs stay out — signal, not noise) · `§5` export/import round-trips the whole board exactly
(a real backup) · `§7` the maintenance checklist ticks, is per-camp, and resets per turnover · `§6` deterministic +
fuzz-safe · `§8` **sync** — two phones editing at once merge with nothing clobbered (order-independent, idempotent,
last-write-wins, deletes propagate, device-unique ids).

## Files

`keeper.mjs` (the housekeeping brain — jobs, supply logs with auto-raise, the turnover checklist, the attention
list, the **conflict-free merge**, portable backup) · `test.mjs` (the 36/36 gate) · `index.html` (the phone board
— attention strip, quick-add, per-camp boards, supply logs, maintenance checklist, sync, backup) · `sync-worker.js`
+ `wrangler.toml` (the tiny Cloudflare sync store). Built for Wishwood. Zero-dep, offline PWA, your data stays yours.

```bash
node test.mjs                 # the proof
python -m http.server 8080    # then open http://localhost:8080 on your phone
```
