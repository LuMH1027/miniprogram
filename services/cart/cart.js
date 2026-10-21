import { model, getAll } from '../../services/_utils/model';
import { config } from '../../config/index';
import { DATA_MODEL_KEY } from '../../config/model';
import { cloudbaseTemplateConfig } from '../../config/index';
import { CART_ITEM, createId } from '../cloudbaseMock/index';
import { getSkuDetail } from '../sku/sku';

const CATE_ITEM_MODEL_KEY = DATA_MODEL_KEY.CART_ITEM;

/** 获取购物车mock数据 */
function mockFetchCartGroupData(params) {
  const { delay } = require('../_utils/delay');
  const { genCartGroupData } = require('../../model/cart');

  return delay().then(() => genCartGroupData(params));
}

/**
 *
 * @param {{id: string}} param0
 * @returns
 */
export async function getCartItem({ id }) {
  if (cloudbaseTemplateConfig.useMock) {
    const cartItem = CART_ITEM.find((x) => x._id === id);
    if (!cartItem) throw new Error('点单车中已没有这份菜品');
    return { data: { ...cartItem, sku: await getSkuDetail(cartItem.sku._id) } };
  }

  return model()[CATE_ITEM_MODEL_KEY].get({
    filter: {
      where: {
        _id: {
          $eq: id,
        },
      },
    },
    select: {
      _id: true,
      count: true,
      sku: {
        _id: true,
        count: true,
        description: true,
      },
    },
  });
}

export async function fetchCartItems() {
  if (cloudbaseTemplateConfig.useMock) {
    return Promise.all(CART_ITEM.map(async (cartItem) => {
      const sku = await getSkuDetail(cartItem.sku._id);
      return {
        ...cartItem,
        sku,
      };
    }));
  }

  return getAll({
    name: CATE_ITEM_MODEL_KEY,
    select: {
      _id: true,
      count: true,
      sku: {
        _id: true,
        count: true,
        description: true,
      },
    },
  });
}

/**
 *
 * @param {{
 *   skuId: String,
 *   count: Number
 * }} param0
 */
export async function createCartItem({ skuId, count }) {
  if (!Number.isInteger(count) || count < 1) throw new Error('点单数量无效');
  if (cloudbaseTemplateConfig.useMock) {
    const sku = await getSkuDetail(skuId);
    if (count > sku.count) throw new Error('超过可点数量了');
    CART_ITEM.push({ sku: { _id: skuId }, count, _id: createId() });
    return;
  }
  return await model()[CATE_ITEM_MODEL_KEY].create({
    data: {
      count,
      sku: { _id: skuId },
    },
  });
}

/**
 *
 * @param {{cartItemId: string}} param0
 */
export async function deleteCartItem({ cartItemId }) {
  if (cloudbaseTemplateConfig.useMock) {
    const index = CART_ITEM.findIndex((cartItem) => cartItem._id === cartItemId);
    if (index !== -1) CART_ITEM.splice(index, 1);
    return;
  }
  return await model()[CATE_ITEM_MODEL_KEY].delete({
    filter: {
      where: {
        _id: {
          $eq: cartItemId,
        },
      },
    },
  });
}

/**
 *
 * @param {{
 *   cartItemId: String,
 *   count: Number
 * }} param0
 * @returns
 */
export async function updateCartItemCount({ cartItemId, count }) {
  if (!Number.isInteger(count) || count < 1) throw new Error('点单数量无效');
  if (cloudbaseTemplateConfig.useMock) {
    const item = CART_ITEM.find((x) => x._id === cartItemId);
    if (!item) throw new Error('点单车中已没有这份菜品');
    const sku = await getSkuDetail(item.sku._id);
    if (count > sku.count) throw new Error('超过可点数量了');
    item.count = count;
    return;
  }
  return await model()[CATE_ITEM_MODEL_KEY].update({
    data: {
      count,
    },
    filter: {
      where: {
        _id: {
          $eq: cartItemId,
        },
      },
    },
  });
}

/** 获取购物车数据 */
export function fetchCartGroupData(params) {
  if (config.useMock) {
    return mockFetchCartGroupData(params);
  }

  return new Promise((resolve) => {
    resolve('real api');
  });
}
