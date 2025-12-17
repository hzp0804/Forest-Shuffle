const {
  CARDS_DATA,
  SPECIES_DATA,
} = require("../../data/cardData.js");
const { getCardInfoById } = require("../../utils/getCardInfoById");
const { DECK_TYPES, CARD_TYPES } = require("../../data/constants");
const { TREE, H_CARD, V_CARD, W_CARD } = CARD_TYPES;

const ALPINE_DECK = DECK_TYPES.ALPINE;
const EDGE_DECK = DECK_TYPES.EDGE;

Page({
  data: {
    sections: [],
    viewMode: "image",
    previewCardId: null,
  },

  onLoad: function () {
    this.initCards();
  },

  initCards: function () {
    const sections = [
      { id: "basic_tree", title: "基础树木 (Basic Trees)", cards: [] },
      { id: "basic_h", title: "基础动物-横 (Basic H-Cards)", cards: [] },
      { id: "basic_v", title: "基础动物-竖 (Basic V-Cards)", cards: [] },
      { id: "alpine", title: "高山 (Alpine)", cards: [] },
      { id: "edge", title: "林缘 (Edge)", cards: [] },
    ];

    // Helper to find species metadata case-insensitively
    const speciesDataMap = {};
    Object.keys(SPECIES_DATA).forEach((key) => {
      speciesDataMap[key.toLowerCase()] = SPECIES_DATA[key];
      speciesDataMap[key] = SPECIES_DATA[key];
    });

    const findSpeciesMeta = (code) => {
      if (!code) return {};
      return speciesDataMap[code] || speciesDataMap[code.toLowerCase()] || {};
    };

    Object.keys(CARDS_DATA).forEach((id) => {
      // 使用统一的查询方法
      const info = getCardInfoById(id);
      if (!info || !info.id) return;

      // Note: info 已经包含了 enriched speciesDetails (Array of objects)
      // 但是 gallery 之前的逻辑是 map species names to custom object {key, displayName, points}
      // info.speciesDetails 里的对象是 SPECIES_DATA 的 item (name, nb, tags, cost...)

      const speciesList = info.speciesDetails || [];
      const speciesDisplay = speciesList.map((meta, index) => {
        // meta 是 speciesData object.
        // 如果 meta 为 null (未知物种)，处理一下
        const code = (CARDS_DATA[id].species || [])[index]; // fallback to raw code if needed

        if (meta && meta.name && meta.name !== "未知物种") {
          return {
            key: code,
            displayName: meta.name,
            points: meta.points || ""
          };
        } else {
          return {
            key: code,
            displayName: code, // fallback
            points: ""
          };
        }
      });

      const { deck, type } = info;

      const displayCard = {
        ...info, // 包含 bgImg, bgSize, cssClass, id 等
        speciesDetails: speciesDisplay,
        primaryName: speciesDisplay.map((s) => s.displayName).join(" / "),
      };

      if (info.deck === ALPINE_DECK) {
        sections[3].cards.push(displayCard);
      } else if (info.deck === EDGE_DECK) {
        sections[4].cards.push(displayCard);
      } else {
        if (info.type === TREE || info.type === W_CARD) {
          sections[0].cards.push(displayCard);
        } else if (info.type === H_CARD) {
          sections[1].cards.push(displayCard);
        } else {
          sections[2].cards.push(displayCard);
        }
      }
    });

    // Sort cards in each section by ID
    sections.forEach((s) =>
      s.cards.sort((a, b) => Number(a.id) - Number(b.id))
    );

    this.setData({ sections });
  },

  onPreviewCard: function (e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      previewCardId: id,
    });
  },

  onClosePreview: function () {
    this.setData({
      previewCardId: null,
    });
  },

  noop: function () { },
});
