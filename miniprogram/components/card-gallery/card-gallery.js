// components/card-gallery/card-gallery.js
const { CARDS_DATA } = require("../../data/cardData.js");
const { SPECIES_DATA } = require("../../data/speciesData.js");
const { getCardInfoById } = require("../../utils/getCardInfoById");
const { DECK_TYPES, CARD_TYPES } = require("../../data/constants");

Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer: function (newVal) {
        if (newVal && this.data.sections.length === 0) {
          this.initCards();
        }
      }
    },
    showClose: {
      type: Boolean,
      value: true
    }
  },

  data: {
    sections: [],
    allSections: [],
    searchQuery: ""
  },

  methods: {
    initCards() {
      wx.showLoading({ title: '加载图鉴...' });

      // 使用 setTimeout 避免阻塞主线程渲染
      setTimeout(() => {
        const { TREE, H_CARD, V_CARD, W_CARD } = CARD_TYPES;
        const ALPINE_DECK = DECK_TYPES.ALPINE;
        const EDGE_DECK = DECK_TYPES.EDGE;

        const sections = [
          { id: "basic_tree", title: "基础树木", cards: [] },
          { id: "basic_h", title: "基础动物-横", cards: [] },
          { id: "basic_v", title: "基础动物-竖", cards: [] },
          { id: "alpine", title: "高山", cards: [] },
          { id: "edge", title: "林缘", cards: [] },
        ];

        Object.keys(CARDS_DATA).forEach((id) => {
          const info = getCardInfoById(id);
          if (!info || !info.id) return;

          const speciesList = info.speciesDetails || [];
          const speciesDisplay = speciesList.map((meta, index) => {
            const code = (CARDS_DATA[id].species || [])[index];
            if (meta && meta.name && meta.name !== "未知物种") {
              return { displayName: meta.name };
            } else {
              return { displayName: code };
            }
          });

          const displayCard = {
            ...info,
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

        sections.forEach((s) =>
          s.cards.sort((a, b) => Number(a.id) - Number(b.id))
        );

        this.setData({
          sections: sections,
          allSections: sections
        }, () => {
          wx.hideLoading();
        });
      }, 100);
    },

    onSearchInput(e) {
      const query = e.detail.value.trim().toLowerCase();
      this.setData({ searchQuery: query });

      if (!query) {
        this.setData({ sections: this.data.allSections });
        return;
      }

      const filteredSections = this.data.allSections.map(section => {
        const filteredCards = section.cards.filter(card => {
          if (card.primaryName && card.primaryName.toLowerCase().includes(query)) return true;
          if (card.speciesDetails && card.speciesDetails.some(s => s.displayName && s.displayName.toLowerCase().includes(query))) return true;
          return false;
        });
        return { ...section, cards: filteredCards };
      }).filter(section => section.cards.length > 0);

      this.setData({ sections: filteredSections });
    },

    onCardLongPress(e) {
      const cardId = e.currentTarget.dataset.id;
      this.triggerEvent('preview', { cardId });
    },

    onCardTap(e) {
      const cardId = e.currentTarget.dataset.id;
      this.triggerEvent('select', { cardId });
    },

    onClose() {
      this.triggerEvent('close');
    }
  }
});
