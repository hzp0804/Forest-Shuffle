// components/UserInfoModal/UserInfoModal.js
const defaultAvatar = 'http://8.134.103.20//admin-api/infra/file/1664470159415881729/get/20251219/2001920904035250176/qq.jpg';

const { PRESET_AVATARS } = require('../../data/constants');

Component({
  /**
   * Component properties
   */
  properties: {

  },

  /**
   * Component initial data
   */
  data: {
    visible: false,
    avatarUrl: '',
    nickName: '',
    defaultAvatar: defaultAvatar,
    canSubmit: false,
    submitting: false
  },

  /**
   * Component methods
   */
  methods: {
    show(userInfo) {
      if (userInfo) {
        let avatarUrl = userInfo.avatarUrl || this.data.avatarUrl || '';
        if (!avatarUrl && PRESET_AVATARS && PRESET_AVATARS.length > 0) {
          const rand = Math.floor(Math.random() * PRESET_AVATARS.length);
          avatarUrl = PRESET_AVATARS[rand];
        }

        this.setData({
          visible: true,
          avatarUrl: avatarUrl,
          nickName: userInfo.nickName || this.data.nickName || '',
          canSubmit: !!(avatarUrl && (userInfo.nickName || this.data.nickName))
        });
      } else {
        // If simply showing without userInfo, also randomize if empty
        let avatarUrl = this.data.avatarUrl;
        if (!avatarUrl && PRESET_AVATARS && PRESET_AVATARS.length > 0) {
          const rand = Math.floor(Math.random() * PRESET_AVATARS.length);
          avatarUrl = PRESET_AVATARS[rand];
        }

        this.setData({ visible: true, avatarUrl });
      }
    },

    hide() {
      this.setData({ visible: false });
    },

    onChooseAvatar(e) {
      const { avatarUrl } = e.detail;
      this.setData({
        avatarUrl,
        canSubmit: !!(avatarUrl && this.data.nickName)
      });
    },

    onNicknameInput(e) {
      const { value } = e.detail;
      this.setData({
        nickName: value,
        canSubmit: !!(this.data.avatarUrl && value)
      });
    },

    onNicknameChange(e) {
      // Handle blur event/enter which sometimes is needed for type="nickname" persistence
      const { value } = e.detail;
      this.setData({
        nickName: value,
        canSubmit: !!(this.data.avatarUrl && value)
      });
    },

    onConfirm() {
      if (!this.data.canSubmit) return;

      this.setData({ submitting: true });

      const { avatarUrl, nickName } = this.data;

      // Trigger event to parent with the data
      this.triggerEvent('submit', {
        avatarUrl,
        nickName
      });

      // We don't hide immediately, let parent handle it or we hide after success
    },

    stopLoading() {
      this.setData({ submitting: false });
    }
  }
})
