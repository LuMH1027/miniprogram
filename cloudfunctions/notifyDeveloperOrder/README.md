# notifyDeveloperOrder

下单成功后通知开发者的云函数。

## 使用方式

1. 在微信开发者工具里确认 `app.js` 的 `wx.cloud.init({ env })` 已改成你的云开发环境 ID。
2. 右键 `cloudfunctions/notifyDeveloperOrder`，选择“上传并部署：云端安装依赖”。
3. 在云开发控制台给云函数配置环境变量：

```text
ORDER_NOTIFY_WEBHOOK_URLS=https://open.feishu.cn/open-apis/bot/v2/hook/群A的地址,https://open.feishu.cn/open-apis/bot/v2/hook/群B的地址
ORDER_NOTIFY_WEBHOOK_TYPE=feishu
```

每个群分别添加自定义机器人，把各群的 Webhook 地址用英文逗号隔开，填入 `ORDER_NOTIFY_WEBHOOK_URLS`。也支持空格或换行分隔，重复地址只发送一次。所有地址使用同一种渠道类型。

云函数会分别向各群发送通知。一个群发送失败，不影响其他群；单次请求超过 10 秒会超时。返回值中的 `sentCount` 和 `failedCount` 表示成功、失败的群数，`results` 按配置顺序记录结果，`index` 从 0 开始。飞书返回业务错误时也会计为失败。

修改代码后重新上传部署云函数，并保存环境变量。无需修改小程序端的下单调用。

`ORDER_NOTIFY_WEBHOOK_TYPE` 可选：

- `wecom`：企业微信机器人
- `feishu`：飞书机器人，默认值
- `serverchan`：Server 酱

原来的单群变量 `ORDER_NOTIFY_WEBHOOK_URL` 仍然可用。配置了 `ORDER_NOTIFY_WEBHOOK_URLS` 时，优先使用多群变量，不会额外发送到单群变量的地址。

如果两个变量都没有配置，会读取部署目录的 `webhooks.local.json`（格式为 `{ "urls": ["群A的地址", "群B的地址"] }）。该文件已加入 Git 忽略列表，当前本机已配置两个群，上传云函数时会一起部署。新环境建议通过环境变量配置；两种配置都为空时不发送通知。云端已有环境变量时会覆盖本机列表，要通知多个群需在环境变量中填入所有地址。
