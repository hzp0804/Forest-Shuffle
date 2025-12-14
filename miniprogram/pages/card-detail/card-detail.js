const bgaData = require('../../data/bgaCardData.js');

Page({
  data: {
    card: null
  },

  onLoad: function (options) {
    const remoteBase = 'https://x.boardgamearena.net/data/themereleases/current/games/forestshuffle/250929-1034/img';
    const remoteMap = {
      // lower-case filenames
      'trees.jpg': `${remoteBase}/trees.jpg`,
      'hcards.jpg': `${remoteBase}/hCards.jpg`,
      'vcards.jpg': `${remoteBase}/vCards.jpg`,
      'mountain.jpg': `${remoteBase}/mountain.jpg`,
      'woodlands.jpg': `${remoteBase}/woodlands.Jpg`,
      'trees.webp': `${remoteBase}/trees.jpg`,
      'hcards.webp': `${remoteBase}/hCards.jpg`,
      'vcards.webp': `${remoteBase}/vCards.jpg`,
      'mountain.webp': `${remoteBase}/mountain.jpg`,
      // capitalized filenames supplied by BGA
      'hCards.jpg': `${remoteBase}/hCards.jpg`,
      'vCards.jpg': `${remoteBase}/vCards.jpg`,
      'woodlands.Jpg': `${remoteBase}/woodlands.Jpg`
    };

    const toRemote = (img = '') => {
      if (!img) return img;
      if (/^https?:\/\//.test(img)) return img;
      const name = img.split('/').pop();
      const lower = name.toLowerCase();
      if (remoteMap[name]) return remoteMap[name];
      if (remoteMap[lower]) return remoteMap[lower];
      return img;
    };

    const cardId = options.id;
    if (cardId && bgaData.cards[cardId]) {
      const c = bgaData.cards[cardId];
      const img = toRemote(c.img);
      
      // Sprite Style Calculation Logic
      const getGrid = (img, type) => {
        const fname = img.split('/').pop().toLowerCase();
        if (fname.includes('mountain')) {
          return { cols: 7, rows: 7, mountain: true };
        }
        if (img.includes('trees')) return { cols: 5, rows: 5 };
        if (img.includes('woodlands')) return { cols: 6, rows: 6 };
        return { cols: 7, rows: 7 };
      };
      
      const parsePct = (s) => parseFloat(s) || 0;
      const grid = getGrid(img, c.type);
      const { cols, rows, mountain } = grid;
      let width = cols * 100;
      let height = rows * 100;
      let left, top;

      if (mountain) {
        const xVal = parsePct(c.x) / 100;
        const yVal = parsePct(c.y) / 100;
        left = -1 * xVal * (cols - 1) * 100;
        top = -1 * yVal * (rows - 1) * 100;
      } else {
        const xVal = parsePct(c.x) / 100;
        const yVal = parsePct(c.y) / 100;
        left = -1 * xVal * (cols - 1) * 100;
        top = -1 * yVal * (rows - 1) * 100;
      }

      this.setData({
        card: {
          ...c,
          img,
          spriteStyle: `width: ${width}%; height: ${height}%; left: ${left}%; top: ${top}%; position: absolute;`
        }
      });
      
      wx.setNavigationBarTitle({
        title: `Card #${c.id}`
      });
    }
  }
})
