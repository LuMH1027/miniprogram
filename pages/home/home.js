/* eslint-disable no-param-reassign */
import { getHomeSwiper } from '../../services/home/home';
import { getCates } from '../../services/cate/cate';
import { listGood, getPrice } from '../../services/good/spu';
import { getCloudImageTempUrl } from '../../utils/cloudImageHandler';
import { LIST_LOADING_STATUS } from '../../utils/listLoading';

Page({
  data: {
    imgSrcs: [],
    quickCategories: [
      { key: 'milkTea', title: '喝杯奶茶', icon: 'shop' },
      { key: 'dessert', title: '来点甜品', icon: 'heart' },
      { key: 'meal', title: '好好吃饭', icon: 'time' },
      { key: 'all', title: '全部菜品', icon: 'app' },
    ],
    tabList: [],
    goodsList: [],
    goodsListLoadStatus: LIST_LOADING_STATUS.READY,
    pageLoading: false,
    current: 1,
    autoplay: true,
    duration: '500',
    interval: 5000,
    navigation: { type: 'dots' },
    swiperImageProps: { mode: 'scaleToFill' }
  },

  goodListPagination: {
    index: 1,
    num: 20,
  },

  privateData: {
    tabIndex: 0,
  },

  onShow() {
    this.getTabBar().init();
  },

  onLoad() {
    this.init();
  },

  onReachBottom() {
    if (this.data.goodsListLoadStatus === LIST_LOADING_STATUS.READY) {
      this.loadGoodsList();
    }
  },

  onPullDownRefresh() {
    this.init();
  },

  async init() {
    wx.stopPullDownRefresh();

    this.setData({
      pageLoading: false,
    });

    if (this.data.goodsListLoadStatus !== LIST_LOADING_STATUS.LOADING) this.loadGoodsList(true);
    this.loadHomeSwiper();
  },

  async loadHomeSwiper() {
    try {
      const { images } = await getHomeSwiper();
      const handledImages = images.length ? await getCloudImageTempUrl(images) : [];
      this.setData({ imgSrcs: handledImages });
    } catch (error) {
      console.error('[home:load-swiper:failed]', error);
      this.setData({ imgSrcs: [] });
    }
  },

  onReTry() {
    this.loadGoodsList();
  },

  async loadGoodsList(fresh = false) {
    if (this.data.goodsListLoadStatus === LIST_LOADING_STATUS.LOADING) return;
    this.goodListPagination = this.goodListPagination || { index: 1, num: 20 };
    if (fresh) {
      wx.pageScrollTo({
        scrollTop: 0,
      });
    }

    this.setData({ goodsListLoadStatus: LIST_LOADING_STATUS.LOADING });

    const pageSize = this.goodListPagination.num;
    const pageIndex = fresh ? 1 : this.goodListPagination.index;

    try {
      const { records: nextList, total } = await listGood({ pageNumber: pageIndex, pageSize });
      const images = nextList.map((x) => x.cover_image);
      const handledImages = await getCloudImageTempUrl(images);
      handledImages.forEach((image, index) => (nextList[index].cover_image = image));
      await Promise.all(nextList.map(async (spu) => (spu.price = await getPrice(spu._id).catch(() => 0.01))));

      const goodsList = fresh ? nextList : this.data.goodsList.concat(nextList);

      this.setData({
        goodsList,
        goodsListLoadStatus: goodsList.length >= total ? LIST_LOADING_STATUS.NO_MORE : LIST_LOADING_STATUS.READY,
      });

      this.goodListPagination.index = pageIndex + 1;
      this.goodListPagination.num = pageSize;
    } catch (err) {
      console.error('error', err);
      this.setData({ goodsListLoadStatus: LIST_LOADING_STATUS.FAILED });
    }
  },

  goodListClickHandle(e) {
    const spuId = e?.detail?.goods?._id;
    if (typeof spuId !== 'string') return;
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    });
  },

  goodListAddCartHandle(e) {
    const spuId = e?.detail?.goods?._id;
    if (typeof spuId !== 'string') return;
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    });
  },

  navToSearchPage() {
    wx.navigateTo({ url: '/pages/goods/search/index' });
  },

  navToCategories() {
    wx.switchTab({ url: '/pages/goods/category/index' });
  },

  async navToCategory(e) {
    if (this._openingCategory) return;
    this._openingCategory = true;
    try {
      const key = e.currentTarget.dataset.key;
      const category = this.data.quickCategories.find((item) => item.key === key);
      const names = { milkTea: '奶茶', dessert: '甜品', meal: '饭饭' };
      let cateId = 'all';
      if (names[key]) {
        const cates = await getCates();
        const matched = cates.flatMap((item) => item.child_cate || []).find((item) => String(item.name || '').includes(names[key]));
        if (!matched) throw new Error('Category not available');
        cateId = matched._id;
      }
      wx.navigateTo({ url: `/pages/goods/list/index?cateIds=${encodeURIComponent(cateId)}&title=${encodeURIComponent(category.title)}` });
    } catch (error) {
      console.error('[home:open-category:failed]', error);
      wx.showToast({ title: '菜单暂时没加载出来，请重试', icon: 'none' });
    } finally {
      this._openingCategory = false;
    }
  },

  navToActivityDetail({ detail }) {
    console.info('[phase-2-hidden-entry]', 'home-promotion', detail);
  }
});
