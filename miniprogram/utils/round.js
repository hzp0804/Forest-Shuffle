// 回合判断逻辑
// 1.支持单人游玩
// 2.回合结束后，弹出操作记录（包括弃牌、打出等），如果奖励新的回合，一样要先弹出，表名此回合结束，进入新的回合
// 3.奖励触发的打牌属于同一回合，如果奖励是新的回合，那就按两个回合算
// 4、回合变动时，自动切换当前玩家
// 5、回合开始时要有消息提示

/**
 * 判断当前回合操作是否全部完成
 * @param {string} actionType - 玩家执行的动作 ('draw' | 'play')
 * @param {Array} pendingEffects - 待处理的效果队列 (如 "免费打出一张牌", "放入洞穴" 等)
 * @returns {boolean} - 是否回合结束
 */
const checkTurnOver = (actionType, pendingEffects = []) => {
  // 如果还有未处理的强制效果/奖励行动 (如: 免费打牌)，回合继续
  if (pendingEffects && pendingEffects.length > 0) {
    return false;
  }

  // 如果动作是简单的 'draw' (摸牌)，通常直接结束
  if (actionType === "draw") {
    return true;
  }

  // 如果是 'play' (打牌)，且无后续 pending 效果，则本回合结束
  if (actionType === "play") {
    return true;
  }

  return false;
};

/**
 * 计算下一个行动的玩家 OpenID
 * @param {string} currentOpenId - 当前玩家 ID
 * @param {Array} players - 玩家列表对象数组
 * @param {boolean} gainedExtraTurn - 是否获得了额外回合奖励
 * @returns {string} - 下一个玩家的 OpenID
 */
const getNextPlayer = (currentOpenId, players, gainedExtraTurn) => {
  if (!players || players.length === 0) return currentOpenId;

  // 1. 单人游玩 / 获得额外回合 -> 还是自己
  if (players.length === 1 || gainedExtraTurn) {
    return currentOpenId;
  }

  // 2. 多人游玩 -> 顺时针切换
  // 必须过滤掉空座位 (null)
  const validPlayers = players.filter(p => p);

  // 保底检查：如果过滤后没人（理论不可能，至少有当前玩家），直接返回
  if (validPlayers.length === 0) return currentOpenId;
  // 如果只有一人，返回自己
  if (validPlayers.length === 1) return currentOpenId;

  const currentIndex = validPlayers.findIndex((p) => p.openId === currentOpenId);
  if (currentIndex === -1) return validPlayers[0].openId; // 异常兜底

  const nextIndex = (currentIndex + 1) % validPlayers.length;
  return validPlayers[nextIndex].openId;
};

/**
 * 获取回合开始时的提示消息
 * @param {boolean} isMyTurn - 是否轮到我
 * @param {boolean} isExtraTurn - 是否是额外回合
 * @returns {string} - 提示文案
 */
const getTurnStartMessage = (isMyTurn, isExtraTurn) => {
  if (!isMyTurn) return "等待其他玩家行动...";
  if (isExtraTurn) return "🎉 额外回合！请继续行动";
  return "✨ 轮到你了！请摸牌或出牌";
};

/**
 * 格式化回合总结报告 (用于弹窗)
 * @param {Object} record - 回合记录对象 { playedCardName, cost, bonus ... }
 * @param {boolean} gainedExtraTurn
 * @returns {string} - 总结文本
 */
const formatTurnSummary = (record, gainedExtraTurn) => {
  let summary = "本回合结束\n";
  if (record.action === "draw") {
    summary += "📥 摸取了 2 张卡牌";
  } else if (record.action === "play") {
    summary += `🃏 打出了 ${record.cardName || "卡牌"}\n`;
    summary += `💰 支付费用: ${record.cost || 0} 张\n`;
    if (record.bonus) {
      summary += `🎁 触发奖励: ${record.bonus}\n`;
    }
  }

  if (gainedExtraTurn) {
    summary += "\n⚡ 获得额外回合！";
  }

  return summary;
};

module.exports = {
  checkTurnOver,
  getNextPlayer,
  getTurnStartMessage,
  formatTurnSummary,
};
