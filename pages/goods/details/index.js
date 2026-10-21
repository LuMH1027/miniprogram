// 第三方库
import Toast from 'tdesign-miniprogram/toast/index';

// 服务层
import { getAllAttrValues } from '../../../services/attrValue/attrValue';
import { handleSpuCloudImage, getSpu } from '../../../services/good/spu';
import { fetchCartItems, createCartItem, updateCartItemCount } from '../../../services/cart/cart';
import { getAllSku } from '../../../services/sku/sku';

// 工具函数
import { cartShouldFresh } from '../../../utils/cartFresh';
import { getCloudImageTempUrl, getSingleCloudImageTempUrl } from '../../../utils/cloudImageHandler';
import { objectToParamString } from '../../../utils/util';

async function replaceCloudImageWithTempUrl(text) {
  let ret = text;

  // 使用正则表达式匹配所有被双引号包裹的链接
  const regex = /"(cloud:\/\/[^"]*)"/g;
  let match;
  // 使用一个循环来处理所有匹配的链接
  while ((match = regex.exec(ret)) !== null) {
    const originalLink = match[0];
    const pureLink = match[1];
    // 处理链接
    const processedLink = await getSingleCloudImageTempUrl(pureLink);
    // 替换文本中的原始链接
    ret = ret.replace(originalLink, `"${processedLink}"`);
  }

  return ret;
}

const OUT_OPERATE_STATUS = {
  CART: 'cart',
  BUY: 'buy',
  NO: 'no',
};

function sanitizeQuickRemark(value = '') {
  return String(value).replace(/[<>]/g, '').trim();
}

Page({
  data: {
    details: {},
    jumpArray: [
      {
        title: '首页',
        url: '/pages/home/home',
        iconName: 'home',
      },
      {
        title: '点单车',
        url: '/pages/cart/index',
        iconName: 'cart',
        showCartNum: true,
      },
    ],
    isStock: true,
    soldout: false,
    buttonType: 1,
    skuArray: [],
    isSpuSelectPopupShow: false,
    outOperateStatus: OUT_OPERATE_STATUS.NO,
    minSalePrice: 0,
    navigation: { type: 'fraction' },
    current: 0,
    autoplay: true,
    duration: 500,
    interval: 5000,
    loading: false,
    quickRemarkOptions: ['少冰', '少糖', '惊喜一下'],
    selectedQuickRemark: '',
  },

  setLoading() {
    this.setData({ loading: true });
  },
  unsetLoading() {
    this.setData({ loading: false });
  },

  handlePopupHide() {
    this.setData({
      isSpuSelectPopupShow: false,
    });
  },

  showSkuSelectPopup(status) {
    this.setData({
      outOperateStatus: status,
      isSpuSelectPopupShow: true,
    });
  },

  buyItNow() {
    if (this.data.skuArray.length !== 1) return this.showSkuSelectPopup(OUT_OPERATE_STATUS.BUY);
    return this.gotoBuy({
      detail: {
        count: 1,
        pickedSku: this.getDefaultSku(),
      },
    });
  },

  onQuickRemarkTap(e) {
    const value = e?.currentTarget?.dataset?.value || '';
    const sanitized = sanitizeQuickRemark(value);
    const next = this.data.selectedQuickRemark === sanitized ? '' : sanitized;
    this.setData({ selectedQuickRemark: next });
    if (next) {
      this.toast(`已选择：${next}`);
    } else {
      this.toast('已取消快捷备注');
    }
  },

  toAddCart() {
    if (this.data.skuArray.length !== 1) return this.showSkuSelectPopup(OUT_OPERATE_STATUS.CART);
    return this.addCart({
      detail: {
        count: 1,
        pickedSku: this.getDefaultSku(),
      },
    });
  },

  toNav(e) {
    const { url } = e.detail;
    wx.switchTab({
      url: url,
    });
  },

  toast(message) {
    Toast({
      context: this,
      selector: '#t-toast',
      message,
      icon: '',
      duration: 1000,
    });
  },

  getDefaultSku() {
    const { skuArray = [] } = this.data;
    return skuArray[0] || null;
  },

  async addCart({ detail: { count, pickedSku } }) {
    if (this._addingCart) return;
    if (!pickedSku) {
      this.toast('菜品信息还没准备好');
      return;
    }
    count = Number(count);
    if (!Number.isInteger(count) || count < 1) return this.toast('请输入有效的点单数量');
    this._addingCart = true;
    const overCount = () => this.toast('超过可点数量了');
    const addCartSucceed = () => {
      cartShouldFresh();
      this.handlePopupHide();
      this.toast('加入点单车成功');
    };
    const addCartFail = () => this.toast('加入点单车失败');

    try {
      const records = await fetchCartItems();

      const cartItem = records.find((x) => x.sku._id === pickedSku._id);
      // eslint-disable-next-line eqeqeq
      if (cartItem == null) {
        // cart item empty, create
        if (count <= pickedSku.count) {
          await createCartItem({ skuId: pickedSku._id, count }).then(addCartSucceed, addCartFail);
        } else {
          overCount();
        }
      } else {
        // cart item exists, update count
        const finalCount = cartItem.count + count;
        if (finalCount <= pickedSku.count) {
          await updateCartItemCount({ cartItemId: cartItem._id, count: finalCount }).then(addCartSucceed, addCartFail);
        } else {
          overCount();
        }
      }
    } catch (error) {
      console.error('[goods:add-cart:failed]', error);
      addCartFail();
    } finally {
      this._addingCart = false;
    }
  },

  gotoBuy(e) {
    const overCount = () => this.toast('超过可点数量了');
    const buyCount = Number(e.detail.count);
    const pickedSku = e.detail.pickedSku;
    if (!pickedSku) {
      this.toast('菜品信息还没准备好');
      return;
    }
    if (!Number.isInteger(buyCount) || buyCount < 1) return this.toast('请输入有效的点单数量');
    const skuId = pickedSku._id;
    const skuCount = pickedSku.count;
    if (buyCount > skuCount) return overCount();

    wx.navigateTo({
      url: `/pages/order/order-confirm/index?${objectToParamString({
        type: 'direct',
        count: buyCount,
        skuId,
        remark: encodeURIComponent(this.data.selectedQuickRemark),
        remarkSource: this.data.selectedQuickRemark ? 'detail-quick' : '',
      })}`,
    });
  },

  async getInfo(spuId) {
    // pics
    // min price
    // spu title
    // attrs => sku => count + price
    // spu detail
    const spu = await getSpu(spuId);

    const loadSkus = async () => {
      const skus = await getAllSku(spuId);
      const minPrice = skus.reduce((acc, current) => Math.min(acc, current.price), Infinity) * 100;
      const loadSkuAttrValues = async () => {
        return Promise.all(
          skus.map(async (sku) => {
            const attrValues = await getAllAttrValues(sku._id);
            sku.attrValues = attrValues;
          }),
        );
      };
      const handleSkuImages = async () => {
        const images = skus.map((s) => s.image ?? '');
        const handledImages = await getCloudImageTempUrl(images);
        handledImages.forEach((image, index) => (skus[index].image = image));
      };
      await Promise.all([handleSkuImages(), loadSkuAttrValues()]);
      return { skus, minPrice };
    };

    const [, { skus, minPrice }] = await Promise.all([handleSpuCloudImage(spu), loadSkus()]);

    const detail = await replaceCloudImageWithTempUrl(spu.detail);

    this.setData({
      details: {
        images: spu.swiper_images,
        title: spu.name,
      },
      minSalePrice: minPrice,
      detail,
      descPopUpInitProps: {
        skus,
        minPrice,
        spu,
      },
      skuArray: skus,
      isStock: skus.some((sku) => sku.count > 0),
      soldout: !skus.some((sku) => sku.count > 0),
      spu,
    });
  },

  async onLoad(query) {
    const { spuId } = query;
    this.setLoading();
    try {
      await this.getInfo(spuId);
    } catch (e) {
      console.error(e);
      this.toast('获取菜品详情失败');
    } finally {
      this.unsetLoading();
    }
  },
});
