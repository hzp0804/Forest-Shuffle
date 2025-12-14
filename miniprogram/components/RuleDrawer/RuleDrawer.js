// components/RuleDrawer/RuleDrawer.js
Component({
  properties: {
    // Props can be added here if needed to control from outside via data binding
  },

  data: {
    visible: false,
    content: {
      title: '',
      sections: []
    }
  },

  methods: {
    show(ruleData) {
      this.setData({
        visible: true,
        content: ruleData
      });
    },

    onClose() {
      this.setData({
        visible: false
      });
    }
  }
})
