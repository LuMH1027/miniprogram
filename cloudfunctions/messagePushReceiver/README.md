# messagePushReceiver

微信小程序“消息推送”的接收云函数。

它对应微信官方文档里的服务器 URL：

https://developers.weixin.qq.com/miniprogram/dev/framework/server-ability/message-push.html

## 它能做什么

- GET：用于微信后台保存配置时的接入校验，校验通过后返回 `echostr`。
- POST：接收微信服务器推送过来的消息或事件，目前先写入云函数日志并返回 `success`。

## 配置步骤

1. 部署云函数 `messagePushReceiver`。
2. 给云函数配置环境变量：

```text
WECHAT_MESSAGE_PUSH_TOKEN=你自己设置的一串Token
```

3. 给云函数开启 HTTP 访问，拿到公网 HTTPS 地址。
4. 打开微信公众平台小程序后台：

```text
开发管理 -> 开发设置 -> 消息推送
```

5. 填写：

```text
URL = 第 3 步拿到的 HTTPS 地址
Token = 和 WECHAT_MESSAGE_PUSH_TOKEN 一样
EncodingAESKey = 后台随机生成
消息加解密方式 = 明文模式
```

## 注意

这个能力是“微信服务器推消息给你的服务器”，不是“小程序端主动给开发者发微信消息”。

如果要在用户点击“提交订单”后立刻通知你，仍然要用 `notifyDeveloperOrder` 这种云函数主动通知方案。
