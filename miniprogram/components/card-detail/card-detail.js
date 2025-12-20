const { getCardInfoById } = require("../../utils/getCardInfoById");

Component({
  options: {
    // Allow global card sprite classes (card-1, card-2, …) to style the preview
    addGlobalClass: true,
  },

  properties: {
    cardId: {
      type: String,
      optionalTypes: [Number],
      value: "",
      observer: function (newVal) {
        if (newVal) {
          this.loadCardData(newVal);
        }
      },
    },
    // 是否在对局中（用于判断是否显示得分）
    inGame: {
      type: Boolean,
      value: false
    },
    // 游戏上下文（用于计算得分）
    gameContext: {
      type: Object,
      value: null
    },
    // 卡牌数据（包含 uid 等信息，用于计算得分）
    cardData: {
      type: Object,
      value: null,
      observer: function () {
        this.calculateScore();
      }
    },
    // 生效的物种侧（用于确定默认 tab）
    activeSide: {
      type: String,
      value: null
    }
  },

  data: {
    card: null,
    tabs: [],
    activeTab: 0,
    visible: false,
    cardScore: null // 卡牌得分
  },

  methods: {
    loadCardData: function (cardId) {
      if (cardId) {
        const info = getCardInfoById(cardId);
        if (!info || !info.id) return;

        // Prepare tabs data from speciesDetails
        const tabs = [];
        const speciesList = info.speciesDetails || [];

        speciesList.forEach(meta => {
          if (meta && meta.name && meta.name !== "未知物种") {
            tabs.push({
              name: meta.name,
              originalName: meta.name,
              count: meta.nb || 0,
              tags: meta.tags || [],
              cost: meta.cost,
              bonus: meta.bonus || "",
              effect: meta.effect || "",
              points: meta.points || "",
            });
          }
        });

        // Fallback
        if (tabs.length === 0 && info.name) {
          tabs.push({
            name: info.name,
            tags: info.tags || [],
            cost: info.cost,
            bonus: info.bonus || "",
            effect: info.effect || "",
            points: info.points || "",
          });
        }

        // 根据 activeSide 确定默认 tab
        let defaultTab = 0;
        const activeSide = this.data.activeSide;
        const cardType = (info.type || '').toLowerCase();

        if (activeSide && tabs.length > 1) {
          // H_CARD: left=0, right=1
          if (cardType.includes('hcard') || cardType.includes('h_card')) {
            if (activeSide === 'right') defaultTab = 1;
          }
          // V_CARD: top=0, bottom=1
          else if (cardType.includes('vcard') || cardType.includes('v_card')) {
            if (activeSide === 'bottom') defaultTab = 1;
          }
        }

        this.setData({
          card: info,
          tabs: tabs,
          activeTab: defaultTab,
          visible: true,
        }, () => {
          // 数据加载完成后计算得分
          this.calculateScore();
        });
      }
    },

    onTabClick: function (e) {
      const index = e.currentTarget.dataset.index;
      this.setData({ activeTab: index });
    },

    onClose: function () {
      this.setData({ visible: false });
      this.triggerEvent("close");
    },

    // 计算卡牌得分
    calculateScore: function () {
      const { inGame, gameContext, cardData } = this.data;

      // 只有在对局中且有必要数据时才计算得分
      if (!inGame || !gameContext || !cardData) {
        this.setData({ cardScore: null });
        return;
      }

      try {
        const { calculateCardScore } = require('../../utils/score/index');
        const { precalculateStats, getAllCardsFromContext } = require('../../utils/score/helpers');
        const { TAGS } = require('../../data/constants');
        const { SCORING_TYPES } = require('../../data/enums');

        // 预统计数据
        const stats = precalculateStats(gameContext);

        // 特殊处理：蝴蝶 - 直接显示所有蝴蝶的总得分
        // 只要卡片带有 BUTTERFLY 标签,就计算并显示蝴蝶总分
        const isButterfly = cardData.tags && cardData.tags.includes(TAGS.BUTTERFLY);

        // 特殊处理：SCALE_BY_COUNT (如欧洲七叶树) - 显示平均每张的得分
        const isScaleByCount = cardData.scoreConfig && cardData.scoreConfig.type === SCORING_TYPES.SCALE_BY_COUNT;

        let score = 0;

        if (isButterfly) {
          // 蝴蝶卡:直接计算所有蝴蝶的总得分
          const { handleButterflySet } = require('../../utils/score/handlers/special');
          const allCards = getAllCardsFromContext(gameContext);
          const butterflies = allCards.filter(c => c.tags && c.tags.includes(TAGS.BUTTERFLY));

          if (butterflies.length > 0) {
            // 找到 Leader (UID 最小)
            butterflies.sort((a, b) => (a.uid > b.uid ? 1 : -1));
            // 直接用 Leader 计算蝴蝶总分
            score = handleButterflySet(butterflies[0], gameContext, null, null, stats);
          } else {
            score = 0;
          }
        } else if (isScaleByCount) {
          // SCALE_BY_COUNT 类型(如欧洲七叶树):显示平均每张的得分
          const { handleScaleByCount } = require('../../utils/score/handlers/special');
          const allCards = getAllCardsFromContext(gameContext);
          const targetName = cardData.scoreConfig.target || cardData.name;
          const matchingCards = allCards.filter(c => c.name === targetName);

          if (matchingCards.length > 0) {
            // 找到 Leader (UID 最小)
            matchingCards.sort((a, b) => (a.uid > b.uid ? 1 : -1));
            const leader = matchingCards[0];

            // 用 Leader 计算总分
            const totalScore = handleScaleByCount(leader, gameContext, null, null, stats);

            // 显示平均每张的得分
            score = Math.floor(totalScore / matchingCards.length);
          } else {
            score = 0;
          }
        } else {
          // 其他卡牌正常计算
          score = calculateCardScore(
            cardData,
            gameContext,
            null,
            null,
            stats
          );
        }

        this.setData({ cardScore: score });
      } catch (error) {
        console.error('计算卡牌得分失败:', error);
        this.setData({ cardScore: null });
      }
    },

    // Catch-all to prevent closing when clicking content
    noop: function () { },
  },
});
