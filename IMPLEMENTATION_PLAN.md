# Forest Shuffle 小程序开发计划

## 项目目标
开发《森森不息 (Forest Shuffle)》微信小程序，采用微信云开发作为后端。

## 技术栈
- **前端**: 微信小程序原生 (WXML, WXSS, JavaScript)
- **后端**: 微信云开发 (Cloud Functions, Cloud Database)
- **风格**: 自然、森林、生态 (深绿、清新风格)

## 任务清单

### 1. 基础架构 & UI
- [x] **项目初始化**: 目录结构, `app.json`, `app.wxss`.
- [x] **设计系统**: 森林主题配色, 首页视觉.
- [x] **首页 (`pages/index`)**: 包含 `RuleDrawer` 组件.

### 2. 生物图鉴 (Gallery)
- [x] **基础图鉴页面**: Grid 和 Code 视图切换.
- [x] **PDF 处理 (Deprecated)**: 原计划切割 PDF，后改为使用 BGA 资源.
- [x] **BGA 资源集成**: 
    - [x] 解析 BGA `card.js` 和 `css` 提取数据.
    - [x] 实现 CSS Sprite 渲染逻辑 (`gallery.js`).
    - [x] 处理本地 Sprite 图片 (`trees.webp`, `hCards.webp` 等).
- [x] **卡牌详情页**: 点击图鉴进入大图详情 (`pages/card-detail`).

### 3. 计分器 (Score Counter)
- [x] **计分页面**: 树木、野生动物、特殊奖励输入.
- [x] **自动计算**: 实时总分统计.
- [ ] **高级计分**: 根据卡牌效果自动计算 (待办).

### 4. 游戏规则 (Rules)
- [x] **规则抽屉 (`RuleDrawer`)**: 滑动抽屉显示规则.
- [x] **规则数据**: 基础规则、得分说明.

### 5. 云开发 (Cloud)
- [ ] **环境配置**: 绑定环境 ID.
- [ ] **用户系统**: 登录、保存分数历史.
