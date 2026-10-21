import { model, getAll } from '../../services/_utils/model';
import { getSkuDetail } from '../sku/sku';
import { DATA_MODEL_KEY } from '../../config/model';
import { cloudbaseTemplateConfig } from '../../config/index';
import { ORDER_ITEM, createId } from '../cloudbaseMock/index';

const ORDER_ITEM_MODEL_KEY = DATA_MODEL_KEY.ORDER_ITEM;
const MOCK_ORDER_ITEM_STORAGE_KEY = 'MOCK_ORDER_ITEMS';

function hydrateMockOrderItems() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return;
  const records = wx.getStorageSync(MOCK_ORDER_ITEM_STORAGE_KEY);
  if (!Array.isArray(records)) return;
  ORDER_ITEM.splice(0, ORDER_ITEM.length, ...records);
}

function persistMockOrderItems() {
  if (typeof wx === 'undefined' || !wx.setStorageSync) return;
  wx.setStorageSync(MOCK_ORDER_ITEM_STORAGE_KEY, ORDER_ITEM);
}

export async function getOrderItem(id) {
  return (
    await model()[ORDER_ITEM_MODEL_KEY].get({
      filter: {
        where: {
          _id: {
            $eq: id,
          },
        },
      },
      select: {
        sku: {
          _id: true,
        },
        comment: {
          _id: true,
        },
      },
    })
  ).data;
}

export async function createOrderItem({ count, skuId, orderId }) {
  if (cloudbaseTemplateConfig.useMock) {
    hydrateMockOrderItems();
    ORDER_ITEM.push({
      _id: createId(),
      count,
      order: {
        _id: orderId,
      },
      sku: {
        _id: skuId,
      },
    });
    persistMockOrderItems();
    console.info('[order-item:create:mock]', {
      orderId,
      skuId,
      count,
      totalOrderItems: ORDER_ITEM.length,
    });
    return;
  }
  return model()[ORDER_ITEM_MODEL_KEY].create({
    data: {
      count,
      sku: {
        _id: skuId,
      },
      order: {
        _id: orderId,
      },
    },
  });
}

export function getAllOrderItems() {
  return getAll({ name: ORDER_ITEM_MODEL_KEY });
}

/**
 *
 * @param {{orderId: String}} param0
 */
export async function getAllOrderItemsOfAnOrder({ orderId }) {
  if (cloudbaseTemplateConfig.useMock) {
    hydrateMockOrderItems();
    const orderItems = ORDER_ITEM.filter((orderItem) => orderItem.order._id === orderId);
    await Promise.all(
      orderItems.map(async (orderItem) => {
        const skuId = orderItem.sku._id;
        const sku = await getSkuDetail(skuId);
        orderItem.sku = sku;
      }),
    );
    return orderItems;
  }

  const orderItems = await getAll({
    name: ORDER_ITEM_MODEL_KEY,
    filter: {
      where: {
        order: {
          $eq: orderId,
        },
      },
    },
    select: {
      _id: true,
      count: true,
      sku: {
        _id: true,
      },
    },
  });
  await Promise.all(
    orderItems.map(async (orderItem) => {
      const skuId = orderItem.sku._id;
      const sku = await getSkuDetail(skuId);
      orderItem.sku = sku;
    }),
  );
  return orderItems;
}
