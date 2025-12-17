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
  },

  data: {
    card: null,
    tabs: [],
    activeTab: 0,
    visible: false,
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

        this.setData({
          card: info,
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
    noop: function () { },
  },
});
