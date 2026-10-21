# notifyDeveloperOrder

下单成功后通知开发者的云函数。

## 使用方式

1. 在微信开发者工具里确认 `app.js` 的 `wx.cloud.init({ env })` 已改成你的云开发环境 ID。
2. 右键 `cloudfunctions/notifyDeveloperOrder`，选择“上传并部署：云端安装依赖”。
3. 在云开发控制台给云函数配置环境变量：

```text
ORDER_NOTIFY_WEBHOOK_URL=你的机器人 Webhook 地址
ORDER_NOTIFY_WEBHOOK_TYPE=wecom
```

`ORDER_NOTIFY_WEBHOOK_TYPE` 可选：

- `wecom`：企业微信机器人，默认值
- `feishu`：飞书机器人
- `serverchan`：Server 酱

如果没有配置 `ORDER_NOTIFY_WEBHOOK_URL`，云函数不会发送外部通知，但会把订单内容写到云函数日志里。
