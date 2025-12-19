/**
 * instructionHelper.js
 * 简单包装 validate.js，保持向后兼容
 */

const { validatePlay } = require('./validate');

/**
 * 检查指令提示
 * 直接调用 validate.validatePlay()
 */
const checkInstruction = (params) => {
  const result = validatePlay(params);

  // 返回 instructionHelper 期望的格式
  return {
    instructionState: result.instructionState,
    instructionText: result.instructionText,
    instructionSegments: result.instructionSegments,
    instructionLines: result.instructionLines
  };
};

module.exports = {
  checkInstruction
};
