# 商店格子系统（SHOP）

## 功能定义

- 格子标识：`SHOP`
- 名称：商店
- 变量：无
- 玩家走到 `SHOP` 格子后打开卡牌商店窗口。
- 窗口展示全部可购买卡牌及当前玩家点数。
- 点数足够的卡牌高亮，点数不足的卡牌置灰且不可选择。
- 玩家点击卡牌后先弹出确认操作层，点击“确认购买”后才扣除对应点数并加入手牌；购买完成后仍留在商店，可以继续购买；点击“我再想想”关闭确认层。
- 窗口同时展示玩家持有的卡牌；点击手牌即可出售，售价为卡牌原价的三分之一向下取整，最低为1点。
- 出售点击后先弹出“确认卖出这张卡牌？”确认层，点击“确认卖出”后玩家点数变化；点击“我再想想”关闭确认层。出售完成后立即刷新玩家点数和可购买卡牌状态，可以继续购买。
- 点击关闭按钮不购买卡牌，并正常结束当前回合。

## 实现方法

### 格子解析

在 `js/cell_properties.js` 的 `FUNCTION_MAP` 中注册 `SHOP`，类型为 `shop`，无变量，使用商店图标 `🛒`。运行时通过 `processCellProperty()` 将其转交给 `Game.processSingleProperty()`。

### 游戏逻辑

`Game.processSingleProperty()` 遇到 `shop` 时设置 `isSelectingShop`，阻止玩家在弹窗期间掷骰，并通过 `onShopSelect` 回调打开 UI。AI 会自动从点数足够的卡牌中随机购买；没有可购买卡牌时直接跳过。

`purchaseShopCard()` 调用现有的 `purchaseCard()` 完成扣点和加牌，但不会结束商店回合；`selectShopCard()` 供需要购买后立即结束流程的自动决策使用。`sellShopCard()` 通过卡牌实例移除手牌并返还 `Math.max(1, Math.floor(cost / 3))` 点数。出售不会结束商店回合，玩家可以继续购买；`cancelShop()` 只清理商店状态。点击离开商店才会调用 `nextTurn()`。

### 用户界面

`UI.showShopSelection()` 复用购买阶段的 `purchase-card-item`、`purchase-cards-grid`、`purchase-hand-card` 和弹窗样式。买卖卡牌点击后均在商店弹窗内显示确认 popover；“我再想想”关闭 popover，确认按钮执行对应操作。商店底部的“离开商店”按钮关闭窗口并跳过购买。出售完成后调用 `sellShopCard()` 刷新窗口。通过 `disabled` 样式表示点数不足的卡牌。

### 地图编辑器与说明

`mapeditor.html` 注册 `SHOP` 类型，并标记为无变量类型。`wiki.html` 的格子功能表同步记录商店规则。

## CSV 示例

```csv
格子,功能,变量
20,SHOP,
```