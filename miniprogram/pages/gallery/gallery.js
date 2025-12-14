// pages/gallery/gallery.js
const bgaData = require('../../data/bgaCardData.js');
const speciesData = require('../../data/speciesData.js');

Page({
  data: {
    cards: [],
    viewMode: 'image',
    previewCard: null
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

    // Determine Sprite Grid Dimensions based on file heuristic
    const defaultSpriteByType = {
      H_CARD: toRemote('/images/cards/hcards.jpg'),
      V_CARD: toRemote('/images/cards/vcards.jpg'),
      W_CARD: toRemote('/images/cards/trees.jpg'),
      TREE: toRemote('/images/cards/trees.jpg')
    };

    // Sprite sheet geometry (from forestshuffle CSS background-size)
    const spriteGridByFile = {
      'trees.webp': { cols: 5, rows: 5 },
      'trees.jpg': { cols: 5, rows: 5 },
      'hcards.webp': { cols: 7, rows: 7 },
      'hcards.jpg': { cols: 7, rows: 7 },
      'vcards.webp': { cols: 7, rows: 7 },
      'vcards.jpg': { cols: 7, rows: 7 },
      'mountain.webp': { cols: 7, rows: 4 },
      'mountain.jpg': { cols: 7, rows: 4 },
      'woodlands.jpg': { cols: 6, rows: 6 }
    };

    const resolveImg = (card) => {
      if (card.img && card.img.trim()) {
        return toRemote(card.img.trim());
      }
      return defaultSpriteByType[card.type] || defaultSpriteByType.TREE;
    };

    const getGrid = (img, type) => {
      const fname = img.split('/').pop().toLowerCase();

      // Mountain sheet actual size 2100x1864 (7 cols x 4 rows)
      if (fname.includes('mountain')) {
        return { cols: 7, rows: 4, mountain: true };
      }

      if (spriteGridByFile[fname]) return spriteGridByFile[fname];
      // fallbacks by type
      if (type === 'H_CARD') return spriteGridByFile['hcards.jpg'];
      if (type === 'V_CARD') return spriteGridByFile['vcards.jpg'];
      return { cols: 7, rows: 7 };
    };

    const quantizeIndex = (valuePct, divisions) => {
      // Snap parsed percentage to closest cell index to match CSS background-position steps
      const step = 100 / (divisions - 1);
      return Math.round(valuePct / step);
    };

    const parsePct = (s) => parseFloat(s) || 0;

    const normalizeKey = (value = '') => value.replace(/[^A-Za-z0-9]/g, '');
    // Create a case-insensitive map for easier lookup
    const speciesDataMap = {};
    const byName = speciesData.byName || {};
    const byConst = speciesData.byConst || {};
    
    // Helper to add to map
    const addToMap = (source) => {
      Object.keys(source).forEach(key => {
        const lowerKey = key.toLowerCase();
        // Don't overwrite if exists to prioritize one source if needed, or overwrite if desired
        if (!speciesDataMap[lowerKey]) {
          speciesDataMap[lowerKey] = source[key];
        }
        // Also add the original key just in case
        speciesDataMap[key] = source[key];
      });
    };

    addToMap(byName);
    addToMap(byConst);

    const findSpeciesMeta = (code = '') => {
      if (!code) return null;
      const lower = code.toLowerCase();
      // Prefer the lower-cased key so we pick the localized byName entry
      return speciesDataMap[lower] || speciesDataMap[code] || null;
    };

    const cards = Object.values(bgaData.cards).map(c => {
      const img = resolveImg(c);
      const grid = getGrid(img, c.type);

      let width, height, left, top;
      const { cols, rows } = grid;
      width = cols * 100;
      height = rows * 100;

      // Snap everything (including mountain cards) to the closest sprite cell.
      // Mountain data from BGA uses slightly off percentages (e.g., 42.857%)
      // while the sprite sheet is arranged as a clean 7x4 grid, so quantizing
      // keeps the positions aligned with the actual sheet.
      const xIndex = quantizeIndex(parsePct(c.x), cols);
      const yIndex = quantizeIndex(parsePct(c.y), rows);
      left = -1 * xIndex * 100;
      top = -1 * yIndex * 100;

      const tagMap = {
        'Tree': '树',
        'tree': '树',
        'Plant': '植物',
        'plant': '植物',
        'Mushroom': '蘑菇',
        'mushroom': '蘑菇',
        'Bird': '鸟类',
        'bird': '鸟类',
        'Insect': '昆虫',
        'insect': '昆虫',
        'Butterfly': '蝴蝶',
        'butterfly': '蝴蝶',
        'Amphibian': '两栖动物',
        'amphibian': '两栖动物',
        'Paw': '兽类',
        'paw': '兽类',
        'Bat': '蝙蝠',
        'bat': '蝙蝠',
        'Deer': '鹿',
        'deer': '鹿',
        'Cloven-hoofed animal': '偶蹄动物',
        'cloven-hoofed animal': '偶蹄动物',
        'Mountain': '山脉',
        'mountain': '山脉',
        'Woodland Edge': '林缘',
        'woodland edge': '林缘',
        'Shrub': '灌木',
        'shrub': '灌木'
      };

      const speciesDetails = (c.species || []).map(code => {
        const meta = findSpeciesMeta(code) || {};
        const rawTags = (meta.tags && meta.tags.length) ? meta.tags : (meta.tags_en || []);
        // Map tags to Chinese if available in map, otherwise keep original
        const tags = rawTags.map(t => {
          const key = (t || '').trim();
          const lowerKey = key.toLowerCase();
          return tagMap[key] || tagMap[lowerKey] || key;
        });

        return {
          key: code,
          displayName: meta.name || meta.name_en || code,
          tags: tags,
          cost: meta.cost,
          type: meta.type,
          nb: meta.nb,
          effect: meta.effect || '',
          bonus: meta.bonus || '',
          points: meta.points || meta.points_en || ''
        };
      });

      const typeMap = {
        'TREE': '树',
        'H_CARD': '动物',
        'V_CARD': '动物',
        'W_CARD': '林缘'
      };

      const primaryName = speciesDetails.length
        ? speciesDetails.map(s => s.displayName).join(' / ')
        : (c.species || []).join(' / ');

      return {
        ...c,
        img,
        spriteStyle: `width: ${width}%; height: ${height}%; left: ${left}%; top: ${top}%; position: absolute;`,
        speciesDetails,
        primaryName,
        typeZh: typeMap[c.type] || c.type
      };
    }).reduce((acc, card) => {
      // Deduplicate identical visuals so the gallery only shows one copy of each card face
      const key = [
        card.type,
        card.img,
        card.x,
        card.y,
        (card.species || []).join(',')
      ].join('|');
      if (!acc.map.has(key)) {
        acc.list.push(card);
        acc.map.set(key, true);
      }
      return acc;
    }, { list: [], map: new Map() }).list;

    this.setData({
      cards: cards,
      viewMode: 'image'
    });
  },

  onPreviewCard: function(e) {
    const id = e.currentTarget.dataset.id;
    const card = this.data.cards.find(c => String(c.id) === String(id));
    if (card) {
      this.setData({ previewCard: card });
    }
  },

  onClosePreview: function() {
    this.setData({ previewCard: null });
  },

  noop: function() {}
})
