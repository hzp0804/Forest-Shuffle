const Utils = require("../../../utils/utils");
const DbHelper = require("../../../utils/dbHelper.js");
const RoundUtils = require("../../../utils/round.js");
const { CARD_TYPES } = require("../../../data/constants");
const db = wx.cloud.database();

/**
 * 辅助方法：处理抽牌逻辑，包含冬季卡检测
 */
function processDrawWithWinter(page, deck, count, startWinterCount) {
  const { openId, players, gameState } = page.data;
  const newDeck = [...deck];
  const drawnCards = [];
  const events = [];
  let winterCount = (startWinterCount !== undefined) ? startWinterCount : (gameState.winterCardCount || 0);
  let gameOver = false;

  while (drawnCards.length < count && newDeck.length > 0) {
    const card = newDeck.shift();
    const isWinter = card.type === "Winter" || card.type === CARD_TYPES.W_CARD || card.id === "Winter";

    if (isWinter) {
      winterCount++;
      console.log(`❄️ 抽到冬季卡! 当前计数: ${winterCount}/3`);

      // 冬季卡展示事件
      events.push({
        type: 'DRAW_CARD',
        playerOpenId: openId,
        playerNick: players.find(p => p.openId === openId)?.nickName || '玩家',
        playerAvatar: players.find(p => p.openId === openId)?.avatarUrl || '',
        mainCard: Utils.enrichCard(card),
        isWinterReveal: true,
        winterCount,
        timestamp: Date.now() + events.length * 100
      });

      if (winterCount >= 3) {
        console.log('🎮 游戏结束! 抽到第3张冬季卡');
        gameOver = true;
        break;
      }
    } else {
      drawnCards.push(card);
    }
  }

  return { newDeck, drawnCards, events, winterCount, gameOver };
}

/**
 * 执行从牌堆抽牌
 */
function executeDrawFromDeck(page) {
  const { deck, playerStates, openId, turnAction, gameState } = page.data;
  
  // 检查游戏是否已结束
  if (gameState?.isGameOver) {
    wx.showToast({ title: "游戏已结束", icon: "none" });
    return;
  }
  
  const curTotal = (turnAction?.drawnCount || 0) + (turnAction?.takenCount || 0);

  if (playerStates[openId].hand.length >= 10) {
    wx.showToast({ title: "手牌已满", icon: "none" });
    return;
  }

  if (curTotal >= 2 || deck.length === 0) return;

  // 使用新的抽牌逻辑
  const drawResult = processDrawWithWinter(page, deck, 1);
  const { newDeck, drawnCards, events, winterCount, gameOver } = drawResult;

  // 如果游戏结束（抽到第3张冬季卡）
  if (gameOver) {
    console.log('🎮 执行游戏结束逻辑:', {
      winterCount,
      eventsCount: events.length,
      deckRemaining: newDeck.length
    });
    
    const updates = {
      [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
      [`gameState.winterCardCount`]: winterCount,
      [`gameState.isGameOver`]: true,
      [`gameState.gameEndReason`]: 'WINTER_CARD',
      [`gameState.gameEndTime`]: Date.now(),
      [`gameState.lastEvent`]: events // 包含冬季卡展示事件（数组）
    };
    page.submitGameUpdate(updates, null, `抽到第3张冬季卡，游戏结束`);

    console.log('✅ 游戏已终止，不进行页面跳转');
    return;
  }

  // 正常流程
  const newHand = [...playerStates[openId].hand, ...drawnCards];
  // 创建最终抽到的卡牌事件
  if (drawnCards.length > 0) {
    const card = drawnCards[0];
    events.push({
      type: 'DRAW_CARD', playerOpenId: openId,
      playerNick: page.data.players.find(p => p.openId === openId)?.nickName || '玩家',
      playerAvatar: page.data.players.find(p => p.openId === openId)?.avatarUrl || '',
      mainCard: Utils.enrichCard(card),
      timestamp: Date.now() + events.length * 100
    });
  }

  const isEnd = (curTotal + 1) >= 2 || newHand.length >= 10;
  const nextPlayer = RoundUtils.getNextPlayer(openId, page.data.players, false);

  const updates = {
    [`gameState.deck`]: DbHelper.cleanDeck(newDeck),
    [`gameState.playerStates.${openId}.hand`]: DbHelper.cleanHand(newHand),
    [`gameState.turnAction`]: { ...turnAction, drawnCount: (turnAction.drawnCount || 0) + 1 },
    [`gameState.winterCardCount`]: winterCount,
    [`gameState.lastEvent`]: events // 这里的events可能包含冬季卡展示+最终抽牌
  };

  if (isEnd) {
    updates[`gameState.activePlayer`] = nextPlayer;
    updates[`gameState.turnAction`] = { drawnCount: 0, takenCount: 0 };
    updates[`gameState.turnCount`] = db.command.inc(1);
  } else {
    page.setData({ pendingActionToast: "还可以再摸一张牌" });
  }

  page.setData({ selectedClearingIdx: -1 });

  const logMsg = events.some(e => e.isWinterReveal)
    ? `触发冬季卡(第${winterCount}张)，并补抽一张`
    : `从牌堆摸了一张牌`;

  page.submitGameUpdate(updates, null, logMsg);
}

module.exports = {
  processDrawWithWinter,
  executeDrawFromDeck
};
