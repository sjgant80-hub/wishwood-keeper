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

## Share it between phones — the board lives in your GitHub repo

No server, no SaaS. The shared board is a file — **`board.json`** in a small repo of yours
([`wishwood-keeper-data`](https://github.com/sjgant80-hub/wishwood-keeper-data)). Every phone **reads it and
commits changes back** through the GitHub API, so everyone sees the same live board. It still works offline and
catches up when there's signal. Two phones editing at once **merge cleanly** — the merge is conflict-free
(device-unique ids, last-write-wins per record, deletes propagate; a commit conflict just re-reads, re-merges and
retries).

**One-time setup:**
1. GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**.
2. **Repository access → Only select repositories →** `wishwood-keeper-data`.
3. **Permissions → Repository → Contents → Read and write**. Generate, copy the token.
4. In the app, tap the **⚪ Local only** pill → paste the token (the repo is pre-filled) → **Turn sync on** →
   **🔗 Copy invite link** → send it to the team. They open the link and they're on the same board.

Why a *separate* data repo: the write token can only touch `board.json` there, so it can never change the live app
or any other repo. The token is stored **on the phone / in the invite link — never in the app's source**, so
GitHub's secret-scanning won't revoke it.

*Honest note:* the token is a **write key** — anyone with the invite link can edit the board (and only that data
repo). That's right for a small trusted team; keep the link private. Reads come straight from the API (fresh, no
CDN lag); each change is one small commit, so the repo carries a full history of the board.

*(An alternative Cloudflare-Worker transport — `sync-worker.js` — is also in the repo if you'd rather not use a
GitHub token; the app's merge is identical either way.)*

## Proven — `node test.mjs`, zero tokens, 38/38

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
