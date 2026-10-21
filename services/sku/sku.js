import { model, getAll } from '../_utils/model';
import { DATA_MODEL_KEY } from '../../config/model';
import { cloudbaseTemplateConfig } from '../../config/index';
import { SKU, SPU } from '../cloudbaseMock/index';
import { getAllAttrValues } from '../attrValue/attrValue';

const SKU_MODEL_KEY = DATA_MODEL_KEY.SKU;

function normalizeSku(sku) {
  if (!sku) throw new Error('菜品规格不存在');
  const count = Number(sku.count ?? sku.stock?.count ?? 0);
  return { ...sku, count: Number.isInteger(count) && count >= 0 ? count : 0 };
}

/**
 *
 * @param {String} skuId
 */
export async function getSkuDetail(skuId) {
  if (cloudbaseTemplateConfig.useMock) {
    const sku = normalizeSku(SKU.find((x) => x._id === skuId));
    return {
      ...sku,
      attr_value: await getAllAttrValues(skuId),
      spu: SPU.find((spu) => spu._id === sku.spu._id),
    };
  }

  const { data } = await model()[SKU_MODEL_KEY].get({
    filter: {
      where: {
        _id: { $eq: skuId },
      },
    },
    select: {
      _id: true,
      count: true,
      price: true,
      image: true,
      attr_value: {
        value: true,
        _id: true,
      },
      spu: {
        name: true,
      },
    },
  });
  return normalizeSku(data);
}

export async function updateSku({ skuId, data }) {
  if (!Number.isInteger(data.count) || data.count < 0) throw new Error('库存数量无效');
  if (cloudbaseTemplateConfig.useMock) {
    const sku = SKU.find((x) => x._id === skuId);
    if (!sku) throw new Error('菜品规格不存在');
    sku.count = data.count;
    if (sku.stock) sku.stock.count = data.count;
    return;
  }

  return wx.cloud.callFunction({
    // 云函数名称
    name: 'shop_update_sku',
    // 传给云函数的参数
    data: {
      skuId,
      data,
    },
  });
}

export async function getAllSku(spuId) {
  if (cloudbaseTemplateConfig.useMock) {
    return SKU.filter((x) => x.spu._id === spuId).map(normalizeSku);
  }
  const skus = await getAll({
    name: SKU_MODEL_KEY,
    filter: {
      where: {
        spu: {
          $eq: spuId,
        },
      },
    },
  });
  return skus.map(normalizeSku);
}
