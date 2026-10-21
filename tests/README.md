# Functional regression tests

Run with Node.js 22+:

```sh
npm test
```

The suite executes the actual page/component methods, service modules and all 56
products from `services/cloudbaseMock/index.js`. Each test gets separate in-memory
storage and module state. The helper simulates `setData`, component observers,
property updates, emitted events and navigation; it does not run the WXML renderer.

Coverage includes inventory normalization, SKU selection, adding and updating cart
items, rapid quantity changes before checkout, selected-item totals, remark query
encoding, direct/cart ordering, duplicate submission, stock rollback, payment and
notification failures, order persistence, homepage pagination/retry, page routes, component/import integrity, unused privacy
API removal, address CRUD, and removal of clipboard APIs.

Notifications are captured in memory. Unexpected cloud calls and real payments
throw. Timers are controlled by the tests. No messages are sent to Feishu groups
and no real orders or payments are created.

Simulator taps and real-device checks remain a separate manual check, including
stepper keyboard behavior, popup gestures and visual layout.
