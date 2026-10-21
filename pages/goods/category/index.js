import Toast from 'tdesign-miniprogram/toast/index';
import { getCates } from '../../../services/cate/cate';

const FIXED_CATEGORY_CONFIG = [
  { key: 'all', title: '全部菜品', hint: '今天的喜欢，都在这里', icon: 'app', keywords: [] },
  { key: 'milkTea', title: '喝杯饮料', hint: '给日常加一点甜', icon: 'shop', keywords: ['饮料', '奶茶'] },
  { key: 'dessert', title: '来点甜品', hint: '留一点胃口给快乐', icon: 'heart', keywords: ['甜品'] },
  { key: 'meal', title: '好好吃饭', hint: '再忙也要按时吃饭', icon: 'time', keywords: ['饭饭'] },
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
    loading: true,
    loadFailed: false,
  },
  async init() {
    this.setData({ loading: true, loadFailed: false });
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
      this.setData({ loadFailed: true });
      Toast({
        context: this,
        selector: '#t-toast',
        message: '获取菜品分类列表失败',
        duration: 1000,
        icon: '',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  openCategory(category) {
    wx.navigateTo({ url: `/pages/goods/list/index?cateIds=${encodeURIComponent(category.cateId)}&title=${encodeURIComponent(category.title)}` });
  },

  onShow() {
    this.getTabBar().init();
  },

  onCategoryTap(e) {
    const category = this.data.fixedCategories.find((item) => item.key === e.currentTarget.dataset.key);
    if (category) this.openCategory(category);
  },

  onLoad() {
    this.init(true);
  },
});
