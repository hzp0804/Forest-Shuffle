// 费用计算
// 树木：直接查询卡片信息的csot
// 附属卡：根据插槽位置确定使用附属卡中的那一张（附属卡是拥有两张卡片在上面的）

const {
  CARDS_DATA,
  SPECIES_DATA,
} = require("../data/cardData");
const { CARD_TYPES } = require("../data/constants");
const { TREE, H_CARD, V_CARD } = CARD_TYPES;

/**
 * 获取卡牌在特定位置的费用
 * @param {Object} card - 卡牌对象 (必须包含 id)
 * @param {string} slotType - 插槽位置 ('center', 'top', 'bottom', 'left', 'right')
 * @returns {number} - 费用
 */
const getCardCost = (card, slotType) => {
  // 兼容 card 为对象或直接为 ID 的情况
  const cardId = typeof card === "object" && card !== null ? card.id : card;

  if (!cardId) return 0;

  // 获取卡牌基础数据
  const cardBasic = CARDS_DATA[cardId];
  if (!cardBasic) return 0;

  const type = cardBasic.type;
  const speciesList = cardBasic.species;

  // ... (rest of logic)

  // 确保 speciesList 是数组
  if (!Array.isArray(speciesList) || speciesList.length === 0) return 0;

  // 根据卡牌类型和插槽位置确定使用的是哪一个物种
  let speciesName = null;

  if (type === TREE) {
    // 树木卡放在中央
    if (slotType === "center") {
      speciesName = speciesList[0];
    } else if (slotType === "center_2") {
      // 支持双树卡（如 Hazel/HorseChestnut），获取第二个树种
      speciesName = speciesList[1];
    }
  } else if (type === H_CARD) {
    // 水平分割卡：通常表示左右分割 (Left/Right)
    // 根据 cardData.js 数据结构：
    // speciesList[0] 是左边，speciesList[1] 是右边
    if (slotType === "left") {
      speciesName = speciesList[0];
    } else if (slotType === "right") {
      speciesName = speciesList[1];
    }
  } else if (type === V_CARD) {
    // 垂直分割卡：通常表示上下分割 (Top/Bottom)
    // 根据 cardData.js 数据结构：
    // speciesList[0] 是上边，speciesList[1] 是下边
    if (slotType === "top") {
      speciesName = speciesList[0];
    } else if (slotType === "bottom") {
      speciesName = speciesList[1];
    }
  }

  // 如果找到了对应的物种名称，查询详细数据获取费用
  if (speciesName) {
    let speciesInfo = SPECIES_DATA[speciesName];

    // 1. 如果直接 key 没找到，尝试去除空格后的 key (例如 "European Bison" -> "EuropeanBison")
    if (!speciesInfo) {
      const sanitizedKey = speciesName.replace(/[^a-zA-Z0-9]/g, "");
      // 尝试匹配 key
      const keyMatch = Object.keys(SPECIES_DATA).find(
        (k) => k.toLowerCase() === sanitizedKey.toLowerCase()
      );
      if (keyMatch) {
        speciesInfo = SPECIES_DATA[keyMatch];
      }
    }

    // 2. 如果还未找到，尝试匹配 data.name 字段
    if (!speciesInfo) {
      speciesInfo = Object.values(SPECIES_DATA).find((s) => {
        if (!s.name) return false;
        return (
          s.name.toLowerCase() === speciesName.toLowerCase() ||
          s.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ===
          speciesName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
        );
      });
    }

    // 注意：有些物种 cost 可能为 0，所以要判断 undefined
    if (speciesInfo && speciesInfo.cost !== undefined) {
      return speciesInfo.cost;
    }
  }

  return 0;
};

module.exports = {
  getCardCost,
};
