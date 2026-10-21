/* eslint-disable no-param-reassign */
import { getPrice } from '../../../services/good/spu';
import { getAllSpuOfCate, getCates } from '../../../services/cate/cate';
import { getCloudImageTempUrl } from '../../../utils/cloudImageHandler';
import { LIST_LOADING_STATUS } from '../../../utils/listLoading';

Page({
  data: {
    goodsList: [],
    hasLoaded: false,
    loadMoreStatus: 0,
    goodsListLoadStatus: LIST_LOADING_STATUS.READY,
  },

  pageNum: 1,
  pageSize: 30,
  total: 0,

  async init(reset = true) {
    this.loadGoodsList(reset);
  },

  async loadGoodsList() {
    if (this.data.goodsListLoadStatus === LIST_LOADING_STATUS.LOADING) return;
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
        hasLoaded: true,
        // TODO: add pagination
        goodsListLoadStatus: LIST_LOADING_STATUS.NO_MORE,
      });
    } catch (err) {
      console.error('error', err);
      this.setData({ goodsListLoadStatus: LIST_LOADING_STATUS.FAILED, hasLoaded: true });
    }
  },
  cateId: null,
  cateIds: [],
  cateMode: 'single',

  onLoad(query) {
    const { cateId, cateIds, title } = query || {};
    let categoryTitle = title || '全部菜品';
    try {
      categoryTitle = decodeURIComponent(categoryTitle);
    } catch (error) {
      console.warn('[goods-list:invalid-title]', error);
    }
    this.setData({ categoryTitle });
    wx.setNavigationBarTitle({ title: categoryTitle });
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

  onReachBottom() {},

  onReTry() {
    this.loadGoodsList();
  },

  handleAddCart(e) {
    this.gotoGoodsDetail(e);
  },

  gotoGoodsDetail(e) {
    const spuId = e?.detail?.goods?._id;
    if (typeof spuId !== 'string') return;

    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    });
  },

});
