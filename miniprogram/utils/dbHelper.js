const { getCardInfoById } = require('./getCardInfoById');

/**
 * 清理单张卡牌的静态数据
 * 只保留必要的动态字段：id, uid, selected, animationData, list, max, slotConfig
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

  // 保留堆叠相关字段
  if (card.list && Array.isArray(card.list)) {
    cleaned.list = card.list.map(cleanCard).filter(Boolean);
  }
  if (card.max !== undefined) cleaned.max = card.max;
  if (card.slotConfig !== undefined) cleaned.slotConfig = card.slotConfig;

  return cleaned;
}

/**
 * 清理森林数据，并在清理前进行统一排序
 * 排序规则：普通树木 -> 灌木 -> 树苗，同类按名称排序，名称相同按ID排序
 * @param {Array} forest - 森林数组
 * @returns {Array} 清理并排序后的森林数组
 */
function cleanForest(forest) {
  if (!Array.isArray(forest)) return [];

  // 获取卡片名称的辅助函数
  const getName = (obj) => {
    if (!obj) return '';
    if (obj.name) return obj.name;
    if (obj.id) {
      const info = getCardInfoById(obj.id);
      return info ? info.name : '';
    }
    return '';
  };

  // 1. 先进行排序
  const sorted = [...forest].sort((a, b) => {
    if (!a || !a.center) return 1;
    if (!b || !b.center) return -1;

    const nameA = getName(a.center);
    const nameB = getName(b.center);

    // 定义特殊类型的优先级 (0: 普通树木, 1: 灌木, 2: 树苗)
    const getPriority = (name) => {
      if (name === '树苗') return 2;
      if (name === '灌木') return 1;
      return 0;
    };

    const priorityA = getPriority(nameA);
    const priorityB = getPriority(nameB);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // 同类型按名称排序
    const nameCompare = nameA.localeCompare(nameB, 'zh-CN');
    if (nameCompare !== 0) return nameCompare;

    // 名称相同按 ID 排序，保证确定性
    const idA = a._id || '';
    const idB = b._id || '';
    if (idA < idB) return -1;
    if (idA > idB) return 1;
    return 0;
  });

  // 2. 再清理数据
  return sorted.map(treeGroup => {
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
