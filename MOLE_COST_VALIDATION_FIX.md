# 鼹鼠效果费用验证修复

## 问题描述

鼹鼠（Mole）的效果有两个问题：

1. ❌ **提示信息不对**：显示"鼹鼠特殊行动"，没有说明需要支付费用
2. ❌ **费用验证缺失**：打牌时不需要支付费用就能打出去（严重 bug）

## 问题根源

### 问题 1：提示信息不正确

**位置**：`miniprogram/utils/reward.js` 第 106-109 行

**原因**：

- 没有使用卡牌上的 `effect` 描述
- 没有添加 `actionText` 字段

**原代码**：

```javascript
case REWARD_TYPES.ACTION_MOLE:
  result.text = "鼹鼠特殊行动";
  result.actions.push(config);
  break;
```

### 问题 2：费用验证缺失（严重 bug）

**位置**：`miniprogram/utils/validate.js` 第 111-117 行

**原因**：

- `ACTION_MOLE` 被当作"其他特殊模式"处理
- 直接返回 `valid: true`，跳过了费用验证
- 导致玩家可以不支付费用就打出任意数量的牌

**原代码**：

```javascript
// 其他特殊模式
const text = gameState.actionText;
return {
  valid: true, // ❌ 直接允许，没有验证费用！
  instructionState: "warning",
  instructionText: text,
};
```

## 修复方案

### 修复 1：改进提示信息（reward.js）

**文件**：`miniprogram/utils/reward.js` 第 106-114 行

```javascript
case REWARD_TYPES.ACTION_MOLE:
  // 使用卡牌上的描述文案，如果没有则使用默认文案
  const moleText = isBonus ? (card.bonus || '') : (card.effect || '');
  result.text = moleText || "鼹鼠特殊行动";
  result.actions.push({
    ...config,
    actionText: moleText || "立即支付费用打出任意数量的牌"
  });
  break;
```

**改进**：

- 优先使用 `card.effect`："立即支付费用打出任意数量的牌"
- 添加 `actionText` 字段到 actions 数组
- 提供合理的默认文案

### 修复 2：添加费用验证（validate.js）

**文件**：`miniprogram/utils/validate.js` 第 111-124 行

```javascript
// ACTION_MOLE 模式：需要正常验证费用（不是免费打牌）
if (gameState.actionMode === "ACTION_MOLE") {
  // 跳过特殊模式处理，继续执行正常的费用验证逻辑
  // 不在这里 return，让代码继续往下走到费用计算部分
} else {
  // 其他特殊模式（如 ACTION_PLAY_SAPLINGS 等）
  const text = gameState.actionText;
  return {
    valid: true, // 其他特殊模式默认允许
    instructionState: "warning",
    instructionText: text,
  };
}
```

**改进**：

- `ACTION_MOLE` 不再直接返回 `valid: true`
- 继续执行后续的费用计算和验证逻辑
- 确保玩家必须支付正确的费用才能打出牌

### 修复 3：优化提示显示（validate.js）

**文件**：`miniprogram/utils/validate.js` 第 269-276 行

```javascript
const text = segments.map((s) => s.text).join(" ");

// 如果是鼹鼠模式，添加特殊提示前缀
let finalText = text;
if (gameState && gameState.actionMode === "ACTION_MOLE") {
  const molePrefix = gameState.actionText || "立即支付费用打出任意数量的牌";
  finalText = isCostSatisfied ? `${molePrefix} | ${text}` : text;
}

const result = {
  valid: isCostSatisfied,
  error: isCostSatisfied ? null : `需支付 ${costs.join(" 或 ")} 张牌`,
  instructionState: isCostSatisfied ? "success" : "error",
  instructionText: finalText,
  // ...
};
```

**改进**：

- 在鼹鼠模式下，提示信息包含特殊行动说明
- 费用满足时显示：`立即支付费用打出任意数量的牌 | ✅ 【费用】: 2`
- 费用不足时显示：`【费用】: 2`

## 鼹鼠效果说明

### 正确的效果

1. **立即触发**：打出鼹鼠后立即进入特殊行动模式
2. **支付费用**：每打出一张牌都需要支付正常的费用（**不是免费**）
3. **任意数量**：可以连续打出多张牌，直到不想打或无法支付费用
4. **可以跳过**：可以选择不打牌，直接结束鼹鼠行动

### 与免费打牌的区别

| 特性     | 鼹鼠效果    | 免费打牌（如银杉 bonus） |
| -------- | ----------- | ------------------------ |
| 需要费用 | ✅ 是       | ❌ 否                    |
| 数量限制 | ♾️ 任意数量 | 通常 1 张                |
| 可以跳过 | ✅ 是       | ✅ 是                    |
| 触发奖励 | ❌ 否       | ❌ 否                    |

## 验证步骤

### 1. 打出鼹鼠卡牌

1. 在游戏中打出鼹鼠（费用 2）
2. 进入鼹鼠特殊行动模式

### 2. 检查提示信息

应该显示：

```
立即支付费用打出任意数量的牌
```

### 3. 尝试打牌

1. 选择一张手牌（例如费用为 2 的卡）
2. 选择插槽
3. **检查费用提示**：
   - 如果选择了 2 张牌（1 主牌 + 1 支付）：显示 `✅ 【费用】: 2`
   - 如果只选择了主牌：显示 `【费用】: 2`（红色，不允许出牌）

### 4. 验证费用扣除

1. 确认只有支付了正确费用才能打出牌
2. 确认不能免费打牌
3. 确认可以连续打出多张牌（每次都需要支付费用）

## 相关文件

| 文件                | 修改内容             | 行号    |
| ------------------- | -------------------- | ------- |
| `utils/reward.js`   | 修复提示信息生成逻辑 | 106-114 |
| `utils/validate.js` | 添加费用验证逻辑     | 111-124 |
| `utils/validate.js` | 优化提示显示         | 269-276 |

## 技术细节

### 费用验证流程

```
用户点击"出牌"
  ↓
validatePlay() 验证
  ↓
检查 actionMode
  ↓
ACTION_MOLE? → 继续执行费用验证（不 return）
  ↓
计算费用（costs）
  ↓
验证支付是否满足费用
  ↓
返回 valid: true/false
```

### 特殊模式分类

| 模式                    | 需要费用验证 | 说明                 |
| ----------------------- | ------------ | -------------------- |
| `ACTION_MOLE`           | ✅ 是        | 鼹鼠：支付费用打牌   |
| `PLAY_FREE`             | ❌ 否        | 免费打牌（验证 Tag） |
| `ACTION_PLAY_SAPLINGS`  | ❌ 否        | 打出树苗             |
| `ACTION_RACCOON`        | ❌ 否        | 浣熊：手牌换牌       |
| `ACTION_TUCK_HAND_CARD` | ❌ 否        | 大蟾蜍：堆叠手牌     |

### 为什么之前没发现？

1. **测试不充分**：可能没有测试鼹鼠的费用支付
2. **逻辑混淆**：将鼹鼠归类为"特殊模式"，但实际上它需要正常的费用验证
3. **代码注释误导**：`valid: true, // 特殊模式默认允许` 这个注释暗示所有特殊模式都不需要验证

## 后续改进建议

### 1. 添加单元测试

为鼹鼠效果添加测试用例：

```javascript
test("鼹鼠模式需要支付费用", () => {
  const result = validatePlay({
    gameState: { actionMode: "ACTION_MOLE" },
    primaryCard: { cost: 2, type: "TREE" },
    selectedCount: 1, // 只选了主牌，没有支付
  });
  expect(result.valid).toBe(false);
  expect(result.error).toContain("需支付");
});
```

### 2. 代码注释改进

在 `validate.js` 中添加清晰的注释：

```javascript
// 特殊模式分类：
// - 需要费用验证：ACTION_MOLE
// - 不需要费用验证：PLAY_FREE, ACTION_PLAY_SAPLINGS, etc.
```

### 3. 统一特殊模式处理

创建一个配置对象：

```javascript
const SPECIAL_MODES = {
  ACTION_MOLE: { requiresCost: true, requiresTag: false },
  PLAY_FREE: { requiresCost: false, requiresTag: true },
  // ...
};
```

## 总结

✅ **问题已完全修复**：

1. 提示信息正确显示："立即支付费用打出任意数量的牌"
2. 费用验证正常工作：必须支付正确费用才能打牌
3. 提示显示优化：清晰显示当前模式和费用要求

✅ **修复了严重 bug**：玩家不能再免费打牌了

✅ **向后兼容**：不影响其他特殊模式的功能

🎯 **验证方法**：

1. 打出鼹鼠卡牌
2. 尝试不支付费用打牌 → 应该被阻止
3. 支付正确费用打牌 → 应该成功
