const Utils = require("../../../utils/utils");
const { calculateReward, calculateTriggerEffects } = require("../../../utils/reward.js");
const { validatePlay } = require("../../../utils/validate.js");
const RoundUtils = require("../../../utils/round.js");
const DbHelper = require("../../../utils/dbHelper.js");
const SpecialActionUtils = require("../../../utils/specialAction.js");
const { CARD_TYPES, TAGS } = require("../../../data/constants");
const { submitGameUpdate, createExtraTurnEvent, createClearingNotification } = require("./core.js");
const db = wx.cloud.database();

/**
 * 从空地拿牌
 */
function onConfirmTake(page) {
  const { selectedClearingIdx, clearing, playerStates, openId, turnAction } = page.data;
  if (selectedClearingIdx === -1 || selectedClearingIdx === undefined) return;
  if (selectedClearingIdx === -2) {
    const { executeDrawFromDeck } = require("./draw.js");
    executeDrawFromDeck(page);
    return;
  }

  const curTotal = (turnAction?.drawnCount || 0) + (turnAction?.takenCount || 0);
  if (curTotal >= 2) { wx.showToast({ title: "步数已用完", icon: "none" }); return; }
  if (playerStates[openId].hand.length >= 10) { wx.showToast({ title: "手牌已满", icon: "none" }); return; }

  const newClearing = [...clearing];
  const newHand = [...playerStates[openId].hand];
  const [card] = newClearing.splice(selectedClearingIdx, 1);
  newHand.push(card);

  const isEnd = (curTotal + 1) >= 2 || newHand.length >= 10;
  const nextPlayer = RoundUtils.getNextPlayer(openId, page.data.players, false);
  const updates = {
    [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
    [`gameState.turnAction`]: { ...turnAction, takenCount: (turnAction.takenCount || 0) + 1 },
    [`gameState.lastEvent`]: {
      type: 'TAKE_CARD', playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      mainCard: Utils.enrichCard(card), timestamp: Date.now()
    }
  };
  if (isEnd) {
    updates[`gameState.activePlayer`] = nextPlayer;
    updates[`gameState.turnAction`] = { drawnCount: 0, takenCount: 0 };
    updates[`gameState.turnCount`] = db.command.inc(1);
  } else {
    page.setData({ pendingActionToast: "还可以再拿一张牌" });
  }

  // 拿牌后取消选中状态
  page.setData({ selectedClearingIdx: -1 });

  submitGameUpdate(page, updates, null, `从空地拿了 ${card.name}`);
}

module.exports = {
  onConfirmTake
};
