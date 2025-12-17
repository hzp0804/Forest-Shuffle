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
        // Note: original c.species is list of names, info.speciesDetails is list of objects.

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
          } else {
            // Fallback if species detail is missing but name exists? 
            // getCardInfoById fills "未知物种" if missing.
          }
        });

        // If speciesDetails was empty or filtered out, maybe fallback logic?
        // But getCardInfoById logic guarantees speciesDetails array corresponding to species keys.

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
