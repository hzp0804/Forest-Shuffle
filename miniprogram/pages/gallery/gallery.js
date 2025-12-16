// miniprogram/pages/gallery/gallery.js
const {
  CARDS_DATA,
  SPECIES_DATA,
  remoteMap,
} = require("../../data/cardData.js");

const BASIC_DECK = "basic";
const ALPINE_DECK = "alpine";
const EDGE_DECK = "edge";

const TREE = "Tree";
const W_CARD = "wCard";
const H_CARD = "hCard";
const V_CARD = "vCard";
const MOUNTAIN = "Mountain";

Page({
  data: {
    sections: [],
    viewMode: "image",
    previewCard: null,
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

    const getImgAndSize = (deck, type) => {
      let img = "";
      let cols = 1;
      let rows = 1;

      if (deck === ALPINE_DECK) {
        img = remoteMap[MOUNTAIN];
        cols = 7;
        rows = 4;
      } else if (deck === EDGE_DECK) {
        img = remoteMap[W_CARD]; // Access woodlands.jpg via W_CARD key
        cols = 6;
        rows = 6;
      } else {
        // Basic
        if (type === TREE || type === W_CARD) {
          img = remoteMap[TREE];
          cols = 5;
          rows = 5;
        } else if (type === H_CARD) {
          img = remoteMap[H_CARD];
          cols = 7;
          rows = 7;
        } else if (type === V_CARD) {
          img = remoteMap[V_CARD];
          cols = 7;
          rows = 7;
        } else {
          // Fallback
          img = remoteMap[TREE];
          cols = 5;
          rows = 5;
        }
      }
      return { img, size: `${cols * 100}% ${rows * 100}%` };
    };

    Object.entries(CARDS_DATA).forEach(([id, card]) => {
      const { img, size } = getImgAndSize(card.deck, card.type);

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
        bgImg: img,
        bgSize: size,
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
    let found = null;
    for (const sec of this.data.sections) {
      found = sec.cards.find((c) => String(c.id) === String(id));
      if (found) break;
    }
    if (found) {
      this.setData({ previewCard: found });
    }
  },

  onClosePreview: function () {
    this.setData({ previewCard: null });
  },

  noop: function () {},
});
