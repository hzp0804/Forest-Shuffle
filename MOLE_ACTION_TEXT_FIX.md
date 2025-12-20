# 鼹鼠效果提示信息修复

## 问题描述

鼹鼠（Mole）的效果提示信息不正确：

- ❌ **错误提示**：显示为"鼹鼠特殊行动"，没有说明需要支付费用
- ✅ **正确描述**：应该显示"立即支付费用打出任意数量的牌"

## 问题根源

**位置**：`miniprogram/utils/reward.js` 第 106-109 行

**原因**：

- `ACTION_MOLE` 的处理逻辑中，只设置了简单的 `result.text = "鼹鼠特殊行动"`
- 没有添加 `actionText` 字段到 `actions` 数组中
- 没有使用卡牌上的 `effect` 描述文案

**原代码**：

```javascript
case REWARD_TYPES.ACTION_MOLE:
  result.text = "鼹鼠特殊行动";
  result.actions.push(config);
  break;
```

## 修复方案

**修复后的代码**：

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

## 修复内容

### 1. 优先使用卡牌描述

- 从 `card.effect`（或 `card.bonus`）中获取描述文案
- 鼹鼠的 `effect` 是："立即支付费用打出任意数量的牌"

### 2. 添加 actionText 字段

- 将 `actionText` 添加到 `actions` 数组中
- 确保游戏界面能正确显示提示信息

### 3. 提供默认文案

- 如果卡牌没有描述，使用默认文案："立即支付费用打出任意数量的牌"
- 确保即使数据缺失也能显示正确的提示

## 鼹鼠卡牌配置

**文件**：`miniprogram/data/speciesData.js` 第 225-238 行

```javascript
[SPECIES_NAMES.MOLE]: {
  name: "鼹鼠",
  nb: 2,
  tags: [TAGS.PAW],
  cost: 2,
  type: CARD_TYPES.V_CARD,
  effect: "立即支付费用打出任意数量的牌",  // ✅ 正确的描述
  effectConfig: {
    type: REWARD_TYPES.ACTION_MOLE,
    isInfinite: true
  },
  bonus: "",
  points: "",
}
```

## 效果说明

### 鼹鼠的正确效果

1. **立即触发**：打出鼹鼠后立即进入特殊行动模式
2. **支付费用**：每打出一张牌都需要支付正常的费用（不是免费）
3. **任意数量**：可以连续打出多张牌，直到不想打或无法支付费用

### 与免费打牌的区别

- **免费打牌**（如银杉的 bonus）：不需要支付费用
- **鼹鼠效果**：需要支付费用，但可以连续打出多张

## 验证步骤

### 1. 打出鼹鼠卡牌

1. 在游戏中打出鼹鼠
2. 查看游戏提示信息

### 2. 检查提示文本

应该显示：

```
立即支付费用打出任意数量的牌
```

而不是：

```
鼹鼠特殊行动
```

### 3. 验证费用计算

1. 选择一张手牌
2. 选择插槽
3. 确认指引信息显示需要支付的费用
4. 确认不是"免费打出"

## 相关文件

| 文件                  | 修改内容                              |
| --------------------- | ------------------------------------- |
| `utils/reward.js`     | 修复 `ACTION_MOLE` 的提示信息生成逻辑 |
| `data/speciesData.js` | 鼹鼠卡牌配置（已正确，无需修改）      |

## 技术细节

### actionText 的作用

`actionText` 字段用于在游戏界面显示当前行动的提示信息：

- 显示在指引栏中
- 告诉玩家当前应该做什么
- 说明行动的规则和限制

### 数据流

```
卡牌配置 (speciesData.js)
  ↓
calculateReward (reward.js)
  ↓
result.actions[].actionText
  ↓
gameState.actionText
  ↓
游戏界面显示
```

### 与其他特殊行动的对比

| 卡牌 | 效果类型       | 是否免费    | 提示信息                                   |
| ---- | -------------- | ----------- | ------------------------------------------ |
| 鼹鼠 | ACTION_MOLE    | ❌ 需要费用 | "立即支付费用打出任意数量的牌"             |
| 银杉 | PLAY_FREE      | ✅ 免费     | "免费打出一张带有爪印符号的牌"             |
| 浣熊 | ACTION_RACCOON | N/A         | "将任意数量的手牌放入洞穴，然后摸等量的牌" |

## 后续改进建议

### 1. 统一特殊行动的处理

所有特殊行动都应该：

- 使用卡牌上的描述文案
- 添加 `actionText` 字段
- 提供合理的默认文案

### 2. 添加费用提示

在鼹鼠行动模式下，可以在指引信息中明确显示：

```
立即支付费用打出任意数量的牌
当前选择：[卡牌名称]
需要支付：X 张牌
```

### 3. 视觉区分

使用不同的颜色或图标区分：

- 🆓 免费打牌
- 💰 需要支付费用

## 总结

✅ **问题已修复**：鼹鼠的效果提示信息现在会正确显示"立即支付费用打出任意数量的牌"

✅ **使用卡牌描述**：优先使用 `card.effect` 中的描述文案

✅ **添加 actionText**：确保游戏界面能正确显示提示信息

🎯 **验证方法**：打出鼹鼠卡牌，查看提示信息是否正确
