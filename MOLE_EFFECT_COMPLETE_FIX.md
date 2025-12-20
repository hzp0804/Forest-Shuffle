# 鼹鼠效果完整修复（最终版）

## 鼹鼠的正确效果

**鼹鼠（Mole）**的效果是：

1. ✅ **需要支付费用**：每张牌都要正常支付费用
2. ✅ **任意数量**：可以连续打出多张牌
3. ❌ **无奖励/效果**：打出的牌不会触发奖励（bonus）和效果（effect）
4. ✅ **可以跳过**：可以选择不打牌，结束行动

## 修复的问题

### 问题 1：提示语不对 ✅ 已修复

- **错误**：显示了费用、奖励、效果
- **正确**：只显示费用（因为鼹鼠模式下无奖励/效果）

### 问题 2：费用验证缺失 ✅ 已修复

- **错误**：可以免费打牌
- **正确**：必须支付正确的费用

### 问题 3：可能触发奖励/效果 ✅ 已确认正确

- **代码逻辑**：`isSpecialPlayMode` 包含 `ACTION_MOLE`，已经禁用了奖励和效果
- **无需修改**：代码已经正确实现了这个逻辑

## 修复内容

### 1. 更新卡牌描述（speciesData.js）

**文件**：`miniprogram/data/speciesData.js` 第 231 行

**修改前**：

```javascript
effect: "立即支付费用打出任意数量的牌",
```

**修改后**：

```javascript
effect: "支付费用打出任意数量的牌（无奖励/效果）",
```

### 2. 修复提示信息（validate.js）

**文件**：`miniprogram/utils/validate.js` 第 228-276 行

**关键修改**：

```javascript
// 检查是否是鼹鼠模式
const isMoleMode = gameState && gameState.actionMode === "ACTION_MOLE";

// 奖励行：鼹鼠模式下不显示
if (hasBonus && !isMoleMode) {
  // ... 显示奖励
}

// 效果行：鼹鼠模式下不显示
if (hasEffect && !isMoleMode) {
  // ... 显示效果
}

// 鼹鼠模式的特殊提示
if (isMoleMode) {
  const molePrefix = gameState.actionText || "支付费用打出牌（无奖励/效果）";
  finalText = isCostSatisfied ? `${molePrefix} | ${text}` : text;
}
```

### 3. 费用验证（validate.js）

**文件**：`miniprogram/utils/validate.js` 第 111-124 行

```javascript
// ACTION_MOLE 模式：需要正常验证费用
if (gameState.actionMode === 'ACTION_MOLE') {
  // 继续执行正常的费用验证逻辑
} else {
  // 其他特殊模式默认允许
  return { valid: true, ... };
}
```

### 4. 禁用奖励/效果（game.js）

**文件**：`miniprogram/pages/game/game.js` 第 1002-1022 行

**已有的正确逻辑**（无需修改）：

```javascript
const isSpecialPlayMode = [
  "ACTION_MOLE",
  "ACTION_PLAY_SAPLINGS",
  "PLAY_FREE",
].includes(gameState.actionMode);

if (source === "PLAYER_ACTION") {
  // 在特殊模式下打牌，不重新触发该牌自身的 Bonus 和 Effect
  if (!isSpecialPlayMode) {
    bonus = calculateReward(primaryCard, selectedSlot, paymentCards, {}, true);
    effect = calculateReward(
      primaryCard,
      null,
      paymentCards,
      { forest },
      false
    );
  }
}
```

### 5. 提示信息生成（reward.js）

**文件**：`miniprogram/utils/reward.js` 第 106-114 行

```javascript
case REWARD_TYPES.ACTION_MOLE:
  const moleText = isBonus ? (card.bonus || '') : (card.effect || '');
  result.text = moleText || "鼹鼠特殊行动";
  result.actions.push({
    ...config,
    actionText: moleText || "支付费用打出牌（无奖励/效果）"
  });
  break;
```

## 提示信息示例

### 正常打牌模式

```
✅ 【费用】: 2 | 【奖励】获得1张牌 | 【效果】立即获得新的回合
```

### 鼹鼠模式（费用满足）

```
支付费用打出牌（无奖励/效果） | ✅ 【费用】: 2
```

### 鼹鼠模式（费用不足）

```
【费用】: 2
```

## 验证步骤

### 1. 打出鼹鼠卡牌

1. 在游戏中打出鼹鼠（费用 2）
2. 进入鼹鼠特殊行动模式

### 2. 检查提示信息

应该显示：

```
支付费用打出牌（无奖励/效果）
```

### 3. 选择一张有奖励/效果的卡牌

例如：桦树（效果：获得 1 张牌，得分：1 分）

**正常模式下**：

```
✅ 【费用】: 0 | 【效果】获得1张牌
```

**鼹鼠模式下**：

```
支付费用打出牌（无奖励/效果） | ✅ 【费用】: 0
```

注意：**不显示【效果】**

### 4. 验证费用支付

1. 选择费用为 2 的卡牌
2. 只选主牌 → ❌ 显示"【费用】: 2"（红色）
3. 选主牌 + 2 张支付卡 → ✅ 显示"✅ 【费用】: 2"（绿色）

### 5. 验证无奖励/效果

1. 打出一张有效果的卡（如桦树：效果"获得 1 张牌"）
2. 确认**不会摸牌**
3. 确认**不会触发任何效果**

## 技术细节

### 特殊模式分类

| 模式                   | 需要费用 | 触发奖励/效果 | 说明                            |
| ---------------------- | -------- | ------------- | ------------------------------- |
| `ACTION_MOLE`          | ✅ 是    | ❌ 否         | 鼹鼠：支付费用打牌，无奖励/效果 |
| `PLAY_FREE`            | ❌ 否    | ❌ 否         | 免费打牌，无奖励/效果           |
| `ACTION_PLAY_SAPLINGS` | ❌ 否    | ❌ 否         | 打出树苗                        |
| 正常模式               | ✅ 是    | ✅ 是         | 正常打牌，触发奖励/效果         |

### 代码逻辑流程

```
用户打出鼹鼠
  ↓
进入 ACTION_MOLE 模式
  ↓
用户选择要打的牌
  ↓
validatePlay() 验证
  ├─ 检测到 ACTION_MOLE 模式
  ├─ 不显示奖励/效果提示
  ├─ 验证费用是否满足
  └─ 返回 valid: true/false
  ↓
onConfirmPlay() 出牌
  ├─ 检测到 isSpecialPlayMode = true
  ├─ 不计算 bonus 和 effect
  └─ 只执行打牌动作
  ↓
完成
```

### 为什么鼹鼠模式不触发奖励/效果？

1. **游戏平衡**：如果触发奖励/效果，鼹鼠会过于强大
2. **设计意图**：鼹鼠的价值在于"快速打出多张牌"，而不是"连锁触发效果"
3. **代码实现**：`isSpecialPlayMode` 包含 `ACTION_MOLE`，明确禁用了奖励/效果计算

## 相关文件

| 文件                  | 修改内容                  | 行号      |
| --------------------- | ------------------------- | --------- |
| `data/speciesData.js` | 更新鼹鼠的 effect 描述    | 231       |
| `utils/validate.js`   | 鼹鼠模式下不显示奖励/效果 | 228-276   |
| `utils/validate.js`   | 添加费用验证              | 111-124   |
| `utils/reward.js`     | 更新提示信息              | 106-114   |
| `pages/game/game.js`  | 禁用奖励/效果（已有）     | 1002-1022 |

## 总结

✅ **所有问题已修复**：

1. 提示语正确：只显示费用，不显示奖励/效果
2. 费用验证正常：必须支付正确费用
3. 奖励/效果已禁用：代码逻辑正确

✅ **鼹鼠效果完整实现**：

- 支付费用打出任意数量的牌
- 打出的牌不会触发奖励和效果
- 可以跳过，结束行动

🎯 **验证方法**：

1. 打出鼹鼠
2. 查看提示："支付费用打出牌（无奖励/效果）"
3. 打出有效果的卡（如桦树）
4. 确认不会摸牌（效果未触发）
