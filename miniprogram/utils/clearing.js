/**
 * 计算空地滚动目标ID
 * @param {Array} oldClearing 旧的空地数据
 * @param {Array} newClearing 新的空地数据
 * @returns {String|null} 目标滚动ID
 */
const getScrollTarget = (oldClearing, newClearing) => {
  const oldLen = oldClearing ? oldClearing.length : 0;
  const newLen = newClearing ? newClearing.length : 0;

  // 只要卡片数量增加，就尝试滚动到最新那张卡
  if (newLen > oldLen && newLen > 0) {
    // 为了让最新卡片出现在屏幕右侧，我们滚动到它前面的第3张卡片 (适配不同机型宽度)
    const targetIndex = Math.max(0, newLen - 3);
    return `clearing-${targetIndex}`;
  }
  return null;
};

/**
 * 执行空地滚动
 * @param {Object} page 页面实例
 * @param {String} scrollId 滚动ID
 */
const executeScroll = (page, scrollId) => {
  if (!page || !scrollId) return;

  // 强制触发滚动：先置空，再赋值，确保 scroll-view 监听到变化
  page.setData({ clearingScrollId: '' }, () => {
    setTimeout(() => {
      page.setData({ clearingScrollId: scrollId });
    }, 100);
  });
};

module.exports = {
  getScrollTarget,
  executeScroll
};
