# 第二阶段交付物：页面入口精简与路由白名单

## 1. 精简后的主入口

底部 Tab 已收敛为 5 个入口：

| Tab | 路由 | 说明 |
| --- | --- | --- |
| 首页 | `pages/home/home` | 菜品浏览首页 |
| 分类 | `pages/goods/category/index` | 菜品分类入口 |
| 点单车 | `pages/cart/index` | 原购物车入口，显示层改为点单车 |
| 订单 | `pages/order/order-list/index` | 新增为 Tab 页，承接订单查询 |
| 我的 | `pages/usercenter/index` | 保留地址、订单状态入口 |

## 2. 路由白名单

代码白名单定义在 `utils/routeGuard.js` 的 `PHASE_2_ALLOWED_ROUTES`：

| 类型 | 路由 |
| --- | --- |
| Tab | `pages/home/home` |
| Tab | `pages/goods/category/index` |
| Tab | `pages/cart/index` |
| Tab | `pages/order/order-list/index` |
| Tab | `pages/usercenter/index` |
| 用户 | `pages/usercenter/person-info/index` |
| 地址 | `pages/usercenter/address/list/index` |
| 地址 | `pages/usercenter/address/edit/index` |
| 菜品 | `pages/goods/list/index` |
| 菜品 | `pages/goods/details/index` |
| 搜索 | `pages/goods/search/index` |
| 搜索结果 | `pages/goods/result/index` |
| 下单 | `pages/order/order-confirm/index` |
| 支付结果 | `pages/order/pay-result/index` |
| 订单详情 | `pages/order/order-detail/index` |

## 3. 隐藏项与保留项对照

| 能力 | 处理方式 | 相关改动 |
| --- | --- | --- |
| 优惠券 | 隐藏入口；历史直达提示暂未开放并回到我的 | `pages/coupon/*`、`pages/usercenter/index.js` |
| 促销活动 | 隐藏详情弹窗与首页活动跳转 | `pages/home/home.js`、`pages/goods/details/index.*`、`pages/promotion-detail/index.js` |
| 售后/退款 | 隐藏订单完成后的评价按钮；售后页面直达兜底回订单 | `pages/order/components/order-button-bar/index.js`、`pages/order/apply-service`、`pages/order/after-service-*` |
| 物流/运单 | 页面直达兜底回订单 | `pages/order/delivery-detail`、`pages/order/fill-tracking-no` |
| 发票/收据 | 页面直达兜底回订单 | `pages/order/invoice`、`pages/order/receipt` |
| 商品评价 | 详情页评价区隐藏；评价页面直达兜底 | `pages/goods/details/index.wxml`、`pages/goods/comments/*` |

## 4. 保留链路

保留并优先验证：

```text
首页/分类 -> 菜品详情 -> 加入点单车/立即下单 -> 订单确认 -> 支付 -> 订单列表/订单详情
```

本阶段未改动订单创建、订单项创建、库存扣减和微信支付核心逻辑。

## 5. 可观测性

隐藏入口和非目标页面兜底会输出日志：

- `[phase-2-hidden-entry]`：用户点击了被隐藏或降级的入口。
- `[phase-2-unavailable-route]`：用户通过历史分享或直接路由进入了非目标页面。

这些日志用于后续判断是否可以彻底删除对应页面或服务。
