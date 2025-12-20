Implementation Plan - Fix Score Updating

1.  **Analyze the Issue**:

    - **User Feedback**: "The score is still wrong."
    - **Root Cause**: The caching mechanism (`scoreCache`) uses `generateGameStateHash` to decide if the score needs re-calculation. Previously, this hash generation ONLY considered cards in the **Forest**. It ignored changes in the **Cave**.
    - **Scenario**:
      - Player has Bearded Vulture (pays attention to cave).
      - Score is calculated (Hash A).
      - Player adds 2 cards to Cave. Forest is unchanged.
      - Next calc: `generateGameStateHash` sees unchanged forest -> Generates Hash A.
      - Returns cached score (invalid).
    - **Solution**: Update `generateGameStateHash` to include UIDs of cards in the `Cave`.

2.  **Implementation Steps (Completed)**:

    - **Update `miniprogram/utils/score/helpers.js`**:
      - Found `generateGameStateHash` function.
      - Added logic to iterate over `pState.cave` (if it exists) and append each card's UID to the hash parts.

3.  **Verification**:
    - Add cards to cave -> Hash changes -> Cache invalidates -> `calculateTotalScore` runs -> `handleCaveCount` runs -> Returns correct score.
    - This combined with the previous check (`if (context.cave)`) ensures robustness.

All steps executed.
