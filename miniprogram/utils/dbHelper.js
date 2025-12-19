/**
 * 数据库辅助函数
 * 用于清理卡牌数据中的冗余静态字段，减少数据库存储
 */

/**
 * 清理单张卡牌的静态数据
 * 只保留必要的动态字段：id, uid, selected, animationData, stackedCards
 * @param {Object} card - 卡牌对象
 * @returns {Object} 清理后的卡牌对象
 */
function cleanCard(card) {
  if (!card) return null;

  const cleaned = {
    id: card.id,
    uid: card.uid,
  };

  if (card.selected !== undefined) cleaned.selected = card.selected;
  if (card.animationData !== undefined) cleaned.animationData = card.animationData;

  // 保留树苗的关键属性,确保其他玩家能正确显示"树苗"
  if (card.id === 'sapling') {
    // 显式保存树苗的核心属性
    cleaned.name = '树苗';
    cleaned.type = 'TREE';
    if (card.tags) cleaned.tags = card.tags;
    // 保留原始卡片ID用于追溯(可选)
    if (card.originalId) cleaned.originalId = card.originalId;
  }

  // 保留堆叠卡（递归清理）
  if (card.stackedCards && Array.isArray(card.stackedCards)) {
    cleaned.stackedCards = card.stackedCards.map(cleanCard).filter(Boolean);
  }

  return cleaned;
}

/**
 * 清理森林数据
 * @param {Array} forest - 森林数组
 * @returns {Array} 清理后的森林数组
 */
function cleanForest(forest) {
  if (!Array.isArray(forest)) return [];

  return forest.map(treeGroup => {
    if (!treeGroup) return null;

    const cleaned = {
      _id: treeGroup._id,
      center: cleanCard(treeGroup.center),
      slots: {}
    };

    // 清理插槽
    if (treeGroup.slots) {
      ['top', 'bottom', 'left', 'right'].forEach(side => {
        cleaned.slots[side] = cleanCard(treeGroup.slots[side]);
      });
    }

    return cleaned;
  }).filter(Boolean);
}

/**
 * 清理手牌数据
 * @param {Array} hand - 手牌数组
 * @returns {Array} 清理后的手牌数组
 */
function cleanHand(hand) {
  if (!Array.isArray(hand)) return [];
  return hand.map(cleanCard).filter(Boolean);
}

/**
 * 清理空地数据
 * @param {Array} clearing - 空地数组
 * @returns {Array} 清理后的空地数组
 */
function cleanClearing(clearing) {
  if (!Array.isArray(clearing)) return [];
  return clearing.map(cleanCard).filter(Boolean);
}

/**
 * 清理牌库数据
 * @param {Array} deck - 牌库数组
 * @returns {Array} 清理后的牌库数组
 */
function cleanDeck(deck) {
  if (!Array.isArray(deck)) return [];
  return deck.map(card => {
    if (!card) return null;
    return {
      id: card.id,
      uid: card.uid
    };
  }).filter(Boolean);
}

module.exports = {
  cleanCard,
  cleanForest,
  cleanHand,
  cleanClearing,
  cleanDeck
};
