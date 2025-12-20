Task: Implement Bearded Vulture Effect
Status: Completed

Details:

- Added `ACTION_PICK_FROM_CLEARING_TO_CAVE` to `REWARD_TYPES`.
- Configured Bearded Vulture in `speciesData.js`.
- Implemented action splitting logic in `reward.js` (count > 1 support).
- Implemented card moving logic (Clearing -> Cave) in `specialAction.js`.
- Enabled action execution hook in `game.js`.

Associated Files:

- miniprogram/data/enums.js
- miniprogram/data/speciesData.js
- miniprogram/utils/reward.js
- miniprogram/utils/specialAction.js
- miniprogram/pages/game/game.js
