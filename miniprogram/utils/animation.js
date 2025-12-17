// 动画工具类
// 提供打牌、弃牌、收牌等基础动画对象生成

/**
 * 通用移动动画
 * @param {boolean} enabled - 开关
 * @param {number} x - X轴偏移
 * @param {number} y - Y轴偏移
 * @param {number} duration - 持续时间
 * @returns {Object} animationData
 */
const createMoveAnim = (enabled, x, y, duration = 500) => {
  if (!enabled) return null;
  const anim = wx.createAnimation({
    duration: duration,
    timingFunction: "ease",
  });
  anim.translate(x, y).step();
  return anim.export();
};

/**
 * 此时往空地放牌时滚动到可视区域 (实际上通常由 scroll-view scroll-into-view 控制，此处提供卡片本身的位移效果)
 * 从屏幕中心或手牌区域飞入
 */
const playToClearing = (enabled) => {
  // 示例：从下方飞入
  if (!enabled) return null;
  const anim = wx.createAnimation({
    duration: 400,
    timingFunction: "ease-out",
  });
  anim.translateY(100).opacity(0).step({ duration: 10 }); // 初始位置
  anim.translateY(0).opacity(1).step(); // 归位
  return anim.export();
};

/**
 * 打牌到树木插槽
 * @param {boolean} enabled
 */
const playToForest = (enabled) => {
  if (!enabled) return null;
  const anim = wx.createAnimation({ duration: 500, timingFunction: "ease" });
  anim.scale(1.1).step({ duration: 200 }); // 强调
  anim.scale(1).step();
  return anim.export();
};

/**
 * 收走空地的牌 (往牌堆方向收)
 * 假设牌堆在左上或特定位置，这里演示淡出+位移
 */
const clearClearingAnim = (enabled) => {
  if (!enabled) return null;
  const anim = wx.createAnimation({ duration: 800, timingFunction: "ease-in" });
  // 往左上角飞出并消失
  anim.translate(-200, -200).opacity(0).scale(0.5).step();
  return anim.export();
};

module.exports = {
  createMoveAnim,
  playToClearing,
  playToForest,
  clearClearingAnim,
};
