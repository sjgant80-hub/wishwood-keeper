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

## Proven — `node test.mjs`, zero tokens, 28/28

`§1` jobs land on the right camp, urgent sorts to the top · `§2` done / reopen / delete keep the counts honest ·
`§3` **the magic** — a low supply reading auto-raises an urgent job, deduped, and the loop re-arms after it's done ·
`§4` **nothing gets lost** — every urgent, overdue and low-supply item surfaces in one list, most-pressing first
(low-priority "someday" jobs stay out — signal, not noise) · `§5` export/import round-trips the whole board exactly
(a real backup) · `§7` the maintenance checklist ticks, is per-camp, and resets per turnover · `§6` deterministic +
fuzz-safe (bad input never breaks it).

## Files

`keeper.mjs` (the housekeeping brain — jobs, supply logs with auto-raise, the turnover checklist, the attention
list, portable backup) · `test.mjs` (the 28/28 gate) · `index.html` (the phone board — attention strip, quick-add,
per-camp boards, supply logs, maintenance checklist, backup). Built for Wishwood. Zero-dep, offline PWA, your data
stays yours.

```bash
node test.mjs                 # the proof
python -m http.server 8080    # then open http://localhost:8080 on your phone
```
