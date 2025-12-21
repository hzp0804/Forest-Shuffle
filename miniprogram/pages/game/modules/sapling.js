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

  const reward = {
    drawCount: triggers.drawCount || 0,
    extraTurn: triggers.extraTurn || false,
    actions: triggers.actions || []
  };

  // 4. 处理奖励抽牌
  let drawnCards = [];
  if (reward.drawCount > 0) {
    const currentSize = newHand.length;
    const maxCanDraw = 10 - currentSize;
    const actualDraw = Math.min(reward.drawCount, maxCanDraw);

    for (let i = 0; i < actualDraw; i++) {
      if (newDeck.length > 0) {
        const card = newDeck.shift();
        newHand.push(card);
        drawnCards.push(Utils.enrichCard(card));
      }
    }
  }

  // 5. 翻牌逻辑
  let deckRevealEvent = null;
  if (newDeck.length > 0) {
    const top = newDeck.shift();
    newClearing.push({ ...top, selected: false });
    deckRevealEvent = {
      type: 'DECK_TO_CLEARING',
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      mainCard: Utils.enrichCard(top),
      timestamp: Date.now() + 100
    };
  }

  // 自动清空满的空地
  let notificationEvent = null;
  if (newClearing.length >= 10) {
    newClearing.length = 0;
    const { createClearingNotification } = require("./core.js");
    notificationEvent = createClearingNotification();
  }

  // 6. 构造事件
  let rewardDrawEvent = null;
  if (drawnCards.length > 0) {
    rewardDrawEvent = {
      type: 'REWARD_DRAW',
      playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      count: drawnCards.length,
      drawnCards: drawnCards,
      timestamp: Date.now() - 50
    };
  }

  let extraTurnEvent = null;
  if (reward.extraTurn) {
    extraTurnEvent = createExtraTurnEvent(page);
  }

  // 检查是否在水田鼠模式下
  const isWaterVoleMode = page.data.gameState && page.data.gameState.actionMode === 'ACTION_PLAY_SAPLINGS';

  const nextPlayer = isWaterVoleMode ? openId : RoundUtils.getNextPlayer(openId, page.data.players, reward.extraTurn);
  const updates = {
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
    [`gameState.playerStates.${openId}.forest`]: DbHelper.cleanForest(forest),
    [`gameState.playerStates.${openId}.selectedSlot`]: null,
    [`gameState.clearing`]: DbHelper.cleanClearing(newClearing),
    [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
    [`gameState.activePlayer`]: nextPlayer,
    [`gameState.lastEvent`]: {
      type: 'PLAY_CARD', playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      mainCard: enriched, subCards: [], timestamp: Date.now()
    },
    [`gameState.deckRevealEvent`]: deckRevealEvent,
    [`gameState.rewardDrawEvent`]: rewardDrawEvent,
    [`gameState.extraTurnEvent`]: extraTurnEvent,
    [`gameState.notificationEvent`]: db.command.set(notificationEvent)
  };

  // 水田鼠模式下:不结束回合,保持ACTION_PLAY_SAPLINGS模式
  if (!isWaterVoleMode) {
    updates[`gameState.turnAction`] = { drawnCount: 0, takenCount: 0 };
    updates[`gameState.turnCount`] = db.command.inc(1);
    updates[`gameState.turnReason`] = reward.extraTurn ? "extra" : "normal";
  }

  // 清除本地选择状态
  page.setData({ primarySelection: null });

  submitGameUpdate(page, updates, "种植成功", isWaterVoleMode ? "打出树苗(水田鼠模式)" : "将一张手牌作为树苗打出");
}

module.exports = {
  onPlaySapling,
  executePlaySapling
};
