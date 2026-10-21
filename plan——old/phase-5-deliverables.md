# 第五阶段交付物：下单支付联调与状态闭环

## 1. 联调记录

| 链路节点 | 处理结果 |
| --- | --- |
| 点单车结算 | 未选择菜品时提示“请先选择菜品”，不进入订单确认 |
| 创建订单 | 创建时写入 `TO_PAY`、配送地址和订单备注 |
| 创建订单项 | 基于最新 SKU 库存校验并扣减库存后创建订单项 |
| 清理点单车 | 改为 `Promise.all` 等待删除完成，失败时提示手动清理但继续支付 |
| 调起支付 | `services/pay/pay.js` 保留真实 `wx.requestPayment`，mock 模式直接成功 |
| 支付成功 | 订单状态从 `TO_PAY` 幂等更新为 `TO_SEND`（制作中） |
| 支付取消/失败 | 保留 `TO_PAY` 订单，跳转订单列表待付款 Tab，可继续付款 |
| 重复提交 | 订单确认页用 `payLock` + `submitting` 阻止重复创建订单 |
| 重复付款 | 订单按钮栏用 `operating` 阻止重复点击付款按钮 |
| 创建失败回滚 | 订单已创建但订单项创建失败时，将订单标记为 `CANCELED` |
| 库存回滚 | 订单项创建失败时恢复本次已扣减的 SKU 库存 |

## 2. 支付异常处理策略

| 异常 | 处理 |
| --- | --- |
| 用户取消支付 | 不删除订单，不改状态，进入待付款列表 |
| `shop_pay` 返回空支付参数 | 抛出 `PAYMENT_DATA_EMPTY`，进入待付款列表 |
| `wx.requestPayment` 失败 | 保留待付款订单，可从订单列表重试 |
| 支付成功但状态更新失败 | Toast 提醒“支付成功，但订单状态更新失败”，保留日志供排查 |
| 重复支付回调/重复点击 | 状态更新带 `expectedStatus: TO_PAY`，非待付款状态不重复写入 |
| 订单项创建失败 | 回滚订单状态为已取消，避免空订单进入待付款 |
| 库存扣减后失败 | 根据扣减前库存快照恢复已扣 SKU |

## 3. 状态流转校验

```text
下单成功:
TO_PAY -> pay success -> TO_SEND

支付取消/失败:
TO_PAY -> pay fail/cancel -> TO_PAY

订单项创建失败:
TO_PAY -> create item fail -> CANCELED

重复支付状态写入:
TO_SEND -> update expected TO_PAY -> skip
```

## 4. 关键日志

| 日志 | 场景 |
| --- | --- |
| `[order-confirm:create:cart:start]` | 点单车订单创建开始 |
| `[order-confirm:create:direct:start]` | 直购订单创建开始 |
| `[order-confirm:create:*:order-created]` | 订单创建成功 |
| `[order-confirm:create:*:items-created]` | 订单项创建成功 |
| `[order-confirm:pay:start]` | 支付调起 |
| `[order-confirm:pay:status-updated]` | 支付后状态更新成功 |
| `[order-confirm:pay:failed]` | 支付失败或取消 |
| `[order:updateStatus:skip]` | 幂等状态保护跳过写入 |
| `[order-button-bar:operation:skip-duplicate]` | 订单操作重复点击被拦截 |

## 5. 剩余风险

当前仓库只包含小程序侧代码，真实支付云函数 `shop_pay` 和支付回调不在本仓库内。本阶段已保持支付 SDK 调用最小改动；上线前仍需在微信开发者工具或沙箱环境验证真实支付参数、签名和云函数权限。
