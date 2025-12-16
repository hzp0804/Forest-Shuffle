const {
  CARDS_DATA,
  SPECIES_DATA,
  getCardVisual,
} = require("../../data/cardData.js");

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
  },

  data: {
    card: null,
    tabs: [],
    activeTab: 0,
    visible: false,
  },

  methods: {
    loadCardData: function (cardId) {
      if (cardId && CARDS_DATA[cardId]) {
        const c = CARDS_DATA[cardId];
        const visual = getCardVisual(c);

        // Prepare tabs data from species
        const tabs = [];
        const speciesList = c.species || [];

        speciesList.forEach((specName) => {
          let meta = SPECIES_DATA[specName];
          if (!meta) {
            const keyNoSpace = specName.replace(/ /g, "");
            meta = SPECIES_DATA[keyNoSpace];
          }
          if (!meta) {
            meta = Object.values(SPECIES_DATA).find((s) => s.name === specName);
          }

          if (meta) {
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
          } else {
            tabs.push({
              name: specName,
              originalName: specName,
              count: "?",
              tags: [],
              cost: "?",
            });
          }
        });

        this.setData({
          card: {
            ...c,
            id: cardId,
            bgImg: visual.bgImg,
            bgSize: visual.bgSize,
            cssClass: `card-${cardId}`,
          },
          tabs: tabs,
          activeTab: 0,
          visible: true,
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

    // Catch-all to prevent closing when clicking content
    noop: function () {},
  },
});
