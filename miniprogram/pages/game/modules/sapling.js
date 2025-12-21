const Utils = require("../../../utils/utils");
const DbHelper = require("../../../utils/dbHelper.js");
const RoundUtils = require("../../../utils/round.js");
const { SAPLING_DATA } = require("../../../data/speciesData");
const { calculateTriggerEffects } = require("../../../utils/reward.js");
const { submitGameUpdate, createExtraTurnEvent } = require("./core.js");
const db = wx.cloud.database();

/**
 * 打出树苗
 */
function onPlaySapling(page) {
  if (!page.data.isMyTurn) {
    wx.showToast({ title: "不是你的回合", icon: "none" });
    return;
  }
  if (!page.data.isViewingSelf) {
    wx.showToast({ title: "只能操作自己的森林", icon: "none" });
    return;
  }
  if (page.data.turnAction?.drawnCount > 0 || page.data.turnAction?.takenCount > 0) {
    wx.showToast({ title: "已摸牌，本回合只能继续摸牌", icon: "none" });
    return;
  }

  const { gameState, primarySelection, playerStates, openId } = page.data;

  // 水田鼠模式下的特殊处理
  if (gameState && gameState.actionMode === 'ACTION_PLAY_SAPLINGS') {
    // 水田鼠模式:不需要先选择手牌,直接选择第一张手牌作为树苗
    const myHand = playerStates[openId]?.hand || [];
    if (myHand.length === 0) {
      wx.showToast({ title: "手牌为空", icon: "none" });
      return;
    }

    // 自动选择第一张手牌
    const firstCard = myHand[0];
    page.setData({ primarySelection: firstCard.uid });

    // 直接执行打出树苗,不需要确认
    executePlaySapling(page);
    return;
  }

  // 普通模式:需要先选择手牌
  if (!primarySelection) {
    wx.showToast({ title: "请先选择一张手牌作为树苗", icon: "none" });
    return;
  }

  wx.showModal({
    title: '打出树苗',
    content: '将选中的手牌作为树苗打出？',
    success: (res) => {
      if (res.confirm) executePlaySapling(page);
    }
  });
}

/**
 * 执行打出树苗
 */
async function executePlaySapling(page) {
  wx.showLoading({ title: "种植中..." });
  const { playerStates, openId, clearing, deck, primarySelection } = page.data;

  const myState = playerStates[openId];
  const newHand = [...(myState.hand || [])];

  // 1. 找到并移除选中的手牌
  const cardIdx = newHand.findIndex(c => c.uid === primarySelection);
  if (cardIdx === -1) {
    wx.hideLoading();
    return;
  }
  const originalCard = newHand[cardIdx];
  newHand.splice(cardIdx, 1);

  const forest = [...(myState.forest || [])];
  const newClearing = [...(clearing || [])];
  const newDeck = [...(deck || [])];

  // 2. 将该卡转化为树苗放入森林
  const saplingCard = {
    ...SAPLING_DATA,
    uid: originalCard.uid,
    id: 'sapling',
    originalId: originalCard.id
  };
  const enriched = Utils.enrichCard(saplingCard);

  forest.push({
    _id: Math.random().toString(36).substr(2, 9),
    center: enriched,
    slots: { top: null, bottom: null, left: null, right: null }
  });

  // 3. 计算场上效果触发
  const triggers = calculateTriggerEffects(forest, enriched, { slot: null });

  const updates = {
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
    [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
    [`gameState.playerStates.${openId}.selectedSlot`]: null,
    [`gameState.lastEvent`]: {
      type: 'PLAY_CARD',
      playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      mainCard: enriched,
      timestamp: Date.now()
    },
    // 将奖励累积到 accumulatedRewards，统一由 finalizeAction 处理
    [`gameState.accumulatedRewards`]: {
      drawCount: triggers.drawCount || 0,
      extraTurn: triggers.extraTurn || false,
      revealCount: 1, // 树苗固定翻一张
      removeClearingFlag: false,
      clearingToCaveFlag: false
    }
  };

  // 清除本地状态
  page.setData({
    primarySelection: null,
    selectedSlot: null
  });

  submitGameUpdate(page, updates, "打出树苗", `将一张手牌作为树苗打出`);

  // 调用 finalizeAction 统一处理剩余流程
  const { finalizeAction } = require("./action.js");
  await finalizeAction(page, updates, "打出树苗");

  wx.hideLoading();
}

module.exports = {
  onPlaySapling,
  executePlaySapling
};
