import { model, getAll } from '../../services/_utils/model';
import { DATA_MODEL_KEY } from '../../config/model';
import { cloudbaseTemplateConfig } from '../../config/index';
import { ORDER, createId, DELIVERY_INFO } from '../cloudbaseMock/index';

const ORDER_MODEL_KEY = DATA_MODEL_KEY.ORDER;
let mockOrderSequence = 0;
const MOCK_ORDER_STORAGE_KEY = 'MOCK_ORDER_RECORDS';

function hydrateMockOrders() {
  if (typeof wx === 'undefined' || !wx.getStorageSync) return;
  const records = wx.getStorageSync(MOCK_ORDER_STORAGE_KEY);
  if (!Array.isArray(records)) return;
  ORDER.splice(0, ORDER.length, ...records);
  mockOrderSequence = records.reduce((max, item) => Math.max(max, item.mockSequence || 0), mockOrderSequence);
}

function persistMockOrders() {
  if (typeof wx === 'undefined' || !wx.setStorageSync) return;
  wx.setStorageSync(MOCK_ORDER_STORAGE_KEY, ORDER);
}

const ORDER_STATUS_INFO = {
  TO_PAY: { value: 'TO_PAY', label: '待付款' },
  TO_SEND: { value: 'TO_SEND', label: '制作中' },
  TO_RECEIVE: { value: 'TO_RECEIVE', label: '待取餐' },
  FINISHED: { value: 'FINISHED', label: '已完成' },
  CANCELED: { value: 'CANCELED', label: '已取消' },
  RETURN_APPLIED: { value: 'RETURN_APPLIED', label: '售后申请中' },
  RETURN_REFUSED: { value: 'RETURN_REFUSED', label: '售后已拒绝' },
  RETURN_FINISH: { value: 'RETURN_FINISH', label: '售后完成' },
  RETURN_MONEY_REFUSED: { value: 'RETURN_MONEY_REFUSED', label: '拒绝退款' },
};

export const ORDER_STATUS = new Proxy(ORDER_STATUS_INFO, {
  get(target, prop) {
    return target[prop]?.value;
  },
});

export const orderStatusToName = (status) => Object.values(ORDER_STATUS_INFO).find((x) => x.value === status)?.label;

/**
 *
 * @param {{
 *   status: String,
 *   addressId: String,
 *   remark?: String
 * }} param0
 * @returns
 */
export async function createOrder({ status, addressId, remark = '' }) {
  const normalizedRemark = typeof remark === 'string' ? remark : '';
  if (cloudbaseTemplateConfig.useMock) {
    hydrateMockOrders();
    const _id = createId();
    ORDER.push({
      status,
      remark: normalizedRemark,
      delivery_info: {
        _id: addressId,
      },
      _id,
      createdAt: new Date().getTime(),
      mockSequence: ++mockOrderSequence,
    });
    persistMockOrders();
    console.info('[order:create:mock]', {
      orderId: _id,
      totalOrders: ORDER.length,
      orderIds: ORDER.map((order) => order._id),
    });
    return { id: _id };
  }
  return (
    await model()[ORDER_MODEL_KEY].create({
      data: {
        status,
        remark: normalizedRemark,
        delivery_info: {
          _id: addressId,
        },
      },
    })
  ).data;
}

export function getAllOrder() {
  return getAll({
    name: ORDER_MODEL_KEY,
  });
}

/**
 *
 * @param {{
 *   pageSize: Number,
 *   pageNumber: Number,
 *   status?: String
 * }}} param0
 * @returns
 */
export async function listOrder({ pageSize, pageNumber, status }) {
  if (cloudbaseTemplateConfig.useMock) {
    hydrateMockOrders();
    const filteredOrder = (status == null ? ORDER : ORDER.filter((x) => x.status === status))
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || (b.mockSequence || 0) - (a.mockSequence || 0));
    const startIndex = (pageNumber - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const records = filteredOrder.slice(startIndex, endIndex);
    const total = filteredOrder.length;
    console.info('[order:list:mock]', {
      status,
      pageSize,
      pageNumber,
      total,
      recordIds: records.map((order) => order._id),
      allIds: filteredOrder.map((order) => order._id),
    });
    return {
      records,
      total,
    };
  }

  if (status != null) {
    return (
      await model()[ORDER_MODEL_KEY].list({
        filter: {
          where: {
            status: {
              $eq: status,
            },
          },
        },
        pageSize,
        pageNumber,
        getCount: true,
      })
    ).data;
  }
  return (
    await model()[ORDER_MODEL_KEY].list({
      filter: {},
      pageSize,
      pageNumber,
      getCount: true,
    })
  ).data;
}

async function getOrderCountOfStatus(status) {
  if (cloudbaseTemplateConfig.useMock) {
    return ORDER.filter((x) => x.status === status).length;
  }

  return (
    await model()[ORDER_MODEL_KEY].list({
      filter: { where: { status: { $eq: status } } },
      select: { _id: true },
      getCount: true,
    })
  ).data.total;
}

export async function getToPayOrderCount() {
  return getOrderCountOfStatus(ORDER_STATUS.TO_PAY);
}

export async function getToSendOrderCount() {
  return getOrderCountOfStatus(ORDER_STATUS.TO_SEND);
}

export async function getToReceiveOrderCount() {
  return getOrderCountOfStatus(ORDER_STATUS.TO_RECEIVE);
}

export async function getFinishedOrderCount() {
  return getOrderCountOfStatus(ORDER_STATUS.FINISHED);
}

/**
 *
 * @param {String} orderId
 */
export async function getOrder(orderId) {
  if (cloudbaseTemplateConfig.useMock) {
    hydrateMockOrders();
    const order = ORDER.find(o => o._id === orderId);
    order.delivery_info = DELIVERY_INFO.find(i => i._id === order.delivery_info._id)
    return order
  }
  return (
    await model()[ORDER_MODEL_KEY].get({
      filter: {
        where: {
          _id: { $eq: orderId },
        },
      },
      select: {
        $master: true,
        delivery_info: {
          _id: true,
          phone: true,
          address: true,
          name: true,
        },
      },
    })
  ).data;
}

export async function updateOrderDeliveryInfo({ orderId, deliveryInfoId }) {
  return model()[ORDER_MODEL_KEY].update({
    data: {
      delivery_info: {
        _id: deliveryInfoId,
      },
    },
    filter: {
      where: {
        _id: {
          $eq: orderId,
        },
      },
    },
  });
}

/**
 *
 * @param {{orderId: String, status: String, expectedStatus?: String}}} param0
 * @returns
 */
export async function updateOrderStatus({ orderId, status, expectedStatus }) {
  if (cloudbaseTemplateConfig.useMock) {
    hydrateMockOrders();
    const order = ORDER.find((x) => x._id === orderId);
    if (!order) return Promise.reject({ reason: 'ORDER_NOT_FOUND', orderId });
    if (order.status === status) return;
    if (expectedStatus && order.status !== expectedStatus) {
      console.info('[order:updateStatus:skip]', { orderId, current: order.status, expectedStatus, status });
      return;
    }
    order.status = status;
    persistMockOrders();
    console.info('[order:updateStatus:mock]', {
      orderId,
      status,
      totalOrders: ORDER.length,
      orderIds: ORDER.map((item) => item._id),
    });
    return;
  }
  if (expectedStatus) {
    const currentOrder = await getOrder(orderId);
    if (currentOrder.status === status) return;
    if (currentOrder.status !== expectedStatus) {
      console.info('[order:updateStatus:skip]', { orderId, current: currentOrder.status, expectedStatus, status });
      return;
    }
  }
  return await model()[ORDER_MODEL_KEY].update({
    data: {
      status,
    },
    filter: {
      where: {
        _id: {
          $eq: orderId,
        },
      },
    },
  });
}
