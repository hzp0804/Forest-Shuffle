Task: Fix Score Caching for Cave Cards
Status: Completed

Details:

- Updated `generateGameStateHash` in `miniprogram/utils/score/helpers.js` to include cave cards in the hash calculation.
- This ensures that when cards are added to the cave, the score cache is invalidated and recalculated.

Associated Files:

- miniprogram/utils/score/helpers.js
