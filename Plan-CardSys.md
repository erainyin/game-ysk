# 卡牌（道具）系统设计文档

## 一、需求概述

为 YSK 大作战游戏添加卡牌（道具）系统。每位玩家初始拥有 **10 点** 点数，可在游戏第一回合前的「购买阶段」购买卡牌。卡牌分为 **攻击型** 和 **防御型** 两类，每张卡牌有各自的点数花费，玩家可购买的数量由剩余点数决定。

卡牌可在游戏任意阶段使用：轮到玩家回合时，**掷骰子之前** 可使用任意数量的卡牌。卡牌使用后即消失（一次性消耗品）。

系统采用可扩展的规则列表方式维护卡牌定义，便于后续添加新卡牌。未来计划引入「商店系统」，玩家在游戏中可通过积攒点数随时购买卡牌，因此本设计在数据结构与流程上预留扩展空间。

## 二、点数系统

### 2.1 点数规则

| 规则 | 说明 |
|------|------|
| 初始点数 | 每位玩家游戏开始时拥有 10 点 |
| 购买阶段 | 游戏第一回合开始前，进入购买阶段，玩家用点数购买卡牌 |
| 卡牌花费 | 每张卡牌有 `cost` 字段（1～5 点），购买时扣除对应点数 |
| 购买数量 | 玩家可购买卡牌的数量 = 点数预算内可承受的卡牌数（不限张数，只看点数） |
| 剩余点数 | 购买阶段结束后，剩余点数保留并累积，供未来商店系统使用 |
| 使用不耗点 | 卡牌使用时不消耗点数（点数仅用于购买） |

### 2.2 购买阶段流程

```
游戏开始 → [购买阶段] → 第1回合开始 → 正常游戏流程
                │
                ├── 显示玩家点数（10点）
                ├── 展示可购买卡牌列表（含花费、效果说明）
                ├── 玩家选择卡牌购买，扣除点数
                ├── 玩家可继续购买直到点数不足或主动结束
                └── 点击「开始游戏」进入第1回合
```

### 2.3 人机大战模式下的购买

- **人类玩家**：手动在购买界面选择卡牌
- **AI 玩家**：自动随机购买卡牌（在点数预算内随机挑选卡牌组合，优先保证攻防平衡）

## 三、卡牌数据结构

每张卡牌包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 卡牌唯一标识符 |
| `name` | string | 卡牌名称（中文） |
| `description` | string | 卡牌效果描述 |
| `icon` | string | 卡牌图标（图片文件名，不含路径） |
| `type` | string | 卡牌类型：`attack`（攻击型）/ `defense`（防御型） |
| `cost` | number | 购买花费点数（1～5） |
| `targetType` | string | 目标类型：`self`（自身）/ `enemy`（指定敌方）/ `position`（指定位置）/ `all_enemies`（所有敌方） |
| `effects` | array | 效果列表，每个元素包含 `type`、`params`、可选 `duration` |

### 3.1 效果类型定义

| 效果类型 | 说明 | 参数 | 类别 |
|----------|------|------|------|
| `damage` | 对目标造成伤害 | `amount`（伤害值） | 即时 |
| `heal` | 恢复自身血量 | `amount`（恢复值） | 即时 |
| `move_self` | 自身前进/后退 | `steps`（步数，正为前进，负为后退） | 即时 |
| `move_target` | 目标前进/后退 | `steps`（步数，正为前进，负为后退） | 即时 |
| `swap_position` | 与目标交换位置 | 无 | 即时 |
| `steal_health` | 偷取目标血量 | `amount`（偷取值） | 即时 |
| `shield` | 抵挡下一次伤害 | `amount`（抵挡次数） | 状态 |
| `reflect` | 反弹下一次受到的攻击 | `duration`（持续回合数） | 状态 |
| `slow_target` | 目标下次掷骰减半 | `duration`（持续回合数） | 状态 |
| `undying` | 下次死亡时存活 | `duration`（持续回合数） | 状态 |
| `purify` | 清除自身所有负面状态 | 无 | 即时 |
| `place_bomb` | 在目标位置放置炸弹 | `range`（爆炸范围）、`damage`（伤害值） | 即时 |

### 3.2 状态效果说明

状态效果会挂在玩家身上，在特定时机触发后移除：

| 状态 | 触发时机 | 移除时机 |
|------|----------|----------|
| `shield` | 受到伤害时 | 抵挡一次后移除 |
| `reflect` | 受到攻击伤害时 | 反弹一次后移除 / 持续回合到期 |
| `slow_target` | 目标掷骰子计算步数时 | 生效一次后移除 |
| `undying` | 玩家死亡判定时 | 触发存活后移除 / 持续回合到期 |

### 3.3 图片资源存放

卡牌图标图片存放在项目的 `assets/cards/` 目录下，文件格式为 PNG：

```
game-ysk/
├── assets/
│   └── cards/
│       ├── fireball.png        # 火球术
│       ├── slow_curse.png      # 减速诅咒
│       ├── swap.png            # 交换位置
│       ├── life_drain.png      # 偷取生命
│       ├── push_back.png       # 推后
│       ├── bomb_card.png       # 炸弹
│       ├── shield.png          # 护盾
│       ├── heal.png            # 治疗
│       ├── blink.png           # 闪现
│       ├── undying.png         # 不死之身
│       ├── reflect.png         # 反弹
│       └── purify.png          # 净化
```

图片路径拼接规则：`assets/cards/${card.icon}`

## 四、初始卡牌列表

### 攻击型卡牌

#### 卡牌1：火球术 (fireball)

- **名称**：火球术
- **类型**：攻击型
- **描述**：对指定玩家造成 2 点伤害
- **图标**：`fireball.png`
- **花费**：2 点
- **目标**：`enemy`（指定敌方）
- **效果**：
  ```javascript
  [{ type: 'damage', params: { amount: 2 } }]
  ```

#### 卡牌2：减速诅咒 (slow_curse)

- **名称**：减速诅咒
- **类型**：攻击型
- **描述**：指定玩家下回合掷骰数减半（向下取整）
- **图标**：`slow_curse.png`
- **花费**：2 点
- **目标**：`enemy`（指定敌方）
- **效果**：
  ```javascript
  [{ type: 'slow_target', params: {}, duration: 1 }]
  ```

#### 卡牌3：交换位置 (swap)

- **名称**：交换位置
- **类型**：攻击型
- **描述**：与指定玩家交换当前位置
- **图标**：`swap.png`
- **花费**：4 点
- **目标**：`enemy`（指定敌方）
- **效果**：
  ```javascript
  [{ type: 'swap_position', params: {} }]
  ```

#### 卡牌4：偷取生命 (life_drain)

- **名称**：偷取生命
- **类型**：攻击型
- **描述**：从指定玩家偷取 2 点血量，转化为自身血量
- **图标**：`life_drain.png`
- **花费**：4 点
- **目标**：`enemy`（指定敌方）
- **效果**：
  ```javascript
  [{ type: 'steal_health', params: { amount: 2 } }]
  ```

#### 卡牌5：推后 (push_back)

- **名称**：推后
- **类型**：攻击型
- **描述**：将指定玩家向后推 3 步
- **图标**：`push_back.png`
- **花费**：2 点
- **目标**：`enemy`（指定敌方）
- **效果**：
  ```javascript
  [{ type: 'move_target', params: { steps: -3 } }]
  ```

#### 卡牌6：炸弹 (bomb_card)

- **名称**：炸弹
- **类型**：攻击型
- **描述**：在指定玩家位置放置炸弹，影响前后 2 格内所有玩家，各造成 2 点伤害
- **图标**：`bomb_card.png`
- **花费**：4 点
- **目标**：`enemy`（指定敌方，以其位置为炸弹中心）
- **效果**：
  ```javascript
  [{ type: 'place_bomb', params: { range: 2, damage: 2 } }]
  ```

### 防御型卡牌

#### 卡牌7：护盾 (shield)

- **名称**：护盾
- **类型**：防御型
- **描述**：抵挡下一次受到的伤害（不受伤害）
- **图标**：`shield.png`
- **花费**：2 点
- **目标**：`self`（自身）
- **效果**：
  ```javascript
  [{ type: 'shield', params: { amount: 1 } }]
  ```

#### 卡牌8：治疗 (heal)

- **名称**：治疗
- **类型**：防御型
- **描述**：恢复 3 点血量
- **图标**：`heal.png`
- **花费**：2 点
- **目标**：`self`（自身）
- **效果**：
  ```javascript
  [{ type: 'heal', params: { amount: 3 } }]
  ```

#### 卡牌9：闪现 (blink)

- **名称**：闪现
- **类型**：防御型
- **描述**：不掷骰子，直接前进 4 步（使用后本回合仍可掷骰子）
- **图标**：`blink.png`
- **花费**：3 点
- **目标**：`self`（自身）
- **效果**：
  ```javascript
  [{ type: 'move_self', params: { steps: 4 } }]
  ```

#### 卡牌10：不死之身 (undying)

- **名称**：不死之身
- **类型**：防御型
- **描述**：3 回合内下次死亡时存活并恢复 1 点血量
- **图标**：`undying.png`
- **花费**：4 点
- **目标**：`self`（自身）
- **效果**：
  ```javascript
  [{ type: 'undying', params: { amount: 1 }, duration: 3 }]
  ```

#### 卡牌11：反弹 (reflect)

- **名称**：反弹
- **类型**：防御型
- **描述**：3 回合内下次受到攻击伤害时，将伤害反弹给攻击者
- **图标**：`reflect.png`
- **花费**：2 点
- **目标**：`self`（自身）
- **效果**：
  ```javascript
  [{ type: 'reflect', params: {}, duration: 3 }]
  ```

#### 卡牌12：净化 (purify)

- **名称**：净化
- **类型**：防御型
- **描述**：清除自身所有负面状态（减速、被推后等）
- **图标**：`purify.png`
- **花费**：2 点
- **目标**：`self`（自身）
- **效果**：
  ```javascript
  [{ type: 'purify', params: {} }]
  ```

## 五、卡牌系统架构

### 5.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                  卡牌系统 (CardSystem)                        │
├─────────────────────────────────────────────────────────────┤
│  卡牌定义层 (CardDefinitions)                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ fireball │ │  shield  │ │   heal   │ │   swap   │ ...   │
│  │ attack   │ │ defense  │ │ defense  │ │ attack   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  点数与背包层 (Inventory)                                     │
│  ├── player.points              玩家点数                     │
│  ├── player.cards[]             玩家手牌                     │
│  └── player.activeStatuses[]    激活中的状态效果             │
├─────────────────────────────────────────────────────────────┤
│  效果处理器层 (CardEffectHandlers)                            │
│  ├── handleDamage(game, source, target, params)             │
│  ├── handleHeal(game, player, params)                       │
│  ├── handleMoveSelf(game, player, params)                   │
│  ├── handleMoveTarget(game, source, target, params)         │
│  ├── handleSwapPosition(game, source, target)               │
│  ├── handleStealHealth(game, source, target, params)        │
│  ├── handleShield(game, player, params)                     │
│  ├── handleReflect(game, player, params)                    │
│  ├── handleSlowTarget(game, source, target, params)         │
│  ├── handleUndying(game, player, params)                    │
│  ├── handlePurify(game, player)                             │
│  └── handlePlaceBomb(game, source, target, params)          │
├─────────────────────────────────────────────────────────────┤
│  触发时机层 (TriggerPoints)                                   │
│  ├── 购买阶段 → purchasePhase()                              │
│  ├── 掷骰前  → useCard()（玩家主动使用）                     │
│  ├── 掷骰后  → applySlowEffect()（减速状态生效）             │
│  ├── 受伤时  → applyShield/Reflect()（护盾/反弹状态生效）    │
│  └── 死亡判定 → applyUndying()（不死状态生效）               │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 玩家卡牌状态

在 Player 类中添加卡牌相关字段：

```javascript
class Player {
    constructor(id, name, color) {
        // ... 原有字段 ...

        // 卡牌系统相关
        this.points = 10;                 // 当前点数
        this.cards = [];                  // 手牌列表（卡牌对象数组）
        this.activeStatuses = [];         // 激活中的状态效果
        // activeStatuses 元素结构：
        // { type: 'shield', amount: 1 }
        // { type: 'reflect', remainingTurns: 3 }
        // { type: 'slow', remainingTurns: 1 }（负面，作用于自身）
        // { type: 'undying', amount: 1, remainingTurns: 3 }
    }
}
```

## 六、效果触发时机与实现逻辑

### 6.1 购买阶段

游戏开始后、第1回合前进入购买阶段：

```javascript
// Game 类新增
startPurchasePhase() {
    this.gameState = 'purchase';
    this.onPurchasePhase && this.onPurchasePhase();
}

purchaseCard(player, cardId) {
    const card = cardSystem.getCardById(cardId);
    if (!card || player.points < card.cost) return false;

    player.points -= card.cost;
    player.cards.push({ ...card, instanceId: Date.now() + Math.random() });
    return true;
}

finishPurchasePhase() {
    this.gameState = 'playing';
    this.start();  // 进入正常游戏流程
}
```

### 6.2 掷骰子前（玩家主动使用卡牌）

轮到玩家回合、掷骰子前，玩家可使用卡牌：

```javascript
// Game 类新增
useCard(player, cardInstanceId, targetPlayerId = null) {
    // 仅当前回合玩家可使用
    if (player.id !== this.getCurrentPlayer().id) return;
    // 掷骰子后不可使用（本回合已掷骰）
    if (player.hasRolled) return;

    const cardIndex = player.cards.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndex === -1) return;

    const card = player.cards[cardIndex];
    const target = targetPlayerId !== null
        ? this.players.find(p => p.id === targetPlayerId)
        : null;

    // 执行效果
    card.effects.forEach(effect => {
        this.executeCardEffect(card, effect, player, target);
    });

    // 移除卡牌
    player.cards.splice(cardIndex, 1);
    this.log(`${player.name} 使用了 [${card.name}]`, true);
    this.onStateChange && this.onStateChange();
}

executeCardEffect(card, effect, source, target) {
    switch (effect.type) {
        case 'damage':
            this.dealCardDamage(source, target, effect.params.amount);
            break;
        case 'heal':
            source.changeHealth(effect.params.amount);
            break;
        case 'move_self':
            this.movePlayerInstant(source, effect.params.steps);
            break;
        case 'move_target':
            this.movePlayerInstant(target, effect.params.steps);
            break;
        case 'swap_position':
            this.swapPositions(source, target);
            break;
        case 'steal_health':
            target.changeHealth(-effect.params.amount);
            source.changeHealth(effect.params.amount);
            break;
        case 'shield':
        case 'reflect':
        case 'undying':
            source.activeStatuses.push({
                type: effect.type,
                amount: effect.params.amount || 1,
                remainingTurns: effect.duration || 0
            });
            break;
        case 'slow_target':
            target.activeStatuses.push({
                type: 'slow',
                amount: 0,
                remainingTurns: effect.duration || 1
            });
            break;
        case 'purify':
            source.activeStatuses = source.activeStatuses.filter(s => !this.isNegativeStatus(s));
            break;
        case 'place_bomb':
            this.handleCardBomb(source, target, effect.params);
            break;
    }
}
```

### 6.3 掷骰子时（减速状态生效）

在 `rollDice()` 中检查减速状态：

```javascript
rollDice() {
    // ... 原有逻辑 ...
    this.dice.roll((value) => {
        let finalValue = value;

        // 飞贼皮肤速度加成
        if (rollingPlayer.speedBoostRemainingTurns > 0) {
            finalValue = value * 2;
        }

        // 减速诅咒状态
        const slowStatus = rollingPlayer.activeStatuses.find(s => s.type === 'slow');
        if (slowStatus) {
            finalValue = Math.floor(finalValue / 2);
            this.log(`${rollingPlayer.name} 被减速！骰子数减半：${value}→${finalValue}`, true);
            // 移除减速状态（一次性）
            rollingPlayer.activeStatuses = rollingPlayer.activeStatuses.filter(s => s !== slowStatus);
        }

        this.lastRollValue = finalValue;
        // ... 后续逻辑 ...
    });
}
```

### 6.4 受到伤害时（护盾/反弹状态生效）

修改 `Player.changeHealth()` 或在伤害来源处拦截。建议在 Game 层统一处理卡牌伤害，复用现有伤害流程：

```javascript
// Game 类新增
dealCardDamage(source, target, amount) {
    // 检查目标护盾
    const shield = target.activeStatuses.find(s => s.type === 'shield');
    if (shield && shield.amount > 0) {
        shield.amount--;
        if (shield.amount <= 0) {
            target.activeStatuses = target.activeStatuses.filter(s => s !== shield);
        }
        this.notify(`${target.name} 的护盾抵挡了伤害！`, 'info');
        return;
    }

    // 检查目标反弹
    const reflect = target.activeStatuses.find(s => s.type === 'reflect');
    if (reflect) {
        target.activeStatuses = target.activeStatuses.filter(s => s !== reflect);
        this.notify(`${target.name} 反弹了攻击！`, 'warning');
        // 反弹给攻击者（攻击者不享受自己的护盾反弹递归，直接扣血）
        source.changeHealth(-amount);
        this.checkGameEnd();
        return;
    }

    // 正常扣血
    target.changeHealth(-amount);
    this.notify(`${target.name} 受到 ${amount} 点伤害`, 'danger');
    this.checkGameEnd();
}
```

### 6.5 死亡判定时（不死状态生效）

在死亡判定逻辑中检查 `undying` 状态：

```javascript
// 修改 DDD / 炸弹等死亡判定逻辑
handlePlayerDeath(player) {
    const undying = player.activeStatuses.find(s => s.type === 'undying');
    if (undying && undying.amount > 0) {
        undying.amount--;
        if (undying.amount <= 0) {
            player.activeStatuses = player.activeStatuses.filter(s => s !== undying);
        }
        player.health = Math.max(player.health, 1);
        player.isDead = false;
        this.notify(`${player.name} 触发不死之身，存活下来！`, 'info');
        return true;  // 已被不死状态挽救
    }
    return false;
}
```

### 6.6 回合结束时（状态回合数递减）

在 `nextTurn()` 中递减持续状态回合数：

```javascript
nextTurn() {
    // ... 原有逻辑 ...

    const previousPlayer = this.players[this.currentPlayerIndex];
    if (previousPlayer) {
        // 递减有持续回合的状态
        previousPlayer.activeStatuses.forEach(status => {
            if (status.remainingTurns > 0) {
                status.remainingTurns--;
            }
        });
        // 移除过期的状态
        previousPlayer.activeStatuses = previousPlayer.activeStatuses.filter(
            s => s.remainingTurns !== 0 || s.type === 'shield'  // 护盾无回合限制，按次数
        );
    }

    // ... 后续逻辑 ...
}
```

## 七、购买阶段 UI 设计

### 7.1 购买阶段弹窗

购买阶段在玩家选择弹窗之后、游戏开始前展示：

```
┌─────────────────────────────────────────────────────┐
│  🛒 卡牌购买阶段                          [关闭] ✕   │
├─────────────────────────────────────────────────────┤
│  💰 剩余点数：7                                      │
├─────────────────────────────────────────────────────┤
│  ⚔️ 攻击型卡牌                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ 🔥   │ │ 🐌   │ │ 🔄   │ │ 🩸   │ │ ⬅️   │     │
│  │火球术 │ │减速  │ │交换  │ │偷取  │ │推后  │     │
│  │ 3点  │ │ 2点  │ │ 4点  │ │ 3点  │ │ 2点  │     │
│  │[购买] │ │[购买] │ │[购买] │ │[购买] │ │[购买] │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
├─────────────────────────────────────────────────────┤
│  🛡️ 防御型卡牌                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ 🛡️   │ │ 💚   │ │ ⚡   │ │ 💀   │ │ 🔁   │     │
│  │护盾  │ │治疗  │ │闪现  │ │不死  │ │反弹  │     │
│  │ 2点  │ │ 2点  │ │ 3点  │ │ 4点  │ │ 2点  │     │
│  │[购买] │ │[购买] │ │[购买] │ │[购买] │ │[购买] │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
├─────────────────────────────────────────────────────┤
│  🃏 我的卡牌（3张）：                                │
│  [🔥火球术] [🛡️护盾] [💚治疗]                        │
├─────────────────────────────────────────────────────┤
│              [开始游戏]                              │
└─────────────────────────────────────────────────────┘
```

### 7.2 卡牌详情提示

悬停或点击卡牌时显示详情：

```
┌─────────────────────────────────────┐
│  🔥 火球术                    ⚔️攻击 │
│  花费：3 点                          │
│  对指定玩家造成 2 点伤害             │
└─────────────────────────────────────┘
```

## 八、卡牌使用 UI 设计

### 8.1 手牌区域

游戏进行中，在骰子按钮上方显示玩家手牌：

```
┌─────────────────────────────────────────┐
│  当前玩家：我                            │
│  🃏 手牌：                               │
│  ┌────┐ ┌────┐ ┌────┐                  │
│  │ 🔥 │ │ 🛡️ │ │ 💚 │  ← 点击使用      │
│  └────┘ └────┘ └────┘                  │
│                                         │
│  [🎲 掷骰子]                            │
└─────────────────────────────────────────┘
```

### 8.2 目标选择

使用需要指定目标的卡牌时，弹出目标选择界面（复用现有玩家选择交互）：

```
┌─────────────────────────────────────────┐
│  选择目标 - 火球术                       │
│  对指定玩家造成 2 点伤害                 │
├─────────────────────────────────────────┤
│  ● 玩家2  📍12 🩸3                      │
│  ● 玩家3  📍25 🩸2                      │
├─────────────────────────────────────────┤
│              [取消]                      │
└─────────────────────────────────────────┘
```

### 8.3 AI 使用卡牌逻辑

AI 玩家在回合开始时（掷骰子前）自动使用卡牌：

```javascript
aiUseCards(player) {
    // 简单策略：
    // 1. 血量低时优先使用治疗/护盾/不死
    // 2. 有攻击卡时，对血量最低的敌方使用
    // 3. 有概率使用，避免每回合必用
    if (player.cards.length === 0) return;

    // 防御优先
    if (player.health <= 2) {
        const healCard = player.cards.find(c => c.id === 'heal');
        if (healCard) {
            this.useCard(player, healCard.instanceId);
        }
    }

    // 攻击：随机对血量最低的敌方使用攻击卡
    if (Math.random() < 0.5) {
        const attackCard = player.cards.find(c => c.type === 'attack');
        if (attackCard) {
            const enemies = this.players.filter(p => !p.isDead && p.id !== player.id);
            if (enemies.length > 0) {
                const target = enemies.reduce((min, p) => p.health < min.health ? p : min);
                this.useCard(player, attackCard.instanceId, target.id);
            }
        }
    }
}
```

## 九、代码实现步骤

### 步骤1：创建卡牌系统类

创建 `js/card_system.js`：

```javascript
class CardSystem {
    constructor() {
        this.cards = this.loadCards();
        this.iconPath = 'assets/cards/';
    }

    loadCards() {
        return [
            // 攻击型
            {
                id: 'fireball',
                name: '火球术',
                description: '对指定玩家造成 2 点伤害',
                icon: 'fireball.png',
                type: 'attack',
                cost: 3,
                targetType: 'enemy',
                effects: [{ type: 'damage', params: { amount: 2 } }]
            },
            {
                id: 'slow_curse',
                name: '减速诅咒',
                description: '指定玩家下回合掷骰数减半',
                icon: 'slow_curse.png',
                type: 'attack',
                cost: 2,
                targetType: 'enemy',
                effects: [{ type: 'slow_target', params: {}, duration: 1 }]
            },
            {
                id: 'swap',
                name: '交换位置',
                description: '与指定玩家交换当前位置',
                icon: 'swap.png',
                type: 'attack',
                cost: 4,
                targetType: 'enemy',
                effects: [{ type: 'swap_position', params: {} }]
            },
            {
                id: 'life_drain',
                name: '偷取生命',
                description: '从指定玩家偷取 2 点血量',
                icon: 'life_drain.png',
                type: 'attack',
                cost: 3,
                targetType: 'enemy',
                effects: [{ type: 'steal_health', params: { amount: 2 } }]
            },
            {
                id: 'push_back',
                name: '推后',
                description: '将指定玩家向后推 3 步',
                icon: 'push_back.png',
                type: 'attack',
                cost: 2,
                targetType: 'enemy',
                effects: [{ type: 'move_target', params: { steps: -3 } }]
            },
            {
                id: 'bomb_card',
                name: '炸弹',
                description: '在目标位置放置炸弹，前后2格内玩家各受2点伤害',
                icon: 'bomb_card.png',
                type: 'attack',
                cost: 4,
                targetType: 'enemy',
                effects: [{ type: 'place_bomb', params: { range: 2, damage: 2 } }]
            },
            // 防御型
            {
                id: 'shield',
                name: '护盾',
                description: '抵挡下一次受到的伤害',
                icon: 'shield.png',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                effects: [{ type: 'shield', params: { amount: 1 } }]
            },
            {
                id: 'heal',
                name: '治疗',
                description: '恢复 3 点血量',
                icon: 'heal.png',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                effects: [{ type: 'heal', params: { amount: 3 } }]
            },
            {
                id: 'blink',
                name: '闪现',
                description: '不掷骰子，直接前进 4 步',
                icon: 'blink.png',
                type: 'defense',
                cost: 3,
                targetType: 'self',
                effects: [{ type: 'move_self', params: { steps: 4 } }]
            },
            {
                id: 'undying',
                name: '不死之身',
                description: '3回合内下次死亡时存活并恢复1点血量',
                icon: 'undying.png',
                type: 'defense',
                cost: 4,
                targetType: 'self',
                effects: [{ type: 'undying', params: { amount: 1 }, duration: 3 }]
            },
            {
                id: 'reflect',
                name: '反弹',
                description: '3回合内下次受到攻击时将伤害反弹',
                icon: 'reflect.png',
                type: 'defense',
                cost: 3,
                targetType: 'self',
                effects: [{ type: 'reflect', params: {}, duration: 3 }]
            },
            {
                id: 'purify',
                name: '净化',
                description: '清除自身所有负面状态',
                icon: 'purify.png',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                effects: [{ type: 'purify', params: {} }]
            }
        ];
    }

    getCardById(id) {
        return this.cards.find(card => card.id === id);
    }

    getAllCards() {
        return this.cards;
    }

    getCardsByType(type) {
        return this.cards.filter(card => card.type === type);
    }

    getIconPath(cardId) {
        const card = this.getCardById(cardId);
        if (!card) return '';
        return this.iconPath + card.icon;
    }
}

const cardSystem = new CardSystem();
```

### 步骤2：创建图片资源目录

创建 `assets/cards/` 目录，放入以下图片文件：

| 文件名 | 说明 |
|--------|------|
| `fireball.png` | 火球术图标 |
| `slow_curse.png` | 减速诅咒图标 |
| `swap.png` | 交换位置图标 |
| `life_drain.png` | 偷取生命图标 |
| `push_back.png` | 推后图标 |
| `bomb_card.png` | 炸弹图标 |
| `shield.png` | 护盾图标 |
| `heal.png` | 治疗图标 |
| `blink.png` | 闪现图标 |
| `undying.png` | 不死之身图标 |
| `reflect.png` | 反弹图标 |
| `purify.png` | 净化图标 |

### 步骤3：扩展 Player 类

在 `js/player.js` 中添加卡牌相关字段：

```javascript
class Player {
    constructor(id, name, color) {
        // ... 原有字段 ...

        // 卡牌系统相关
        this.points = 10;
        this.cards = [];
        this.activeStatuses = [];
    }

    reset() {
        // ... 原有重置 ...

        this.points = 10;
        this.cards = [];
        this.activeStatuses = [];
    }

    addCard(card) {
        this.cards.push({ ...card, instanceId: Date.now() + Math.random() });
    }

    removeCard(instanceId) {
        const index = this.cards.findIndex(c => c.instanceId === instanceId);
        if (index !== -1) {
            return this.cards.splice(index, 1)[0];
        }
        return null;
    }

    addStatus(status) {
        this.activeStatuses.push(status);
    }

    hasStatus(type) {
        return this.activeStatuses.some(s => s.type === type);
    }

    removeStatus(type) {
        this.activeStatuses = this.activeStatuses.filter(s => s.type !== type);
    }
}
```

### 步骤4：修改游戏逻辑

在 `js/game.js` 中新增卡牌使用与效果处理方法，并在 `rollDice()`、`nextTurn()`、死亡判定处插入卡牌状态检查（详见第六节）。

### 步骤5：修改 UI，添加购买阶段

修改 `js/ui.js`，在玩家选择完成后进入购买阶段弹窗，购买完成后开始游戏。

### 步骤6：修改 UI，添加手牌与使用界面

在游戏界面骰子按钮上方添加手牌区域，实现点击使用、目标选择等交互。

### 步骤7：添加卡牌相关 CSS

在 `css/style.css` 中添加购买弹窗、手牌区域、卡牌卡片样式。

## 十、扩展卡牌规则的方法

### 10.1 添加新卡牌

只需在 `js/card_system.js` 的 `loadCards()` 方法中添加新卡牌对象：

```javascript
{
    id: 'new_card_id',
    name: '卡牌名称',
    description: '卡牌效果描述',
    icon: 'new_card.png',
    type: 'attack',       // 或 'defense'
    cost: 3,
    targetType: 'enemy',  // self / enemy / position / all_enemies
    effects: [
        { type: 'effect_type', params: { key: value }, duration: 2 }
    ]
}
```

同时在 `assets/cards/` 目录下添加对应的图片文件。

### 10.2 添加新效果类型

1. 在 `CardEffectHandlers` 中添加处理函数
2. 在 `executeCardEffect()` 的 `switch` 中注册
3. 在对应触发时机插入状态检查逻辑
4. 如有需要，在 Player 类中添加状态字段

## 十一、未来商店系统规划

本设计为未来「商店系统」预留扩展空间：

| 扩展点 | 说明 |
|--------|------|
| 点数累积 | 玩家点数不在购买阶段清零，游戏中可通过特定行为（击杀幽灵、超越玩家、触发特定格子）获得点数 |
| 随时购买 | 在玩家回合掷骰子前，可打开商店随时购买卡牌（不再限于第一回合） |
| 动态定价 | 商店可对卡牌进行动态定价或限量供应，增加策略性 |
| 卡牌稀有度 | 引入 `rarity` 字段（普通/稀有/史诗），稀有卡效果更强但花费更高 |
| 卡牌包 | 商店可购买「卡牌包」，随机获得若干张卡牌 |
| 卡牌升级 | 重复卡牌可合成升级，增强效果 |

实现时只需在 `CardSystem` 中增加 `shop` 相关方法，UI 中增加商店入口，核心卡牌使用流程无需改动。

## 十二、注意事项

1. **点数边界**：购买时检查 `player.points >= card.cost`，防止负数点数
2. **使用时机**：卡牌仅可在当前玩家回合、掷骰子前使用，`hasRolled` 为 true 时禁用
3. **目标有效性**：使用攻击卡时，目标不能是自己、不能是已死亡玩家
4. **状态叠加**：同名状态可叠加（如多次护盾），按次数/回合数独立计算
5. **状态重置**：`Player.reset()` 中需清空 `cards` 和 `activeStatuses`
6. **闪现与掷骰**：闪现（`move_self`）使用后不影响本回合掷骰子，是额外移动
7. **反弹不递归**：反弹造成的伤害不再触发对方的反弹/护盾，避免无限循环
8. **AI 平衡**：AI 使用卡牌应有概率限制，避免每回合必用导致难度过高
9. **游戏结束检查**：卡牌造成伤害/死亡后需调用 `checkGameEnd()`
10. **与皮肤系统兼容**：卡牌伤害与皮肤伤害减免（`damage_reduction`）叠加时，先计算皮肤减免，再检查护盾
11. **图片加载**：确保图片文件存在于 `assets/cards/` 目录下，建议 PNG 格式，尺寸 64×64 或 128×128
12. **移动端适配**：手牌区域与购买弹窗需适配窄屏（`max-width: 768px`），手牌可横向滚动
