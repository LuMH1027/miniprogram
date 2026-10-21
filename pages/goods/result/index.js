/* eslint-disable no-param-reassign */
import { listGood, getPrice } from '../../../services/good/spu';
import { getCloudImageTempUrl } from '../../../utils/cloudImageHandler';
import { LIST_LOADING_STATUS } from '../../../utils/listLoading';

Page({
  data: {
    goodsList: [],
    hasLoaded: false,
    keywords: '',
    loadMoreStatus: 0,
  },

  total: 0,
  pageNum: 1,
  pageSize: 30,

  onLoad(options) {
    const { searchValue = '' } = options || {};
    this.setData(
      {
        keywords: searchValue,
      },
      () => {
        this.init(true);
      },
    );
  },

  async init(reset = true) {
    return this.loadGoodsList(reset);
  },

  async loadGoodsList(fresh = false) {
    this.setData({ loadMoreStatus: LIST_LOADING_STATUS.LOADING });

    const pageSize = this.pageSize;
    const pageIndex = fresh ? 1 : this.pageNum;

    try {
      const { records: nextList, total } = await listGood({
        pageNumber: pageIndex,
        pageSize,
        search: this.data.keywords,
      });
      const images = nextList.map((x) => x.cover_image);
      const handledImages = await getCloudImageTempUrl(images);
      handledImages.forEach((image, index) => (nextList[index].cover_image = image));
      await Promise.all(nextList.map(async (spu) => (spu.price = await getPrice(spu._id))));

      const goodsList = fresh ? nextList : this.data.goodsList.concat(nextList);

      this.setData({
        goodsList,
        loadMoreStatus: goodsList.length >= total ? LIST_LOADING_STATUS.NO_MORE : LIST_LOADING_STATUS.READY,
        hasLoaded: true,
      });

      this.pageNum = pageIndex + 1;
    } catch (err) {
      console.log('error', err);
      this.setData({ loadMoreStatus: LIST_LOADING_STATUS.FAILED });
    }
  },

  handleSubmit(e) {
    const keywords = e?.detail?.value ?? '';
    this.setData(
      {
        keywords,
        goodsList: [],
        loadMoreStatus: 0,
        hasLoaded: false,
      },
      () => {
        this.init(true);
      },
    );
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

  gotoGoodsDetail(e) {
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${e.detail.goods._id}`,
    });
  },

});
