import Toast from 'tdesign-miniprogram/toast/index';
import { getCates } from '../../../services/cate/cate';

const FIXED_CATEGORY_CONFIG = [
  { key: 'all', title: '全部', keywords: [] },
  { key: 'milkTea', title: '奶茶', keywords: ['奶茶'] },
  { key: 'dessert', title: '甜品', keywords: ['甜品'] },
  { key: 'meal', title: '饭饭', keywords: ['饭饭'] },
];

function matchCateByKeywords(cates, keywords = [], usedIds = new Set()) {
  if (!keywords.length) return null;
  const matched = cates.find(
    (item) => !usedIds.has(item._id) && keywords.some((keyword) => String(item.name || '').includes(keyword)),
  );
  if (matched) usedIds.add(matched._id);
  return matched;
}

Page({
  data: {
    fixedCategories: [],
  },
  async init() {
    try {
      const cates = await getCates();
      const childCates = cates.flatMap((x) => x.child_cate || []);
      const usedIds = new Set();

      const fixedCategories = FIXED_CATEGORY_CONFIG.map((config) => {
        if (config.key === 'all') {
          return { ...config, cateId: 'all' };
        }
        const matched = matchCateByKeywords(childCates, config.keywords, usedIds);
        return {
          ...config,
          cateId: matched?._id || 'all',
        };
      });

      this.setData({ fixedCategories });
    } catch (e) {
      console.error('获取菜品分类列表失败', e);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '获取菜品分类列表失败',
        duration: 1000,
        icon: '',
      });
    }
  },

  onShow() {
    this.getTabBar().init();
  },

  onCategoryTap(e) {
    const cateId = e?.currentTarget?.dataset?.cateId || 'all';
    wx.navigateTo({
      url: `/pages/goods/list/index?cateIds=${cateId}`,
    });
  },

  onLoad() {
    this.init(true);
  },
});
