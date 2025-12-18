const { REWARD_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 特殊行动维护工具
 */
const SpecialActionUtils = {
  /**
   * 检查在当前模式下，某张卡是否可以被玩家选择执行
   * @param {String} mode - 当前模式
   * @param {Object} card - 准备选中的卡
   * @param {Object} config - 模式原始配置项
   * @returns {Boolean}
   */
  isCardSelectable(mode, card, config) {
    if (!card) return false;

    switch (mode) {
      case 'PLAY_FREE':
        // 只能选择带有指定 Tag 的卡（例如：火蝾螈-免费爪印）
        // 通过 config.tags 数组判断
        if (config && config.tags && Array.isArray(config.tags)) {
          return card.tags && config.tags.some(tag => card.tags.includes(tag));
        }
        return true;

      default:
        return true;
    }
  }
};

module.exports = SpecialActionUtils;
