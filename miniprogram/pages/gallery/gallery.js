// miniprogram/pages/gallery/gallery.js
const {
  CARDS_DATA,
  SPECIES_DATA,
  getCardVisual,
  TREE,
  H_CARD,
  V_CARD,
  W_CARD,
} = require("../../data/cardData.js");

const ALPINE_DECK = "alpine";
const EDGE_DECK = "edge";

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

    Object.entries(CARDS_DATA).forEach(([id, card]) => {
      // 使用统一的视觉逻辑，修复 undefined 引用问题
      const { bgImg, bgSize, cssClass } = getCardVisual({ ...card, id });

      // Process species details
      const speciesDetails = (card.species || []).map((code) => {
        const meta = findSpeciesMeta(code);
        return {
          key: code,
          displayName: meta.name || code,
          points: meta.points || "",
        };
      });

      const displayCard = {
        ...card,
        id, // key comes as string from Object.entries
        bgImg,
        bgSize,
        cssClass,
        speciesDetails,
        primaryName: speciesDetails.map((s) => s.displayName).join(" / "),
      };

      if (card.deck === ALPINE_DECK) {
        sections[3].cards.push(displayCard);
      } else if (card.deck === EDGE_DECK) {
        sections[4].cards.push(displayCard);
      } else {
        if (card.type === TREE || card.type === W_CARD) {
          sections[0].cards.push(displayCard);
        } else if (card.type === H_CARD) {
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

  noop: function () {},
});
