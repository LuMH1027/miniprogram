/* eslint-disable no-param-reassign */
import { getPrice } from '../../../services/good/spu';
import { getAllSpuOfCate, getCates } from '../../../services/cate/cate';
import { fetchCartItems, createCartItem, updateCartItemCount } from '../../../services/cart/cart';
import { getAllSku } from '../../../services/sku/sku';
import { getCloudImageTempUrl } from '../../../utils/cloudImageHandler';
import { LIST_LOADING_STATUS } from '../../../utils/listLoading';
import { cartShouldFresh } from '../../../utils/cartFresh';
import Toast from 'tdesign-miniprogram/toast/index';

const initFilters = {
  overall: 1,
  sorts: '',
  layout: 0,
};

Page({
  data: {
    goodsList: [],
    layout: 0,
    sorts: '',
    overall: 1,
    show: false,
    minVal: '',
    maxVal: '',
    filter: initFilters,
    hasLoaded: false,
    loadMoreStatus: 0,
    loading: true,
    goodsListLoadStatus: LIST_LOADING_STATUS.READY,
  },

  pageNum: 1,
  pageSize: 30,
  total: 0,

  handleFilterChange(e) {
    const { layout, overall, sorts } = e.detail;
    this.pageNum = 1;
    this.setData({
      layout,
      sorts,
      overall,
      loadMoreStatus: 0,
    });
    this.init(true);
  },

  generalQueryData(reset = false) {
    const { filter, keywords, minVal, maxVal } = this.data;
    const { pageNum, pageSize } = this;
    const { sorts, overall } = filter;
    const params = {
      sort: 0, // 0 综合，1 价格
      pageNum: 1,
      pageSize: 30,
      keyword: keywords,
    };

    if (sorts) {
      params.sort = 1;
      params.sortType = sorts === 'desc' ? 1 : 0;
    }

    if (overall) {
      params.sort = 0;
    } else {
      params.sort = 1;
    }
    params.minPrice = minVal ? minVal * 100 : 0;
    params.maxPrice = maxVal ? maxVal * 100 : undefined;
    if (reset) return params;
    return {
      ...params,
      pageNum: pageNum + 1,
      pageSize,
    };
  },

  async init(reset = true) {
    this.loadGoodsList(reset);
  },

  async loadGoodsList() {
    this.setData({ goodsListLoadStatus: LIST_LOADING_STATUS.LOADING });

    try {
      let goodsList = [];

      if (this.cateMode === 'all') {
        const allCates = await getCates();
        const childCateIds = allCates.flatMap((cate) => (cate.child_cate || []).map((x) => x._id));
        const allSpuResult = await Promise.all(childCateIds.map((id) => getAllSpuOfCate(id).catch(() => ({ spu: [] }))));
        const spuMap = new Map();
        allSpuResult.forEach(({ spu = [] }) => {
          spu.forEach((item) => {
            if (!spuMap.has(item._id)) {
              spuMap.set(item._id, item);
            }
          });
        });
        goodsList = Array.from(spuMap.values());
      } else if (this.cateIds.length > 1) {
        const allSpuResult = await Promise.all(this.cateIds.map((id) => getAllSpuOfCate(id).catch(() => ({ spu: [] }))));
        const spuMap = new Map();
        allSpuResult.forEach(({ spu = [] }) => {
          spu.forEach((item) => {
            if (!spuMap.has(item._id)) {
              spuMap.set(item._id, item);
            }
          });
        });
        goodsList = Array.from(spuMap.values());
      } else {
        const { spu } = await getAllSpuOfCate(this.cateId);
        goodsList = spu;
      }

      goodsList.sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0));
      const images = goodsList.map((x) => x.cover_image);
      const handledImages = await getCloudImageTempUrl(images);
      handledImages.forEach((image, index) => (goodsList[index].cover_image = image));
      await Promise.all(goodsList.map(async (spu) => (spu.price = await getPrice(spu._id))));

      this.setData({
        goodsList,
        // TODO: add pagination
        goodsListLoadStatus: LIST_LOADING_STATUS.NO_MORE,
      });
    } catch (err) {
      console.error('error', err);
      this.setData({ goodsListLoadStatus: LIST_LOADING_STATUS.FAILED });
    }
  },
  cateId: null,
  cateIds: [],
  cateMode: 'single',

  onLoad(query) {
    const { cateId, cateIds } = query || {};
    if (typeof cateIds === 'string') {
      if (cateIds === 'all') {
        this.cateMode = 'all';
      } else {
        const ids = cateIds.split(',').filter(Boolean);
        this.cateIds = ids;
        this.cateId = ids[0];
        this.cateMode = ids.length > 1 ? 'multi' : 'single';
      }
    } else if (typeof cateId === 'string') {
      this.cateId = cateId;
      this.cateIds = [cateId];
      this.cateMode = 'single';
    } else {
      this.cateMode = 'all';
    }

    this.init(true);
  },

  onReachBottom() {
    const { goodsList } = this.data;
    const { total = 0 } = this;
    if (goodsList.length === total) {
      this.setData({
        loadMoreStatus: 2,
      });
      return;
    }
    this.init(false);
  },

  async handleAddCart(e) {
    const spuId = e?.detail?.goods?._id;
    if (!spuId) return;

    try {
      const [pickedSku] = await getAllSku(spuId);
      if (!pickedSku) {
        throw new Error('sku empty');
      }
      const records = await fetchCartItems();
      const cartItem = records.find((x) => x.sku._id === pickedSku._id);
      if (cartItem) {
        await updateCartItemCount({ cartItemId: cartItem._id, count: cartItem.count + 1 });
      } else {
        await createCartItem({ skuId: pickedSku._id, count: 1 });
      }
      cartShouldFresh();
      Toast({
        context: this,
        selector: '#t-toast',
        message: '已加入点单车',
        icon: '',
      });
    } catch (err) {
      console.error(err);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '加入点单车失败',
        icon: '',
      });
    }
  },

  tagClickHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击标签',
    });
  },

  gotoGoodsDetail(e) {
    const spuId = e?.detail?.goods?._id;
    if (typeof spuId !== 'string') return;

    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    });
  },

  showFilterPopup() {
    this.setData({
      show: true,
    });
  },

  showFilterPopupClose() {
    this.setData({
      show: false,
    });
  },

  onMinValAction(e) {
    const { value } = e.detail;
    this.setData({ minVal: value });
  },

  onMaxValAction(e) {
    const { value } = e.detail;
    this.setData({ maxVal: value });
  },

  reset() {
    this.setData({ minVal: '', maxVal: '' });
  },

  confirm() {
    const { minVal, maxVal } = this.data;
    let message = '';
    if (minVal && !maxVal) {
      message = `价格最小是${minVal}`;
    } else if (!minVal && maxVal) {
      message = `价格范围是0-${minVal}`;
    } else if (minVal && maxVal && minVal <= maxVal) {
      message = `价格范围${minVal}-${this.data.maxVal}`;
    } else {
      message = '请输入正确范围';
    }
    if (message) {
      Toast({
        context: this,
        selector: '#t-toast',
        message,
      });
    }
    this.pageNum = 1;
    this.setData(
      {
        show: false,
        minVal: '',
        goodsList: [],
        loadMoreStatus: 0,
        maxVal: '',
      },
      () => {
        this.init();
      },
    );
  },
});
