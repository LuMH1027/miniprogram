## Plan: 微信商城改造简易外卖点单

在保留现有商品浏览、分类、购物车、下单、支付主链路的前提下，将商城语义和流程简化为外卖点单语义，并下线营销与会员等复杂能力。实施上采用“先减法、再改名、后补备注与状态”的低风险路线，优先复用 pages + services + model 的现有订单与支付能力，避免改动云支付核心。

**假设条件**
- 现有项目前后端已具备可用的商品、购物车、订单、支付基础能力。
- 仍使用微信小程序端 + 云开发或既有后端接口，不重构技术栈。
- 当前阶段仅支持单门店点单（不做多门店与骑手调度）。
- 备注字段为订单级文本备注（非商品级备注）。
- 管理后台已有订单列表能力，可新增备注展示字段；若后台不在本仓库内，则按接口契约同步实现。

**Steps**
1. 阶段一：梳理现有商城项目结构（依赖基线）
2. 阶段二：简化页面和功能入口（做减法）
3. 阶段三：改造“商品”为“菜品”，“购物车”为“点单车”（语义与文案）
4. 阶段四：增加订单备注能力（下单入参、存储、展示）
5. 阶段五：联调下单与支付流程（状态闭环）
6. 阶段六：测试、修复与发布准备（质量收口）

**Relevant files**
- c:/Users/29749/WeChatProjects/miniprogram-1/app.json — 页面路由与底部导航入口
- c:/Users/29749/WeChatProjects/miniprogram-1/custom-tab-bar/index.js — Tab 高亮与路由同步
- c:/Users/29749/WeChatProjects/miniprogram-1/custom-tab-bar/data.js — Tab 文案与图标配置
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/home/home — 首页菜品入口复用
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/goods/category/index — 分类页改菜品分类
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/goods/list/index — 列表页语义与筛选调整
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/goods/details/index — 菜品详情与规格选择
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/cart/index — 点单车主页面改造
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/order/order-confirm/index — 提交订单与备注入口
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/order/order-list/index — 外卖订单状态展示
- c:/Users/29749/WeChatProjects/miniprogram-1/pages/order/order-detail/index — 订单详情展示备注
- c:/Users/29749/WeChatProjects/miniprogram-1/services/cart/cart.js — 点单车数据操作复用
- c:/Users/29749/WeChatProjects/miniprogram-1/services/order/order.js — 订单创建与状态流转
- c:/Users/29749/WeChatProjects/miniprogram-1/services/order/orderItem.js — 订单项创建
- c:/Users/29749/WeChatProjects/miniprogram-1/services/pay/pay.js — 微信支付调用（保留）
- c:/Users/29749/WeChatProjects/miniprogram-1/services/good — 菜品服务语义替换
- c:/Users/29749/WeChatProjects/miniprogram-1/model/order — 订单字段与状态映射
- c:/Users/29749/WeChatProjects/miniprogram-1/model/cart — 点单车 mock 与字段定义
- c:/Users/29749/WeChatProjects/miniprogram-1/model/good — 菜品字段定义
- c:/Users/29749/WeChatProjects/miniprogram-1/services/coupon — 复杂优惠功能下线或隐藏
- c:/Users/29749/WeChatProjects/miniprogram-1/services/promotion — 营销活动能力下线或隐藏

**Verification**
1. 页面级回归：从首页选菜 → 加入点单车 → 提交订单 → 支付 → 订单详情查看备注，主链路全通。
2. 接口级验证：createOrder 入参含备注字段并成功落库，order-detail 接口可返回备注。
3. 支付级验证：支付成功后订单状态从 TO_PAY 正确流转到下一状态（如 TO_SEND/PREPARING）。
4. 数据级验证：订单表新增或复用 remark 字段；历史订单无备注时兼容展示空值。
5. 回归范围：地址选择、购物车数量修改、订单列表筛选、支付失败重试不回归。

**Decisions**
- 保留范围：菜品展示、分类、点单车、下单、微信支付、订单基础状态、订单备注。
- 新增范围：订单备注录入与展示；后台订单备注可见；支付成功生成外卖订单。
- 明确不做：骑手配送、路线规划、多门店、优惠券/满减、会员积分、复杂库存、复杂退款、商家接单、预计送达、营业时间控制。
- 命名策略：可先“显示层改名（商品→菜品、购物车→点单车）”，底层字段逐步迁移，降低风险。

---

## Plan: 《微信商城小程序改造为简易外卖点单小程序开发计划》

### 0. 项目改造目标
- 将现有微信商城小程序改造成简易外卖点单小程序。
- 保留基础能力：菜品展示、分类、点单车、提交订单、微信支付、用户备注、订单基础状态。
- 删除或弱化复杂商城能力：会员等级、积分、优惠券、秒杀拼团、物流快递、复杂售后等。
- 改造原则：少改核心链路、优先复用成熟模块、以配置隐藏替代大规模删除。

### 1. 功能范围规划

#### 1.1 需要保留的功能
- 菜品/商品展示
- 菜品分类
- 点单车（由购物车改名）
- 提交订单
- 微信支付
- 用户备注
- 订单基础状态（待支付、已支付/制作中、已完成、已取消）

#### 1.2 需要新增或改造的功能
- 统一业务语义：商品 -> 菜品。
- 统一页面文案：购物车 -> 点单车。
- 订单提交新增备注字段 remark。
- 订单详情与订单列表支持备注展示（列表可摘要，详情完整展示）。
- 管理后台订单管理支持备注查询与展示。
- 支付成功后生成外卖点单订单记录并进入外卖状态流。

#### 1.3 不需要实现的功能
- 骑手配送
- 配送路线
- 多门店
- 优惠券
- 满减活动
- 会员系统
- 积分系统
- 复杂库存管理
- 复杂退款流程
- 商家接单流程
- 预计送达时间
- 营业时间控制

### 2. 改造维度计划

#### 2.1 前端页面改造
- 首页/分类/列表/详情：将商品文案改为菜品，保留列表与详情结构。
- 点单车页：保留加减、删除、合计、去结算；隐藏多店、复杂促销区块。
- 订单确认页：新增备注输入框（文本域，限制长度与敏感字符校验）；提交时携带 remark。
- 订单列表/详情页：增加备注展示位，空备注时显示“无备注”。
- 个人中心：隐藏会员、积分、优惠券、售后等非目标入口。

涉及模块
- pages/home
- pages/goods/category
- pages/goods/list
- pages/goods/details
- pages/cart
- pages/order/order-confirm
- pages/order/order-list
- pages/order/order-detail
- pages/usercenter
- components/goods-card
- components/goods-list
- components/filter

测试重点
- 文案替换是否完整一致。
- 点单车到下单流程是否可用。
- 备注输入边界（空值、超长、特殊字符）。

注意事项
- 不要立即重命名目录，先改文案与变量映射，避免大规模引用断裂。
- 通过配置隐藏页面入口，避免直接删除导致路由报错。

#### 2.2 后端接口改造
- 订单创建接口 createOrder 增加 remark 入参（可选，默认空字符串）。
- 订单查询接口（列表/详情）返回 remark 字段。
- 支付成功回调后，订单状态改为外卖语义状态（至少保留 TO_PAY -> 已支付）。
- 管理后台订单接口增加备注字段透传。

涉及模块
- services/order/order.js
- services/order/orderItem.js
- services/pay/pay.js
- services/good
- services/cart/cart.js
- 管理后台订单 API（若在外部仓库则需同步接口契约）

测试重点
- createOrder 参数兼容旧调用方。
- remark 落库与回读一致。
- 支付成功状态更新幂等（重复回调不产生脏状态）。

注意事项
- 支付链路核心逻辑保持最小改动。
- 新增字段全部做可选兼容，避免影响历史订单。

#### 2.3 数据库字段改造
- 订单表新增或复用字段：remark（string，建议 0-200 字符）。
- 订单表保留核心字段：id、status、amount、address、createdAt。
- 菜品与点单车可先复用原字段（spu/sku/cart_item），通过映射层转换语义。

涉及模块
- model/order
- model/good
- model/cart
- config/model.js（若需新增数据模型键）

测试重点
- 新老订单兼容读取。
- remark 字段空值、超长、编码兼容。

注意事项
- 优先采用“加字段”而不是“改旧字段名”，降低迁移风险。

#### 2.4 订单流程改造
- 流程定义：选菜 -> 点单车 -> 订单确认（含备注） -> 支付 -> 订单完成。
- 状态简化：待支付、已支付（制作中）、已完成、已取消。
- 删除复杂分支：售后、复杂退款、物流追踪、商家接单。

涉及模块
- pages/cart
- pages/order/order-confirm
- pages/order/order-list
- pages/order/order-detail
- services/order/order.js

测试重点
- 正常下单流程闭环。
- 取消订单与支付失败回退。

注意事项
- 先保证最短主链路可用，再做状态文案优化。

#### 2.5 支付流程改造
- 复用现有微信支付能力，不调整支付 SDK 调用结构。
- 下单后调起支付，支付成功写入外卖订单状态。
- 支付失败保留待支付状态，支持用户再次支付。

涉及模块
- services/pay/pay.js
- services/order/order.js
- pages/order/order-confirm

测试重点
- 支付成功、失败、取消三种场景。
- 重复点击支付的防抖与幂等。

注意事项
- 支付相关云函数与签名逻辑不要重写，仅做业务状态适配。

#### 2.6 管理后台改造
- 订单列表增加“用户备注”列（支持关键字搜索）。
- 订单详情展示完整备注。
- 导出订单时包含 remark 字段。

涉及模块
- 后台订单列表页
- 后台订单详情页
- 后台订单导出接口

测试重点
- 备注显示一致性（前台、后台、导出三端一致）。
- 空备注、长备注展示效果。

注意事项
- 若后台不在当前仓库，先输出接口契约文档并联调。

### 3. 复用 / 修改 / 删除与隐藏清单

#### 3.1 可复用
- 商品浏览与分类页面框架（home、goods/category、goods/list、goods/details）
- 购物车与订单基础数据流（cart、order、orderItem）
- 微信支付能力（pay）
- 价格、列表、加载等通用组件

#### 3.2 需要修改
- 业务命名与文案：商品/购物车 -> 菜品/点单车
- 订单确认页：新增备注输入与提交参数
- 订单详情页：备注展示
- 订单状态文案：适配外卖简化状态

#### 3.3 可删除或隐藏
- 优惠券、满减、活动促销入口
- 会员、积分、复杂售后入口
- 物流快递、预计送达、多门店等页面入口

### 4. 分阶段开发任务拆解

#### 第一阶段：梳理现有商城项目结构
开发内容
- 盘点页面路由、服务依赖、数据模型与支付链路。
- 输出改造清单与风险矩阵。

涉及模块
- app.json
- custom-tab-bar
- pages/*
- services/*
- model/*

测试重点
- 基线可运行，主流程可复现。

注意事项
- 先冻结主干版本，避免并行改动造成回归难定位。

#### 第二阶段：简化页面和功能入口
开发内容
- 隐藏非目标入口（优惠、会员、积分、售后、物流等）。
- 保留首页、分类、点单车、订单、我的五类基础入口。

涉及模块
- app.json
- custom-tab-bar/data.js
- pages/usercenter
- pages/order/*（非目标子页）

测试重点
- 路由可达性与页面白屏检查。

注意事项
- 采用“隐藏优先、删除其次”的策略。

#### 第三阶段：改造商品为菜品
开发内容
- 统一文案与字段映射（商品 -> 菜品）。
- 列表与详情页展示项调整（如规格、口味、份量）。

涉及模块
- pages/goods/list
- pages/goods/details
- components/goods-card
- services/good
- model/good

测试重点
- 菜品浏览、加车、规格选择。

注意事项
- 不强制重命名底层表结构，先做映射层兼容。

#### 第四阶段：增加订单备注功能
开发内容
- 订单确认页新增备注输入框。
- createOrder 增加 remark 字段并落库。
- 订单列表/详情/后台展示备注。

涉及模块
- pages/order/order-confirm
- pages/order/order-list
- pages/order/order-detail
- services/order/order.js
- model/order
- 管理后台订单模块

测试重点
- 备注写入、查询、展示全链路。

注意事项
- 备注字段长度限制、敏感词过滤、XSS 安全转义。

#### 第五阶段：联调下单和支付流程
开发内容
- 联调点单车下单、订单生成、微信支付、状态更新。
- 校验支付成功后订单状态与备注完整性。

涉及模块
- pages/cart
- pages/order/order-confirm
- services/order/order.js
- services/order/orderItem.js
- services/pay/pay.js

测试重点
- 下单成功率、支付成功率、失败重试能力。

注意事项
- 保持支付接口稳定，重点看状态流与幂等。

#### 第六阶段：测试和修复问题
开发内容
- 功能测试、异常测试、兼容性测试、灰度验证。
- 修复阻断问题并准备上线文档。

涉及模块
- 全模块回归

测试重点
- 主链路稳定性、订单状态一致性、支付与备注数据一致性。

注意事项
- 上线前进行一次真实支付沙箱或小额验证。

### 5. 里程碑与交付物
- M1（阶段一结束）：改造清单、风险清单、接口清单。
- M2（阶段二至四结束）：可下单且支持备注的测试版本。
- M3（阶段五结束）：支付联调通过，订单状态闭环。
- M4（阶段六结束）：测试报告、上线检查单、发布版本。

### 6. 验收标准
- 用户可完成“选菜 -> 点单车 -> 下单（含备注） -> 微信支付 -> 查看订单”的完整流程。
- 后台可查看订单备注。
- 非目标复杂功能均被隐藏或下线，不影响主流程稳定性。
- 支付成功后正确生成外卖订单，状态与金额一致。