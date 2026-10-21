const test = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/miniprogram.cjs');

test('all menu products expose usable stock and specifications', async () => {
  const r = createRuntime();
  const { SPU } = r.load('services/cloudbaseMock/index.js');
  const { getAllSku, getSkuDetail } = r.load('services/sku/sku.js');
  const { getAllAttrValues } = r.load('services/attrValue/attrValue.js');
  assert.equal(SPU.length, 55);
  for (const spu of SPU) {
    const [sku] = await getAllSku(spu._id);
    assert.equal(sku.count, 999, spu.name);
    const detail = await getSkuDetail(sku._id);
    assert.equal(detail.count, 999, spu.name);
    const attrs = await getAllAttrValues(sku._id);
    assert(attrs.length > 0, spu.name);
    assert(attrs.every(value => value.attr_name?._id && value.value), spu.name);
  }
});

test('real detail page adds an item then increments the same cart entry', async () => {
  const r = createRuntime();
  const detail = r.instance('pages/goods/details/index.js');
  await detail.getInfo('P001_prod');
  await detail.toAddCart();
  const { fetchCartItems } = r.load('services/cart/cart.js');
  let items = await fetchCartItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].count, 1);
  await detail.toAddCart();
  items = await fetchCartItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].count, 2);
});

async function seedCart(r, counts = [1, 1]) {
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const cart = r.load('services/cart/cart.js');
  for (let i = 0; i < counts.length; i++) await cart.createCartItem({ skuId: SKU[i]._id, count: counts[i] });
  return cart.fetchCartItems();
}

function query(url) {
  // WeChat passes encoded query values to onLoad; decode is handled by the page.
  return Object.fromEntries(url.split('?')[1].split('&').map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index), part.slice(index + 1)];
  }));
}

test('every real product can be added through its detail page', async () => {
  const r = createRuntime();
  const { SPU } = r.load('services/cloudbaseMock/index.js');
  for (const spu of SPU) {
    const detail = r.instance('pages/goods/details/index.js');
    await detail.getInfo(spu._id);
    assert.equal(detail.data.soldout, false, spu.name);
    await detail.toAddCart();
  }
  const items = await r.load('services/cart/cart.js').fetchCartItems();
  assert.equal(items.length, 55);
  assert(items.every(item => item.count === 1));
});

test('stock limit includes quantities already in cart and preserves genuine zero stock', async () => {
  const r = createRuntime();
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const stock = r.load('services/sku/sku.js');
  await stock.updateSku({ skuId: SKU[0]._id, data: { count: 2 } });
  const detail = r.instance('pages/goods/details/index.js');
  await detail.getInfo(SKU[0].spu._id);
  await detail.toAddCart(); await detail.toAddCart(); await detail.toAddCart();
  assert.equal((await r.load('services/cart/cart.js').fetchCartItems())[0].count, 2);
  assert(r.messages.includes('超过可点数量了'));
  SKU[0].count = 0;
  SKU[0].stock.count = 999; // Explicit zero must take precedence over fallback stock.
  await detail.getInfo(SKU[0].spu._id);
  assert.equal(detail.data.soldout, true);
  assert.equal((await stock.getSkuDetail(SKU[0]._id)).count, 0);
});

test('rapid duplicate add taps create only one cart entry', async () => {
  const r = createRuntime();
  const detail = r.instance('pages/goods/details/index.js');
  await detail.getInfo('P001_prod');
  await Promise.all([detail.toAddCart(), detail.toAddCart(), detail.toAddCart()]);
  const items = await r.load('services/cart/cart.js').fetchCartItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].count, 1);
});

test('invalid cart quantities and missing product IDs never mutate the cart', async () => {
  const r = createRuntime();
  const [item] = await seedCart(r, [1]);
  const cart = r.load('services/cart/cart.js');
  for (const count of [0, -1, 1.5, NaN, Infinity, 1000]) {
    await assert.rejects(cart.createCartItem({ skuId: item.sku._id, count }));
    await assert.rejects(cart.updateCartItemCount({ cartItemId: item._id, count }));
  }
  await assert.rejects(cart.getCartItem({ id: 'missing' }));
  await assert.rejects(cart.createCartItem({ skuId: 'missing', count: 1 }));
  await cart.deleteCartItem({ cartItemId: 'missing' });
  assert.equal((await cart.fetchCartItems()).length, 1);
  assert.equal((await cart.fetchCartItems())[0].count, 1);
});

test('specification popup initializes real product, emits selected SKU and numeric quantity', async () => {
  const r = createRuntime();
  const detail = r.instance('pages/goods/details/index.js');
  await detail.getInfo('P001_prod');
  const popup = r.instance('pages/goods/details/components/goods-specs-popup/index.js');
  popup.setProperty('initProps', detail.data.descPopUpInitProps);
  assert(popup.data.pickedSku);
  assert.equal(popup.data.max, 999);
  popup.onBlur({ detail: { value: '3' } });
  popup.addCart();
  const event = popup.events.find(event => event.name === 'addCart');
  assert.equal(event.detail.count, 3);
  await detail.addCart({ detail: event.detail });
  assert.equal((await r.load('services/cart/cart.js').fetchCartItems())[0].count, 3);
  for (const value of ['', '0', '-1', '1.5', '1000', 'abc']) {
    popup.onBlur({ detail: { value } });
    assert.equal(popup.data.value, 3);
  }
});

test('multiple specifications require selection and sold-out variants cannot be selected', () => {
  const r = createRuntime();
  const popup = r.instance('pages/goods/details/components/goods-specs-popup/index.js');
  const attr = value => ({ _id: value, value, attr_name: { _id: 'size', name: 'Size' } });
  popup.setProperty('initProps', { spu: { cover_image: 'cover' }, skus: [
    { _id: 'small', count: 2, price: 1, attrValues: [attr('S')] },
    { _id: 'large', count: 3, price: 2, attrValues: [attr('L')] },
    { _id: 'soldout', count: 0, price: 3, attrValues: [attr('XL')] },
  ] });
  popup.addCart();
  assert.equal(popup.events.filter(event => event.name === 'addCart').length, 0);
  popup.clickAttrValue({ target: { dataset: { attrNameIndex: 0, attrValueIndex: 2 } } });
  assert.equal(popup.data.pickedSku, null);
  popup.clickAttrValue({ target: { dataset: { attrNameIndex: 0, attrValueIndex: 1 } } });
  assert.equal(popup.data.pickedSku._id, 'large');
  popup.handleBuyNumChange({ detail: { value: 3 } });
  popup.buyNow();
  assert.equal(popup.events.at(-1).detail.count, 3);
  popup.clickAttrValue({ target: { dataset: { attrNameIndex: 0, attrValueIndex: 0 } } });
  assert.equal(popup.data.max, 2);
  assert.equal(popup.data.value, 2);
});

test('stock changes clamp popup quantity and empty popup data does not crash', () => {
  const r = createRuntime();
  const popup = r.instance('pages/goods/details/components/goods-specs-popup/index.js');
  popup.setData({ spu: null, pickedSku: null });
  popup.setData({ max: 0 });
  assert.equal(popup.data.value, 0);
  popup.setData({ max: 5 });
  assert.equal(popup.data.value, 1);
  popup.setProperty('initProps', { spu: null, skus: [] });
  assert.equal(popup.data.price, 0);
});

test('stepper change and input blur emit the cart ID and numeric quantity', () => {
  const r = createRuntime();
  const group = r.instance('pages/cart/components/cart-group/index.js');
  const event = { detail: { value: '4' }, currentTarget: { dataset: { goods: { _id: 'cart-1' } } }, target: {} };
  group.changeStepper(event); group.input(event);
  assert.equal(group.events.length, 2);
  for (const emitted of group.events) {
    assert.equal(emitted.detail.count, 4);
    assert.equal(emitted.detail.cartItemId, 'cart-1');
  }
});

test('rapid changes to multiple products persist before immediate checkout', async () => {
  const r = createRuntime();
  const items = await seedCart(r);
  const page = r.instance('pages/cart/index.js');
  await page.init();
  for (const [id, count] of [[items[0]._id, 2], [items[1]._id, 3], [items[0]._id, 4]]) {
    page.onQuantityChange({ detail: { cartItemId: id, count } });
  }
  await page.onToSettle();
  const saved = await r.load('services/cart/cart.js').fetchCartItems();
  assert.equal(saved[0].count, 4);
  assert.equal(saved[1].count, 3);
  assert.equal(page.data.selectedCartItemNum, 7);
  assert.equal(r.navigation.length, 1);
  const confirm = r.instance('pages/order/order-confirm/index.js');
  await confirm.onLoad(query(r.navigation[0]));
  assert.equal(confirm.data.readyToSubmit, true);
  assert.equal(confirm.data.totalGoodsCount, 7);
});

test('cart totals and checkout include selected items only and refresh preserves selection', async () => {
  const r = createRuntime();
  const items = await seedCart(r, [2, 3]);
  const page = r.instance('pages/cart/index.js');
  await page.init();
  page.onGoodsSelect({ detail: { goods: items[1] } });
  assert.equal(page.data.selectedCartItemNum, 2);
  assert.equal(page.data.totalAmount, items[0].sku.price * 2);
  await page.init();
  assert.equal(page.data.cartItems[1].selected, false);
  await page.onToSettle();
  assert.equal(query(r.navigation[0]).cartIds, items[0]._id);
  page.onSelectAll();
  assert.equal(page.data.selectedCartItemNum, 5);
  page.onSelectAll();
  await page.onToSettle();
  assert.equal(r.navigation.length, 1);
  assert(r.messages.includes('先勾选想点的菜品'));
});

test('failed quantity save blocks checkout until that item is corrected', async () => {
  const r = createRuntime();
  const [item] = await seedCart(r, [1]);
  const cart = r.load('services/cart/cart.js');
  let fail = true;
  r.override('services/cart/cart.js', { ...cart, async updateCartItemCount(args) {
    if (fail) throw new Error('simulated storage failure');
    return cart.updateCartItemCount(args);
  } });
  const page = r.instance('pages/cart/index.js');
  await page.init();
  page.onQuantityChange({ detail: { cartItemId: item._id, count: 2 } });
  await page.onToSettle();
  assert.equal(r.navigation.length, 0);
  assert.equal(page.data.loading, false);
  fail = false;
  page.onQuantityChange({ detail: { cartItemId: item._id, count: 3 } });
  await page.onToSettle();
  assert.equal(r.navigation.length, 1);
  assert.equal((await cart.fetchCartItems())[0].count, 3);
});

test('delete waits for pending quantity changes and recalculates empty state', async () => {
  const r = createRuntime();
  const [item] = await seedCart(r, [1]);
  const page = r.instance('pages/cart/index.js');
  await page.init();
  page.onQuantityChange({ detail: { cartItemId: item._id, count: 2 } });
  await page.onGoodsDelete({ detail: { goods: item } });
  assert.equal((await r.load('services/cart/cart.js').fetchCartItems()).length, 0);
  assert.equal(page.data.cartItems.length, 0);
  assert.equal(page.data.selectedCartItemNum, 0);
  assert.equal(page.data.totalAmount, 0);
  assert.equal(page.data.allSelected, false);
});

test('direct order submits once, decrements stock, records items and sends cents payload', async () => {
  const r = createRuntime();
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'direct', count: '2', skuId: SKU[0]._id, remark: encodeURIComponent('少糖 & 少冰 + 50%') });
  await Promise.all([page.submitOrder(), page.submitOrder()]);
  const order = r.load('services/order/order.js');
  const result = await order.listOrder({ pageNumber: 1, pageSize: 100 });
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].status, order.ORDER_STATUS.TO_SEND);
  assert.equal(result.records[0].remark, '少糖 & 少冰 + 50%');
  assert.equal((await r.load('services/sku/sku.js').getSkuDetail(SKU[0]._id)).count, 997);
  const orderItems = await r.load('services/order/orderItem.js').getAllOrderItemsOfAnOrder({ orderId: result.records[0]._id });
  assert.equal(orderItems.length, 1);
  assert.equal(orderItems[0].count, 2);
  assert.equal(r.notifications.length, 1);
  assert.equal(r.notifications[0].goodsList[0].price, Math.round(SKU[0].price * 100));
  assert.equal(r.notifications[0].totalPrice, Math.round(SKU[0].price * 2 * 100));
  assert.equal(page.payLock, false);
});

test('cart order clears purchased items but retains unselected items', async () => {
  const r = createRuntime();
  const items = await seedCart(r, [2, 3]);
  const cart = r.instance('pages/cart/index.js');
  await cart.init();
  cart.onGoodsSelect({ detail: { goods: items[1] } });
  cart.onRemarkChange({ detail: { value: '少冰 & 打包' } });
  await cart.onToSettle();
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad(query(r.navigation[0]));
  assert.equal(page.data.remark, '少冰 & 打包');
  await page.submitOrder();
  const remaining = await r.load('services/cart/cart.js').fetchCartItems();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]._id, items[1]._id);
  assert.equal(r.notifications.length, 1);
  assert.equal(r.notifications[0].goodsList[0].num, 2);
  assert.equal(r.notifications[0].remark, '少冰 & 打包');
});

test('stock becoming insufficient during checkout cancels order and restores earlier reservations', async () => {
  const r = createRuntime();
  const items = await seedCart(r, [2, 3]);
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'cart', cartIds: items.map(item => item._id).join(',') });
  const stock = r.load('services/sku/sku.js');
  await stock.updateSku({ skuId: items[1].sku._id, data: { count: 0 } });
  await page.submitOrder();
  assert.equal((await stock.getSkuDetail(items[0].sku._id)).count, 999);
  assert.equal((await stock.getSkuDetail(items[1].sku._id)).count, 0);
  const result = await r.load('services/order/order.js').listOrder({ pageNumber: 1, pageSize: 100 });
  assert.equal(result.records[0].status, 'CANCELED');
  assert.equal((await r.load('services/cart/cart.js').fetchCartItems()).length, 2);
  assert.equal(r.notifications.length, 0);
  assert.equal(page.data.submitting, false);
});

test('order item creation failure restores stock and cancels incomplete order', async () => {
  const r = createRuntime();
  r.override('services/order/orderItem.js', { createOrderItem: async () => { throw new Error('simulated failure'); } });
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'direct', count: '2', skuId: SKU[0]._id });
  await page.submitOrder();
  assert.equal((await r.load('services/sku/sku.js').getSkuDetail(SKU[0]._id)).count, 999);
  assert.equal((await r.load('services/order/order.js').listOrder({ pageNumber: 1, pageSize: 100 })).records[0].status, 'CANCELED');
  assert.equal(r.notifications.length, 0);
});

test('payment cancellation retains a payable order and does not roll back valid order stock', async () => {
  const r = createRuntime();
  r.override('services/pay/pay.js', { pay: async () => { throw new Error('cancelled'); } });
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'direct', count: '1', skuId: SKU[0]._id });
  await page.submitOrder();
  assert.equal((await r.load('services/order/order.js').listOrder({ pageNumber: 1, pageSize: 100 })).records[0].status, 'TO_PAY');
  assert.equal((await r.load('services/sku/sku.js').getSkuDetail(SKU[0]._id)).count, 998);
  assert(r.messages.includes('支付未完成，可在订单列表继续付款'));
});

test('notification failure does not discard a valid order', async () => {
  const r = createRuntime();
  r.wx.cloud.callFunction = async () => { throw new Error('simulated notification outage'); };
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'direct', count: '1', skuId: SKU[0]._id });
  await page.submitOrder();
  assert.equal((await r.load('services/order/order.js').listOrder({ pageNumber: 1, pageSize: 100 })).records[0].status, 'TO_SEND');
});

test('invalid checkout input never enables submission or creates an order', async () => {
  const r = createRuntime();
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  for (const count of ['0', '-1', '1.5', 'abc', '1000', '']) {
    const page = r.instance('pages/order/order-confirm/index.js');
    await page.onLoad({ type: 'direct', count, skuId: SKU[0]._id });
    assert.equal(page.data.readyToSubmit, false);
    await page.submitOrder();
  }
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'cart', cartIds: 'missing' });
  await page.submitOrder();
  assert.equal((await r.load('services/order/order.js').listOrder({ pageNumber: 1, pageSize: 100 })).total, 0);
});

test('orders survive module reload, count correctly and repeated detail reads do not corrupt address data', async () => {
  const r = createRuntime();
  const orders = r.load('services/order/order.js');
  const { id: first } = await orders.createOrder({ status: 'TO_PAY', addressId: '', remark: 'first' });
  const { id: second } = await orders.createOrder({ status: 'TO_SEND', addressId: '', remark: 'second' });
  assert.equal((await orders.getOrder(first)).delivery_info, null);
  assert.equal((await orders.getOrder(first)).delivery_info, null);
  assert.equal(r.storage.get('MOCK_ORDER_RECORDS')[0].delivery_info._id, '');
  const reload = createRuntime();
  for (const [key, value] of r.storage) reload.storage.set(key, structuredClone(value));
  const reloadedOrders = reload.load('services/order/order.js');
  assert.equal(await reloadedOrders.getToPayOrderCount(), 1);
  assert.equal(await reloadedOrders.getToSendOrderCount(), 1);
  const result = await reloadedOrders.listOrder({ pageNumber: 1, pageSize: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.records[0]._id, second);
  const next = await reloadedOrders.listOrder({ pageNumber: 2, pageSize: 1 });
  assert.equal(next.records[0]._id, first);
});

test('homepage loads all menu products across pagination and empty carousel safely', async () => {
  const r = createRuntime();
  const page = r.instance('pages/home/home.js');
  await page.loadHomeSwiper();
  assert.equal(page.data.imgSrcs.length, 0);
  await page.loadGoodsList(true);
  assert.equal(page.data.goodsList.length, 20);
  await page.loadGoodsList();
  assert.equal(page.data.goodsList.length, 40);
  await page.loadGoodsList();
  assert.equal(page.data.goodsList.length, 55);
  assert.equal(new Set(page.data.goodsList.map(item => item._id)).size, 55);
});

test('a successful order cannot be submitted again before navigation completes', async () => {
  const r = createRuntime();
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoad({ type: 'direct', count: '1', skuId: SKU[0]._id });
  await page.submitOrder();
  await page.submitOrder();
  assert.equal((await r.load('services/order/order.js').listOrder({ pageNumber: 1, pageSize: 100 })).total, 1);
  assert.equal(r.notifications.length, 1);
});

test('invalid reinitialization disables a previously valid confirmation page', async () => {
  const r = createRuntime();
  const { SKU } = r.load('services/cloudbaseMock/index.js');
  const page = r.instance('pages/order/order-confirm/index.js');
  await page.onLoadFromDirect('1', SKU[0]._id);
  assert.equal(page.data.readyToSubmit, true);
  await page.onLoadFromDirect('0', SKU[0]._id);
  assert.equal(page.data.readyToSubmit, false);
  await page.onLoadFromDirect('1', SKU[0]._id);
  await page.onLoadFromCart('missing');
  assert.equal(page.data.readyToSubmit, false);
});

test('invalid quantity edits do not change cart totals or persisted quantities', async () => {
  const r = createRuntime();
  const [item] = await seedCart(r, [2]);
  const page = r.instance('pages/cart/index.js');
  await page.init();
  for (const count of ['', 'abc', 0, -2, 1.5, 1000]) {
    page.onQuantityChange({ detail: { cartItemId: item._id, count } });
    assert.equal(page.data.cartItems[0].count, 2);
    assert.equal(page.data.selectedCartItemNum, 2);
  }
  assert.equal((await r.load('services/cart/cart.js').fetchCartItems())[0].count, 2);
});

test('multiple-SKU detail actions open selection instead of silently adding the first SKU', async () => {
  const r = createRuntime();
  const page = r.instance('pages/goods/details/index.js');
  page.setData({ skuArray: [{ _id: 'a', count: 2 }, { _id: 'b', count: 3 }] });
  await page.toAddCart();
  assert.equal(page.data.isSpuSelectPopupShow, true);
  assert.equal(page.data.outOperateStatus, 'cart');
  page.handlePopupHide();
  await page.buyItNow();
  assert.equal(page.data.isSpuSelectPopupShow, true);
  assert.equal(page.data.outOperateStatus, 'buy');
  assert.equal((await r.load('services/cart/cart.js').fetchCartItems()).length, 0);
  assert.equal(r.navigation.length, 0);
});

test('detail add recovers from fetch failure and allows retry', async () => {
  const r = createRuntime();
  const cart = r.load('services/cart/cart.js');
  let fail = true;
  r.override('services/cart/cart.js', { ...cart, async fetchCartItems() {
    if (fail) throw new Error('simulated cart fetch failure');
    return cart.fetchCartItems();
  } });
  const page = r.instance('pages/goods/details/index.js');
  await page.getInfo('P001_prod');
  await page.toAddCart();
  assert.equal(page._addingCart, false);
  assert(r.messages.includes('加入点单车失败'));
  fail = false;
  await page.toAddCart();
  assert.equal((await cart.fetchCartItems())[0].count, 1);
});

test('direct checkout remark survives special characters from the detail page', async () => {
  const r = createRuntime();
  const page = r.instance('pages/goods/details/index.js');
  await page.getInfo('P001_prod');
  page.setData({ selectedQuickRemark: '半糖 & 少冰 + 50% #打包' });
  await page.buyItNow();
  const confirm = r.instance('pages/order/order-confirm/index.js');
  await confirm.onLoad(query(r.navigation[0]));
  assert.equal(confirm.data.remark, '半糖 & 少冰 + 50% #打包');
});

test('homepage recovers after a product-list fetch fails without skipping a page', async () => {
  const r = createRuntime();
  const goods = r.load('services/good/spu.js');
  let fail = true;
  r.override('services/good/spu.js', { ...goods, async listGood(args) {
    if (fail) throw new Error('simulated loading failure');
    return goods.listGood(args);
  } });
  const page = r.instance('pages/home/home.js');
  await page.loadGoodsList(true);
  assert.equal(page.data.goodsList.length, 0);
  assert.equal(page.goodListPagination.index, 1);
  fail = false;
  await page.loadGoodsList(true);
  assert.equal(page.data.goodsList.length, 20);
  assert.equal(page.goodListPagination.index, 2);
});

test('new drink brands appear in the drink category, search and direct ordering', async () => {
  const brands = ['益禾堂', '书亦烧仙草', '甜啦啦', '柠季', 'LINLEE林里', '星巴克', '瑞幸咖啡', '库迪咖啡'];
  const r = createRuntime();
  const { getAllSpuOfCate } = r.load('services/cate/cate.js');
  const { listGood } = r.load('services/good/spu.js');
  const { spu: drinks } = await getAllSpuOfCate('CATE_MILK_CHILD');
  assert.equal(drinks.length, 25);
  assert.equal(new Set(drinks.map(item => item._id)).size, 25);
  for (const name of brands) {
    const drink = drinks.find(item => item.name === name);
    assert(drink, name);
    const { records, total } = await listGood({ pageSize: 30, pageNumber: 1, search: name });
    assert.equal(total, 1, name);
    assert.equal(records[0]._id, drink._id, name);
    const detail = r.instance('pages/goods/details/index.js');
    await detail.getInfo(drink._id);
    await detail.buyItNow();
    const confirm = r.instance('pages/order/order-confirm/index.js');
    await confirm.onLoad(query(r.navigation.at(-1)));
    await confirm.submitOrder();
    assert.equal(r.notifications.at(-1).goodsList[0].title, name);
  }
  const home = r.instance('pages/home/home.js');
  await home.navToCategory({ currentTarget: { dataset: { key: 'milkTea' } } });
  assert.match(r.navigation.at(-1), /cateIds=CATE_MILK_CHILD/);
  const categories = r.instance('pages/goods/category/index.js');
  await categories.init();
  assert.equal(categories.data.fixedCategories.find(item => item.key === 'milkTea').cateId, 'CATE_MILK_CHILD');
});
