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

  // 只要卡片数量增加，就尝试滚动到最新那张卡
  if (newLen > oldLen && newLen > 0) {
    // 为了让最新卡片出现在屏幕右侧，我们滚动到它前面的第3张卡片 (适配不同机型宽度)
    const targetIndex = Math.max(0, newLen - 3);
    return { type: 'id', value: `clearing-${targetIndex}` };
  }

  // 如果原本有点，现在没了 (被清空)，滚动回最左边
  if (oldLen > 0 && newLen === 0) {
    return { type: 'left', value: 0 };
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
