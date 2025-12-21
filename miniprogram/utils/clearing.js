/**
 * 计算空地滚动目标ID
 * @param {Array} oldClearing 旧的空地数据
 * @param {Array} newClearing 新的空地数据
 * @returns {String|null} 目标滚动ID
 */
/**
 * 计算空地滚动目标ID或位置
 * @param {Array} oldClearing 旧的空地数据
 * @param {Array} newClearing 新的空地数据
 * @returns {Object|null} 目标滚动指令 { type: 'id'|'left', value: string|number }
 */
const getScrollTarget = (oldClearing, newClearing) => {
  const oldLen = oldClearing ? oldClearing.length : 0;
  const newLen = newClearing ? newClearing.length : 0;

  // 卡片数量 ≤5（第一行）：滚动到顶部，确保吸附在第一行
  if (newLen > 0 && newLen <= 5) {
    return { type: 'id', value: 'clearing-top' };
  }

  // 卡片数量 >5（第二行）：滚动到最后一张卡片，确保能看到最新的
  if (newLen > 5) {
    return { type: 'id', value: `clearing-${newLen - 1}` };
  }

  // 没有卡片：滚动到顶部第一个占位符
  if (newLen === 0) {
    return { type: 'id', value: 'clearing-top' };
  }

  return null;
};

/**
 * 执行空地滚动
 * @param {Object} page 页面实例
 * @param {Object} instruction 滚动指令
 */
const executeScroll = (page, instruction) => {
  if (!page || !instruction) return;

  // 兼容旧调用 (如果传入的是字符串)
  if (typeof instruction === 'string') {
    instruction = { type: 'id', value: instruction };
  }

  if (instruction.type === 'id') {
    // 滚动到指定ID：先置空ID强制触发变化
    page.setData({ clearingScrollId: '' }, () => {
      setTimeout(() => {
        page.setData({ clearingScrollId: instruction.value });
      }, 100);
    });
  } else if (instruction.type === 'top') {
    // 滚动到顶部：先置空ID防止冲突，再设置 scroll-top
    page.setData({ clearingScrollId: '' }, () => {
      setTimeout(() => {
        page.setData({ clearingScrollTop: instruction.value });
      }, 100);
    });
  } else if (instruction.type === 'left') {
    // 滚动到指定位置 (如0)：先置空ID防止冲突，再设置left
    page.setData({ clearingScrollId: '' }, () => {
      setTimeout(() => {
        page.setData({ clearingScrollLeft: instruction.value });
      }, 100);
    });
  }
};

module.exports = {
  getScrollTarget,
  executeScroll
};
