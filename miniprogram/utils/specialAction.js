const { REWARD_TYPES } = require('../data/enums');
const { TAGS, CARD_TYPES } = require('../data/constants');

/**
 * 特殊行动维护工具
 */
const SpecialActionUtils = {
  /**
   * 根据效果配置检测具体的特殊行动模式
   * @param {Object} actionConfig - 效果配置对象 (effectConfig 或 bonusConfig)
   * @returns {String|null} 行动模式标识
   */
  detectActionMode(actionConfig) {
    if (!actionConfig) return null;

    const type = actionConfig.type;

    // 映射类型到模式标识
    const modeMap = {
      [REWARD_TYPES.ACTION_MOLE]: 'MOLE',
      [REWARD_TYPES.ACTION_RACCOON]: 'RACCOON',
      [REWARD_TYPES.ACTION_BEAR]: 'BEAR',
      [REWARD_TYPES.FREE_PLAY_BAT]: 'FREE_PLAY_BAT',
      [REWARD_TYPES.ACTION_REMOVE_CLEARING]: 'REMOVE_CLEARING',
      [REWARD_TYPES.ACTION_CLEARING_TO_CAVE]: 'CLEARING_TO_CAVE',
      [REWARD_TYPES.ACTION_PICK_FROM_CLEARING]: 'PICK_FROM_CLEARING',
      [REWARD_TYPES.ACTION_PLAY_SAPLINGS]: 'PLAY_SAPLINGS',
      [REWARD_TYPES.PLAY_FREE]: 'PLAY_FREE',
      [REWARD_TYPES.PICK_FROM_CLEARING_TO_HAND]: 'PICK_FROM_CLEARING_TO_HAND',
      [REWARD_TYPES.CLEARING_TO_CAVE]: 'CLEARING_TO_CAVE'
    };

    return modeMap[type] || 'SPECIAL_ACTION';
  },


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
      case 'FREE_PLAY_BAT':
        // 只能选择蝙蝠卡
        return card.tags && card.tags.includes(TAGS.BAT);

      case 'PLAY_FREE':
        // 只能选择带有指定 Tag 的卡（例如：火蝾螈-免费爪印）
        // 通过 config.tags 数组判断
        if (config && config.tags && Array.isArray(config.tags)) {
          return card.tags && config.tags.some(tag => card.tags.includes(tag));
        }
        return true;

      // 其他模式可能不需要在此时限制选择，而是在操作点击时判断
      default:
        return true;
    }
  },


  /**
   * 判断在当前模式下，是否允许点击常规的“打出”按钮
   * @param {String} mode - 行动模式
   * @returns {Boolean}
   */
  isPlayCardAllowed(mode) {
    // 只有在这些“提交卡牌”类的特殊模式下，才允许继续点击“打出”
    const playModes = ['MOLE', 'FREE_PLAY_BAT', 'PLAY_SAPLINGS', 'PLAY_FREE'];
    return playModes.includes(mode);
  },

  /**
   * 判断某个行动模式是否为全自动执行（无需玩家介入）
   * @param {String} mode 
   * @returns {Boolean}
   */
  isAutomatic(mode) {
    // 根据用户反馈，不存在全自动行动，所有行动都应进入 pending 状态或交互流程
    return false;
  }
};

module.exports = SpecialActionUtils;
