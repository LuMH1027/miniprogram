# 第一阶段交付物：现有商城结构盘点与改造基线

## 1. 基线结论

当前项目是基于微信小程序 + TDesign Miniprogram + CloudBase 数据模型的商城模板，已经具备“商品浏览 -> 购物车 -> 订单确认 -> 创建订单 -> 微信支付 -> 订单列表/详情”的基础链路。外卖点单改造可以优先复用现有页面、服务和数据模型，不建议在前几阶段重命名目录或改动底层表名。

第一阶段只做事实梳理与风险识别，不进行功能改造。后续阶段应以“隐藏非目标入口、显示层语义替换、订单备注增量字段、支付链路最小改动”为主线推进。

## 2. 路由与页面职责清单

| 路由 | 当前职责 | 入口来源 | 外卖目标角色 | 第一阶段判断 |
| --- | --- | --- | --- | --- |
| `pages/home/home` | 首页轮播、商品列表、搜索入口、活动入口 | Tab 首页 | 菜品浏览首页 | 可复用，需隐藏活动入口并替换文案 |
| `pages/goods/category/index` | 商品分类列表 | Tab 分类 | 菜品分类 | 可复用，需改“商品分类”为“菜品分类”语义 |
| `pages/goods/list/index` | 分类商品列表、筛选、排序 | 分类页 | 分类菜品列表 | 可复用，价格筛选可保留或弱化 |
| `pages/goods/details/index` | 商品详情、SKU 选择、加入购物车、立即购买、评价、促销 | 首页/列表/购物车 | 菜品详情、选规格、加点单车、立即下单 | 可复用，需隐藏促销和评价强商城入口 |
| `pages/cart/index` | 购物车列表、选择、数量修改、删除、去结算 | Tab 购物车、详情页 | 点单车 | 可复用，需改文案并隐藏复杂促销/门店结构 |
| `pages/order/order-confirm/index` | 地址选择、订单商品确认、创建订单、创建订单项、扣库存、删除购物车项、支付 | 点单车/详情直购 | 下单确认页 | 核心复用，第四阶段新增备注字段 |
| `pages/order/pay-result/index` | 支付结果页 | 支付链路潜在入口 | 支付结果反馈 | 可保留，当前主链路支付后直接返回 |
| `pages/order/order-list/index` | 订单列表、状态筛选、订单操作 | 个人中心/订单状态入口 | 外卖订单列表 | 可复用，需简化状态文案与隐藏售后入口 |
| `pages/order/order-detail/index` | 订单详情、地址修改、商品、金额、物流/发票/客服/按钮 | 订单列表 | 外卖订单详情 | 可复用，需隐藏物流/发票并增加备注展示 |
| `pages/usercenter/index` | 用户信息、订单状态入口、地址入口、客服 | Tab 我的 | 我的/订单入口 | 可复用，需隐藏会员、积分、优惠、售后等入口 |
| `pages/usercenter/address/list/index` | 地址列表与选择 | 我的/订单确认 | 配送地址选择 | 可复用，保留 |
| `pages/usercenter/address/edit/index` | 地址新增编辑 | 地址列表 | 配送地址编辑 | 可复用，保留 |
| `pages/coupon/*` | 优惠券列表、详情、活动商品 | 页面入口/潜在营销入口 | 非目标能力 | 后续隐藏，不建议第一轮删除路由 |
| `pages/promotion-detail/index` | 活动促销详情 | 首页/详情/购物车活动入口 | 非目标能力 | 后续隐藏入口 |
| `pages/order/apply-service/index` | 售后申请 | 订单操作 | 非目标能力 | 后续隐藏入口 |
| `pages/order/after-service-*` | 售后列表与详情 | 个人中心/订单 | 非目标能力 | 后续隐藏入口 |
| `pages/order/delivery-detail/index` | 物流详情 | 订单详情 | 非目标能力 | 后续隐藏入口 |
| `pages/order/invoice/index`、`pages/order/receipt/index` | 发票与收据 | 订单详情 | 非目标能力 | 后续隐藏入口 |
| `pages/goods/comments/*` | 评价列表/发表评价 | 详情/订单 | 可选弱化能力 | 简易点单首版建议隐藏 |

Tab 结构当前为：首页、分类、购物车、我的。外卖目标可继续沿用四个 Tab，但第三项文案应在第三阶段从“购物车”改为“点单车”。若需要“订单”作为常驻入口，应在第二阶段评估是否替换“我的”或新增入口；当前计划未要求改 Tab 数量。

## 3. 服务层接口盘点

| 服务文件 | 关键函数 | 当前作用 | 外卖改造判断 |
| --- | --- | --- | --- |
| `services/good/spu.js` | `listGood`、`getPrice`、`getSpu`、`handleSpuCloudImage` | 商品 SPU 列表、价格、详情、图片处理 | 复用为菜品服务语义 |
| `services/sku/sku.js` | `getSkuDetail`、`getAllSku`、`updateSku` | SKU 查询、SKU 库存更新 | 复用，库存扣减是高风险点 |
| `services/cate/cate.js` | `getCates`、`getAllSpuOfCate` | 分类与分类商品 | 复用为菜品分类 |
| `services/cart/cart.js` | `fetchCartItems`、`getCartItem`、`createCartItem`、`updateCartItemCount`、`deleteCartItem` | 购物车项增删改查 | 复用为点单车 |
| `services/order/order.js` | `createOrder`、`listOrder`、`getOrder`、`updateOrderStatus`、订单状态计数 | 订单创建、查询、状态更新 | 复用，第四阶段新增 `remark` 可选字段 |
| `services/order/orderItem.js` | `createOrderItem`、`getAllOrderItemsOfAnOrder` | 订单项创建与查询 | 复用 |
| `services/pay/pay.js` | `pay`、`refund` | 调用云函数 `shop_pay`/`shop_refund` 与微信支付 | 支付能力保留，避免重写 |
| `services/usercenter/*` | `fetchUserCenter`、`fetchPerson` | 用户中心数据 | 复用，入口需精简 |
| `services/coupon/index.js` | 优惠券相关 | 优惠功能 | 后续隐藏或下线 |
| `services/promotion/detail.js` | 促销详情 | 营销活动 | 后续隐藏或下线 |
| `services/comments/*` | 评论列表/数量 | 商品评价 | 首版可隐藏入口，底层可保留 |
| `services/address/address.js` | 地址相关 | 收货地址 | 复用为配送地址 |

## 4. 数据模型盘点

数据模型键集中在 `config/model.js`：

| 模型键 | 表名 | 当前语义 | 外卖目标语义 | 判断 |
| --- | --- | --- | --- | --- |
| `SPU` | `shop_spu` | 商品 | 菜品 | 复用，不改表名 |
| `SKU` | `shop_sku` | 商品规格与库存 | 菜品规格、份量、库存 | 复用，高风险 |
| `ATTR_VALUE` | `shop_attr_value` | SKU 属性值 | 口味/规格/份量等 | 复用 |
| `CATE` | `shop_spu_cate` | 商品分类 | 菜品分类 | 复用 |
| `CART_ITEM` | `shop_cart_item` | 购物车项 | 点单车项 | 复用 |
| `ORDER` | `shop_order` | 订单 | 外卖订单 | 复用，新增 `remark` |
| `ORDER_ITEM` | `shop_order_item` | 订单项 | 点单明细 | 复用 |
| `DELIVERY_INFO` | `shop_delivery_info` | 收货地址 | 配送地址 | 复用 |
| `COMMENT` | `shop_comment` | 商品评价 | 可选评价 | 首版隐藏入口 |
| `HOME_SWIPER` | `shop_home_swiper_image` | 首页轮播 | 首页广告/菜品推荐 | 可复用 |

Mock 数据位于 `services/cloudbaseMock/index.js`，当前内容仍是商城商品样例。第三阶段做语义替换时，可先替换 mock 商品名与分类名，不必更改字段结构。

## 5. 最小可行主链路

```text
首页/分类/列表
  -> pages/goods/details/index
  -> 加入购物车: createCartItem / updateCartItemCount
  -> pages/cart/index
  -> 选择购物车项并跳转 pages/order/order-confirm/index?type=cart&cartIds=...
  -> getCartItem + getSkuDetail
  -> createOrder(status=TO_PAY, addressId)
  -> createOrderItem
  -> updateSku 扣库存
  -> deleteCartItem
  -> pay({ id: orderId, totalPrice })
  -> wx.cloud.callFunction('shop_pay')
  -> wx.requestPayment
  -> updateOrderStatus(orderId, TO_SEND)
  -> pages/order/order-list/index / pages/order/order-detail/index
```

直购链路：

```text
pages/goods/details/index
  -> 立即购买
  -> pages/order/order-confirm/index?type=direct&count=...&skuId=...
  -> getSkuDetail
  -> createOrder(status=TO_PAY, addressId)
  -> createOrderItem
  -> updateSku 扣库存
  -> pay
  -> updateOrderStatus(TO_SEND)
```

关键触发点：

- `pages/goods/details/index.js`：`addCart`、`gotoBuy`
- `pages/cart/index.js`：`onToSettle`
- `pages/order/order-confirm/index.js`：`submitOrder`、`submitOrderFromCart`、`submitOrderFromDirect`、`payImpl`
- `pages/order/components/order-button-bar/index.js`：`onPay`、`onCancel`、`onConfirm`
- `services/order/order.js`：`createOrder`、`updateOrderStatus`
- `services/pay/pay.js`：`pay`

## 6. 复用分类表

### 可复用

| 模块 | 原因 | 影响范围 |
| --- | --- | --- |
| 首页、分类、列表、详情页面框架 | 已具备列表、详情、图片、价格、SKU 展示 | 菜品浏览体验 |
| 购物车页面与 `services/cart/cart.js` | 已具备选中、数量、删除、结算 | 点单车 |
| 订单确认页基础流程 | 已具备地址、商品确认、订单创建、支付 | 下单主链路 |
| 订单列表/详情页 | 已具备状态筛选、订单项、金额展示 | 订单查询 |
| `services/pay/pay.js` | 已封装云函数和微信支付组件调用 | 支付 |
| 地址模块 | 已支持地址选择和编辑 | 配送地址 |
| 通用组件：价格、商品卡片、加载、弹窗 | 可直接承载简易点单 UI | 多页面 |

### 需改造

| 模块 | 原因 | 影响范围 |
| --- | --- | --- |
| `app.json` 与 `custom-tab-bar/data.js` | 文案“购物车”需改为“点单车”，入口需精简 | Tab 与路由入口 |
| 商品相关页面文案 | 商城“商品”语义需转为“菜品” | 首页、分类、列表、详情 |
| `pages/cart/index` 与购物车组件文案 | 购物车需转为点单车 | 点单车页面 |
| `pages/order/order-confirm/index` | 需新增订单级备注输入和提交参数 | 下单 |
| `services/order/order.js` | `createOrder` 需兼容 `remark` 字段 | 订单创建与查询 |
| 订单列表/详情状态文案 | `待发货/待收货` 不适合外卖语义 | 订单查询 |
| Mock 数据 | 当前是实物商城商品 | 本地演示和测试 |

### 可隐藏

| 模块 | 原因 | 影响范围 |
| --- | --- | --- |
| 优惠券页面和入口 | 简易外卖首版明确不做优惠券 | 用户中心、路由 |
| 促销活动入口 | 简易点单首版不做满减/活动 | 首页、详情、购物车 |
| 售后申请、售后列表、售后详情 | 首版不做复杂售后 | 订单操作、我的 |
| 物流详情 | 外卖首版不做快递物流 | 订单详情 |
| 发票/收据 | 首版非核心链路 | 订单详情 |
| 商品评价入口 | 不是点单闭环必需 | 详情、订单 |

### 可删除

第一轮不建议删除任何已注册路由或服务文件。删除应放在灰度稳定之后，且必须先确认没有 WXML、JS、组件配置和历史分享链接依赖。当前阶段只建议隐藏入口。

## 7. 高风险模块矩阵

| 风险点 | 风险等级 | 现状 | 规避策略 | 回滚建议 |
| --- | --- | --- | --- | --- |
| 支付链路 | 高 | `pay` 调用 `shop_pay` 后走 `wx.requestPayment`，支付成功再更新订单状态 | 不重写支付云函数和签名逻辑，只调整业务状态文案 | 保留原 `TO_PAY -> TO_SEND` 状态流 |
| 订单状态 | 高 | 状态包含 `TO_PAY/TO_SEND/TO_RECEIVE/FINISHED/CANCELED` 及退货状态 | 先做显示层映射，如 `TO_SEND` 显示为“制作中/已支付” | 回滚状态文案映射，不改表内状态值 |
| SKU 库存扣减 | 高 | 下单创建订单项前会 `updateSku` 扣库存，失败路径较多 | 第五阶段重点测并发、库存不足、订单项创建失败 | 保持原库存字段和扣减函数，必要时恢复旧提交逻辑 |
| 订单备注字段 | 中高 | 当前 `createOrder` 只写 `status` 与 `delivery_info` | 新增可选 `remark`，默认空字符串，历史订单兼容 | 删除入参透传和展示，不影响旧订单 |
| 购物车项删除 | 中 | 支付前会删除购物车项，但当前 `map(async)` 未等待整体完成 | 后续阶段可改为 `Promise.all` 并保留失败提示 | 保持原删除逻辑 |
| 地址选择 | 中 | 下单强依赖 `userAddress._id` | 保留地址模块，不做外卖定位/门店范围校验 | 恢复原“收货地址”文案 |
| 非目标入口隐藏 | 中 | 优惠、活动、售后、物流、发票入口散落在多个页面 | 采用配置/条件渲染隐藏，不先删路由 | 恢复入口展示即可 |
| Mock 数据 | 低 | 商品、分类仍为商城样例 | 第三阶段替换 mock 文案和图片 | 回滚 mock 数据变更 |

## 8. 改造边界确认单

后续阶段允许做：

- 将显示文案从“商品/购物车”替换为“菜品/点单车”。
- 隐藏优惠、促销、售后、物流、发票、评价等非主链路入口。
- 在订单创建、查询、列表、详情中增加可选 `remark` 字段。
- 将订单状态文案映射到简易外卖语义。
- 替换 mock 数据中的商品名称、分类名称和展示素材。

后续阶段不建议做：

- 不重命名 `goods`、`cart`、`spu`、`sku`、`shop_*` 等目录、字段、表名。
- 不重写微信支付云函数、签名逻辑和 `wx.requestPayment` 调用结构。
- 不引入多门店、骑手配送、路线规划、预计送达、营业时间控制。
- 不在第二阶段直接删除已注册页面路由。
- 不把订单状态值从底层枚举硬迁移为全新外卖状态，先做显示层映射。

## 9. 第一阶段验收

- 已完成页面路由、Tab、入口、服务接口、数据模型和支付调用链盘点。
- 已确认最小主链路可由现有代码支撑。
- 已明确可复用、需改造、可隐藏和暂不删除范围。
- 已输出风险矩阵与规避策略。
- 后续阶段可从“阶段二：简化页面和功能入口”直接开工。
