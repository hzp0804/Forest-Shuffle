Implementation Plan - Fix Elderberry Trigger in Special Play Mode

1.  **Analyze the Issue**:

    - **Symptom**: Playing a plant card via a reward (e.g., Free Play) does not trigger Elderberry's passive effect (Draw 1 card).
    - **Root Cause**: In `miniprogram/pages/game/game.js`, within `onConfirmPlay`, when `isSpecialPlayMode` is active (e.g., during Free Play), the calculated rewards (including Trigger Effects like Elderberry's) are added to `gameState.accumulatedRewards.drawCount` using a database increment operator (`db.command.inc`). However, the subsequent call to `finalizeAction` reads the _previous_ state of `gameState.accumulatedRewards` (local data), missing the pending increment that hasn't been confirmed by the server yet.
    - **Verification**: Reviewed `onConfirmPlay` logic lines 1035-1130. Confirmed that `pendingDrawCount` was not being updated locally for special play modes, causing `finalizeAction` to see 0 draws if the previous accumulated count was 0.

2.  **Proposed Solution**:

    - **Modify `miniprogram/pages/game/game.js`**:
    - In the `if (isSpecialPlayMode)` block in `onConfirmPlay`.
    - After calculating `reward` (which correctly includes `triggers.drawCount`), explicitly add `reward.drawCount` to `this.pendingDrawCount`.
    - This ensures `finalizeAction` (which reads `pendingDrawCount`) will execute the draw immediately.

3.  **Implementation Steps**:

    - Identify the code block in `onConfirmPlay`.
    - Insert `this.pendingDrawCount = (this.pendingDrawCount || 0) + reward.drawCount` if `reward.drawCount > 0`.
    - Add comments explaining the fix.

4.  **Verification Plan**:
    - (Self-Correction during thought process): Checked if `extraTurn` is also affected. It theoretically is, but no current Trigger Effects provide extra turns, only draws. So resolving `drawCount` handles the reported issue and current game mechanics.
