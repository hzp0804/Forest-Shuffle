Task: Fix Elderberry Passive Effect in Special Modes
Status: Completed

Details:

- Investigated `onConfirmPlay` in `miniprogram/pages/game/game.js`.
- Identified that `finalizeAction` reads stale `accumulatedRewards` data when processing the end of a special action chain.
- The database update (`db.command.inc`) used to accumulate rewards during the special action was technically correct for the server state, but the local client logic in `finalizeAction` missed it for the _current_ immediate draw execution.
- Fixed by synchronously updating `this.pendingDrawCount` in `onConfirmPlay` when a reward (trigger effect) is detected during special play mode.

Associated Files:

- e:\code\Forest-Shuffle\miniprogram\pages\game\game.js
