# 皮肤系统设计文档

## 一、需求概述

为 YSK 大作战游戏添加皮肤系统，玩家在开始游戏前可以选择一个皮肤，皮肤会为玩家提供特殊属性加成。皮肤效果在游戏过程中持续生效，直到游戏结束。采用可扩展的规则列表方式维护，便于后续添加新皮肤。

## 二、皮肤数据结构

每个皮肤包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 皮肤唯一标识符 |
| `name` | string | 皮肤名称（中文） |
| `description` | string | 皮肤描述 |
| `icon` | string | 皮肤图标（图片文件名，不含路径） |
| `color` | string | 皮肤主题色（用于UI展示） |
| `effects` | array | 效果列表，每个元素包含 `type` 和 `params` |

### 效果类型定义

| 效果类型 | 说明 | 参数 |
|----------|------|------|
| `area_damage` | 移动后对周围玩家造成伤害 | `range`（伤害范围，前后各N格） |
| `speed_boost` | 前N回合移动速度翻倍 | `duration`（持续回合数） |
| `extra_health` | 额外初始血量 | `amount`（额外血量值） |
| `double_defence` | 全局可抵消N次对手卡牌的负面效果 | `charges`（抵消次数） |
| `dragon_diagonal` | 全局可斜行N次（移动到对角格子） | `charges`（斜行次数） |
| `ghost_protect` | 幽灵保护次数增加 | `amount`（额外保护次数） |
| `damage_reduction` | 受到伤害减少百分比 | `reduction`（减少百分比，0-1） |
| `extra_roll` | 每回合额外掷骰子次数 | `amount`（额外次数） |
| `chaos_shuffle` | 移动后随机打乱周围格子属性 | `maxShuffles`（每局最大打乱次数）、`cooldown`（冷却回合数）、`startTurn`（起始回合） |
| `blood_amplify` | 踩到血量变化（BL）格子时，血量增减值乘以倍数 | `multiplier`（倍数，正数；正值加血/负值减血都乘此倍数） |
| `guardian_ghost` | 贴身幽灵最大持有数量+1，并初始拥有1个贴身幽灵 | `extraMax`（额外容量）、`initialGhost`（是否初始赋予1个贴身幽灵，布尔） |

### 图片资源存放

皮肤图标图片存放在项目的 `assets/skins/` 目录下，文件格式为 PNG：

```
game-ysk/
├── assets/
│   └── skins/
│       ├── default.png       # 默认皮肤图标
│       ├── tank.png          # 坦克皮肤图标
│       ├── thief.png         # 飞贼皮肤图标
│       ├── warrior.png       # 勇者皮肤图标
│       ├── double_defence.png # 两次防皮肤图标
│       ├── dragon.png        # 龙皮肤图标
│       ├── guardian.png      # 守护者皮肤图标
│       ├── iron_wall.png     # 铁壁皮肤图标
│       ├── chaos.png         # 颠倒师皮肤图标
│       └── super_warrior.png # 超级勇者皮肤图标
```

图片路径拼接规则：`assets/skins/${skin.icon}`

## 三、初始皮肤列表

### 皮肤0：默认 (default)

- **名称**：默认
- **描述**：无特殊效果，以初始状态开始游戏
- **图标**：`default.png`
- **颜色**：`#95a5a6`
- **效果**：无（空数组）

### 皮肤1：坦克 (tank)

- **名称**：坦克
- **描述**：每次移动后，前后2格范围内的其他玩家血量-1
- **图标**：`tank.png`
- **颜色**：`#7f8c8d`
- **效果**：
  ```javascript
  {
      type: 'area_damage',
      params: { range: 2 }
  }
  ```
- **触发时机**：玩家移动结束后
- **效果说明**：玩家移动到新位置后，对位置 `[newPos - range, newPos + range]` 范围内的所有其他玩家造成1点伤害

### 皮肤2：飞贼 (thief)

- **名称**：飞贼
- **描述**：前3回合移动速度翻倍，第4回合起恢复正常
- **图标**：`thief.png`
- **颜色**：`#9b59b6`
- **效果**：
  ```javascript
  {
      type: 'speed_boost',
      params: { duration: 3 }
  }
  ```
- **触发时机**：玩家掷骰子后计算移动步数时
- **效果说明**：前3回合移动步数 = 骰子数 × 2，第4回合起恢复正常

### 皮肤3：勇者 (warrior)

- **名称**：勇者
- **描述**：初始血量+3
- **图标**：`warrior.png`
- **颜色**：`#e74c3c`
- **效果**：
  ```javascript
  {
      type: 'extra_health',
      params: { amount: 3 }
  }
  ```
- **触发时机**：玩家创建时

### 皮肤4：两次防 (double_defence)

- **名称**：两次防
- **描述**：全局可防御2次对手卡牌的负面效果（如火球术、减速等攻击型卡牌），自动抵消
- **图标**：`double_defence.png`
- **颜色**：`#2980b9`
- **效果**：
  ```javascript
  {
      type: 'double_defence',
      params: { charges: 2 }
  }
  ```
- **触发时机**：对手使用攻击型卡牌（`targetType === 'enemy'`）对本玩家生效前
- **效果说明**：
  - 当对手使用攻击型卡牌（火球术、减速诅咒、交换位置、偷取生命、推后、炸弹）针对本玩家时，自动消耗1次防御次数，抵消该卡牌的全部负面效果
  - 卡牌仍会被消耗（对手 wasted 一张卡），但本玩家不受任何影响
  - 全局共2次，用尽后效果消失
  - 与护盾/反弹状态独立，优先于它们判定

### 皮肤5：龙 (dragon)

- **名称**：龙
- **描述**：全局可斜着走1次：每回合掷骰前可选择移动到对角格子，或正常掷骰。用过后只能掷骰
- **图标**：`dragon.png`
- **颜色**：`#27ae60`
- **效果**：
  ```javascript
  {
      type: 'dragon_diagonal',
      params: { charges: 1 }
  }
  ```
- **触发时机**：玩家回合的掷骰阶段（掷骰前）
- **效果说明**：
  - 当本玩家回合进入掷骰阶段时，若仍有斜行次数，弹出对话框显示：
    - 当前位置在 2D 网格上的 4 个对角格子（`(row±1, col±1)`）的编号，作为可点击按钮
    - 一个「🎲 投掷骰子」按钮
  - **选择格子**：直接移动到该格子位置（瞬移），消耗1次斜行次数，触发落点效果（坦克光环/超越判定/格子属性/终点判定），本回合结束
  - **选择投掷骰子**：关闭对话框，按正常流程掷骰移动（不消耗斜行次数）
  - **边界处理**：棋子在棋盘边缘时，被挡住的方向（超出网格范围）不显示，只显示有效的对角格子
  - **次数用尽**：斜行次数归零后，不再弹窗，每回合只能正常掷骰
  - **AI 决策**：AI 玩家自动决策，仅当最靠前的对角格子能推进时，50% 概率使用斜行，否则掷骰
  - **坐标转换**：使用 `board.getPositionByNumber`（编号→行列）与 `board.getNumberByPosition`（行列→编号）在蛇形(zigzag)布局上换算

### 皮肤6：守护者 (guardian)

- **名称**：守护者
- **描述**：贴身幽灵最大持有数量+1，并且初始就拥有1个贴身幽灵
- **图标**：`guardian.png`
- **颜色**：`#16a085`
- **效果**：
  ```javascript
  {
      type: 'guardian_ghost',
      params: { extraMax: 1, initialGhost: true }
  }
  ```
- **触发时机**：玩家设置皮肤时（`setSkin`）
- **效果说明**：
  - 贴身幽灵（`ghostType === 2`）的最大持有数量上限 +1（默认 `maxGhostCount = 3`，守护者生效后变为 4）
  - 设置皮肤时，若玩家当前没有幽灵，立即获得1个贴身幽灵（`hasGhost = true`、`ghostType = 2`、`ghostHealth = 1`、`ghostCount = 1`、`ghostPosition = player.position`）
  - 若玩家已有幽灵（如通过踩 ghost 召唤格获得），不覆盖已有幽灵，仅提升上限
  - 贴身幽灵位置始终跟随玩家（`Player.moveTo` 中同步 `ghostPosition`）
- **实现细节**：
  - `Player.maxGhostCount`：默认 3，`setSkin` 中 +1；`reset()` 中重置回 3
  - `Player.setSkin()`：在 `guardian_ghost` 分支中提升上限并赋予初始幽灵
  - `Player.changeSkin()`：移除旧守护者效果时减回上限，若当前 `ghostHealth` 超过新上限则截断

### 皮肤7：铁壁 (iron_wall)

- **名称**：铁壁
- **描述**：受到的所有伤害减少50%
- **图标**：`iron_wall.png`
- **颜色**：`#2c3e50`
- **效果**：
  ```javascript
  {
      type: 'damage_reduction',
      params: { reduction: 0.5 }
  }
  ```
- **触发时机**：玩家受到伤害时

### 皮肤8：颠倒师 (chaos)

- **名称**：颠倒师
- **描述**：从第2回合开始，走子后随机打乱周围8格属性（2回合冷却），每局最多3次。皮肤神殿可重置次数
- **图标**：`chaos.png`
- **颜色**：`#e91e63`
- **效果**：
  ```javascript
  {
      type: 'chaos_shuffle',
      params: { maxShuffles: 3, cooldown: 2, startTurn: 2 }
  }
  ```
- **触发时机**：玩家移动结束后
- **效果说明**：
  - 从第2回合起，每次移动结束后检查是否满足触发条件
  - 触发条件：`chaosTurnCount >= startTurn(2)` 且 `(chaosTurnCount - startTurn) % (cooldown + 1) === 0`，即第2、5、8……回合触发
  - 每次触发：将自身周围8个格子（跳过自身所在格子、起点、终点）的属性随机打乱（Fisher-Yates 洗牌算法）
  - 自身所在格子的属性保持不变
  - 每局最多触发 `maxShuffles`(3) 次，达到上限后不再触发
  - 踩到皮肤神殿（SKIN）格子并重新选择颠倒师皮肤时，`chaosShuffleCount` 重置为0，可再次使用
- **实现细节**：
  - `Player.chaosTurnCount`：记录已走子回合数（每回合移动结束后+1）
  - `Player.chaosShuffleCount`：记录已使用打乱次数（每局最多3次）
  - `Game.handleChaosShuffle(player, centerPos, params)`：核心打乱逻辑
  - 打乱后通过 `onChaosShuffle` 回调通知 UI 重新渲染棋盘
  - `changeSkin()` 中重置 `chaosTurnCount = 0`、`chaosShuffleCount = 0`

### 皮肤9：超级勇者 (super_warrior)

- **名称**：超级勇者
- **描述**：走到加血格子时，加血量乘2倍；走到减血格子时，减血量也乘2倍。无回合限制
- **图标**：`super_warrior.png`
- **颜色**：`#c0392b`
- **效果**：
  ```javascript
  {
      type: 'blood_amplify',
      params: { multiplier: 2 }
  }
  ```
- **触发时机**：玩家踩到血量变化（BL）格子时
- **效果说明**：
  - 当玩家走到 BL 格子（无论加血 BL+X 还是减血 BL-X），血量变化值都乘以 `multiplier`(2)
  - 加血例子：BL+2 → 实际加血 4
  - 减血例子：BL-1 → 实际减血 2
  - 无回合限制，每局可无限次生效
  - 与"不死之身"卡牌兼容：减血放大后若触发死亡，不死之身正常挽救
  - 仅对玩家自身踩到 BL 格子生效，不影响幽灵触发 BL 的逻辑（`processGhostProperty` 的 `blood` 分支不受影响）
- **实现细节**：
  - `Game.applyBloodAmplify(player, value)`：在 `processSingleProperty` 的 `blood` 分支中调用，遍历 `player.skin.effects` 查找 `blood_amplify` 类型效果，将 `value` 乘以 `multiplier`
  - 保留正负号：`amplified = value * multiplier`（正值仍为加血，负值仍为减血）
  - 触发时 notify 提示"超级勇者效果：血量加/减 X→Y（×2）"，便于玩家感知
  - `Player` 类无需新增字段（被动效果，无状态）
  - `setSkin()` / `changeSkin()` 中无需特殊处理（皮肤切换自然生效/失效）

## 四、皮肤系统架构

### 4.1 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    皮肤系统 (SkinSystem)                  │
├─────────────────────────────────────────────────────────┤
│  皮肤数据层                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Tank      │  │   Thief     │  │   Warrior   │ ... │
│  │  area_damage│  │ speed_boost │  │extra_health │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│  效果处理器层 (EffectHandlers)                            │
│  ├── handleAreaDamage(player, game)                      │
│  ├── handleSpeedBoost(player, game, rollValue)           │
│  ├── handleExtraHealth(player)                           │
│  ├── handleGhostProtect(player)                          │
│  ├── handleDamageReduction(player, damageAmount)         │
│  └── handleChaosShuffle(player, centerPos, params)       │
├─────────────────────────────────────────────────────────┤
│  触发时机层 (TriggerPoints)                               │
│  ├── 玩家创建时 → applyInitialEffects()                  │
│  ├── 掷骰子后 → applySpeedEffects()                      │
│  ├── 移动结束后 → applyMoveEffects()                     │
│  └── 受到伤害时 → applyDamageEffects()                   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 玩家皮肤状态

在 Player 类中添加皮肤相关字段：

```javascript
class Player {
    constructor(id, name, color) {
        // ... 原有字段 ...
        
        // 皮肤相关
        this.skin = null;                  // 选中的皮肤对象
        this.skinEffects = {};             // 皮肤效果状态
        
        // 飞贼皮肤专用状态
        this.speedBoostRemainingTurns = 0; // 剩余加速回合数
        
        // 颠倒师皮肤专用状态
        this.chaosTurnCount = 0;        // 已走子回合数
        this.chaosShuffleCount = 0;     // 已使用打乱次数（每局最多3次）
    }
}
```

## 五、效果触发时机与实现逻辑

### 5.1 玩家创建时

触发 `extra_health`、`ghost_protect` 等初始效果：

```javascript
// Game.start() 方法中创建玩家时
createPlayer(id, name, color, skinId = null) {
    const player = new Player(id, name, color);
    
    // 应用皮肤
    if (skinId && skinId !== 'default') {
        const skin = skinSystem.getSkinById(skinId);
        player.skin = skin;
        
        // 应用初始效果
        skin.effects.forEach(effect => {
            switch (effect.type) {
                case 'extra_health':
                    player.changeHealth(effect.params.amount);
                    break;
                case 'ghost_protect':
                    player.maxGhostCount += effect.params.amount;
                    break;
                case 'speed_boost':
                    player.speedBoostRemainingTurns = effect.params.duration;
                    break;
            }
        });
    }
    
    return player;
}
```

### 5.2 掷骰子后

触发 `speed_boost` 效果，修改移动步数：

```javascript
// Game.rollDice() 方法中
rollDice() {
    // ... 原有逻辑 ...
    
    this.dice.roll((value) => {
        // 应用速度加成效果
        let finalValue = value;
        if (rollingPlayer.speedBoostRemainingTurns > 0) {
            finalValue = value * 2;
            this.log(`${rollingPlayer.name} 速度翻倍！${value}×2=${finalValue}`, true);
        }
        
        this.lastRollValue = finalValue;
        // ... 后续逻辑 ...
    });
}

// 在 nextTurn() 中减少加速回合数
nextTurn() {
    // ... 原有逻辑 ...
    
    const previousPlayer = this.players[this.currentPlayerIndex];
    if (previousPlayer && previousPlayer.speedBoostRemainingTurns > 0) {
        previousPlayer.speedBoostRemainingTurns--;
        if (previousPlayer.speedBoostRemainingTurns === 0) {
            this.notify(`${previousPlayer.name} 的加速效果已结束！`, 'info');
        }
    }
}
```

### 5.3 移动结束后

触发 `area_damage` 效果：

```javascript
// Game.movePlayerStepByStep() 方法中，玩家到达终点后
if (hasReached) {
    player.moveTo(endPos);
    this.onPlayerMove && this.onPlayerMove(player, startPos, endPos, endPos - startPos);
    
    // 应用移动后效果（坦克皮肤）
    this.applyMoveEffects(player, endPos);
    
    // ... 后续逻辑 ...
}

applyMoveEffects(player, newPosition) {
        if (!player.skin) return;
        
        player.skin.effects.forEach(effect => {
            switch (effect.type) {
                case 'area_damage':
                    this.handleAreaDamage(player, newPosition, effect.params.range);
                    break;
                case 'chaos_shuffle':
                    player.chaosTurnCount++;
                    this.handleChaosShuffle(player, newPosition, effect.params);
                    break;
            }
        });
    }

handleAreaDamage(sourcePlayer, centerPos, range) {
    const affectedPlayers = this.players.filter(p => 
        !p.isDead && 
        !p.isWinner && 
        p.id !== sourcePlayer.id &&
        p.position >= centerPos - range &&
        p.position <= centerPos + range
    );
    
    if (affectedPlayers.length > 0) {
        this.notify(`${sourcePlayer.name} 的坦克光环生效！`, 'warning');
        
        affectedPlayers.forEach(target => {
            target.changeHealth(-1);
            this.notify(`${target.name} 被坦克光环伤害！血量-1`, 'danger');
        });
        
        // 检查是否需要结束游戏
        const alivePlayers = this.players.filter(p => !p.isDead);
        if (alivePlayers.length <= 1) {
            this.checkGameEnd();
        }
    }
}

handleChaosShuffle(player, centerPos, params) {
    const { maxShuffles, cooldown, startTurn } = params;

    // 已达最大打乱次数
    if (player.chaosShuffleCount >= maxShuffles) return;

    // 尚未到起始回合
    if (player.chaosTurnCount < startTurn) return;

    // 冷却判断：从 startTurn 起，每 (cooldown+1) 回合触发一次（即第2、5、8……回合）
    const turnsSinceStart = player.chaosTurnCount - startTurn;
    const cycleLength = cooldown + 1;
    if (turnsSinceStart % cycleLength !== 0) return;

    // 找到周围8个格子（自身所在格子不变）
    const { row, col } = this.board.getPositionByNumber(centerPos);
    const surroundingCells = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < CONFIG.ROWS && newCol >= 0 && newCol < CONFIG.COLS) {
                const cellNumber = this.board.getNumberByPosition(newRow, newCol);
                if (cellNumber === 1 || cellNumber === this.board.totalCells) continue;
                surroundingCells.push(cellNumber);
            }
        }
    }

    if (surroundingCells.length < 2) return;

    // 收集当前属性（无属性的格子记为 null）
    const propertiesToShuffle = surroundingCells.map(cellNum => CELL_PROPERTIES[cellNum] || null);
    const nonNullCount = propertiesToShuffle.filter(p => p !== null).length;
    if (nonNullCount === 0) return;

    // Fisher-Yates 洗牌
    const shuffled = [...propertiesToShuffle];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 重新分配属性
    surroundingCells.forEach((cellNum, index) => {
        const prop = shuffled[index];
        if (prop === null) {
            delete CELL_PROPERTIES[cellNum];
        } else {
            CELL_PROPERTIES[cellNum] = prop;
        }
    });

    player.chaosShuffleCount++;

    this.notify(`🌀 ${player.name} 颠倒师能力发动！周围${surroundingCells.length}个格子属性被打乱！（第${player.chaosShuffleCount}/${maxShuffles}次）`, 'warning');

    // 通知 UI 重新渲染棋盘
    if (this.onChaosShuffle) {
        this.onChaosShuffle(surroundingCells);
    }
}
```

#### 5.3.1 踩到血量变化格子时（超级勇者 `blood_amplify` 效果）

在 `Game.processSingleProperty()` 的 `blood` 分支中，先调用 `applyBloodAmplify()` 将血量变化值乘以倍数，再走原 `changeHealth` 逻辑：

```javascript
applyBloodAmplify(player, value) {
    if (!player.skin) return value;
    let amplified = value;
    let multiplier = 1;
    player.skin.effects.forEach(effect => {
        if (effect.type === 'blood_amplify') {
            multiplier = effect.params.multiplier || 2;
            amplified = value * multiplier;
        }
    });
    if (amplified !== value) {
        const sign = value > 0 ? '加' : '减';
        this.notify(`${player.name} 超级勇者效果：血量${sign}${Math.abs(value)}→${sign}${Math.abs(amplified)}（×${multiplier}）`, 'info');
        this.log(`超级勇者：BL${value > 0 ? '+' : ''}${value} → BL${amplified > 0 ? '+' : ''}${amplified}`);
    }
    return amplified;
}

processSingleProperty(player, type, value, rawValue = '') {
    switch (type) {
        case 'blood':
            // 超级勇者皮肤：血量变化乘倍数
            value = this.applyBloodAmplify(player, value);
            player.changeHealth(value);
            // ... 后续通知/日志逻辑 ...
            return false;
        // ... 其他 case ...
    }
}
```

### 5.4 受到伤害时

触发 `damage_reduction` 效果：

```javascript
// Player.changeHealth() 方法中
changeHealth(delta) {
    if (delta < 0) {
        // 应用伤害减免效果
        let actualDamage = Math.abs(delta);
        if (this.skin) {
            this.skin.effects.forEach(effect => {
                if (effect.type === 'damage_reduction') {
                    actualDamage = Math.ceil(actualDamage * (1 - effect.params.reduction));
                }
            });
        }
        
        this.health -= actualDamage;
        this.stats.damageTaken += actualDamage;
        
        if (this.health < this.stats.minimumHealth) {
            this.stats.minimumHealth = this.health;
        }
        
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
        }
    } else {
        this.health += delta;
        if (this.health > this.stats.maxHealth) {
            this.stats.maxHealth = this.health;
        }
    }
}
```

## 六、皮肤选择 UI 设计

### 6.1 玩家选择弹窗增强

在玩家选择弹窗中添加皮肤选择功能：

```
┌───────────────────────────────────────┐
│           选择玩家数量                 │
├───────────────────────────────────────┤
│  [2人]  [3人]  [4人]                  │
├───────────────────────────────────────┤
│                                       │
│  🎮 玩家1                             │
│  ┌─────────────────────────────┐      │
│  │ 选择皮肤：                   │      │
│  │  ┌─────┐ ┌─────┐ ┌─────┐   │      │
│  │  │ 🖼️  │ │ 🖼️  │ │ 🖼️  │   │      │
│  │  │ 默认 │ │ 坦克 │ │ 飞贼 │   │      │
│  │  └─────┘ └─────┘ └─────┘   │      │
│  └─────────────────────────────┘      │
│  [人机大战] 复选框                    │
│                                       │
│  🎮 玩家2                             │
│  ┌─────────────────────────────┐      │
│  │ 选择皮肤：                   │      │
│  │  ┌─────┐ ┌─────┐ ┌─────┐   │      │
│  │  │ 🖼️  │ │ 🖼️  │ │ 🖼️  │   │      │
│  │  │ 默认 │ │ 坦克 │ │ 飞贼 │   │      │
│  │  └─────┘ └─────┘ └─────┘   │      │
│  └─────────────────────────────┘      │
│                                       │
├───────────────────────────────────────┤
│       [开始游戏]                       │
└───────────────────────────────────────┘
```

### 6.2 皮肤卡片设计

```css
.skin-card {
    width: 60px;
    height: 70px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
}

.skin-card:hover {
    border-color: #3498db;
    transform: translateY(-2px);
}

.skin-card.selected {
    border-color: #e74c3c;
    background: #fff5f5;
}

.skin-card-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 4px;
    object-fit: contain;
}

.skin-card-name {
    font-size: 10px;
    color: #666;
    text-align: center;
}
```

### 6.3 皮肤详情提示

悬停皮肤卡片时显示详情：

```
┌─────────────────────────────────────┐
│  🖼️ 默认                            │
│  无特殊效果，以初始状态开始游戏        │
└─────────────────────────────────────┘
```

## 七、代码实现步骤

### 步骤1：创建皮肤系统类

创建 `js/skin_system.js`：

```javascript
class SkinSystem {
    constructor() {
        this.skins = this.loadSkins();
        this.iconPath = 'assets/skins/';
    }
    
    loadSkins() {
        return [
            {
                id: 'default',
                name: '默认',
                description: '无特殊效果，以初始状态开始游戏',
                icon: 'default.png',
                color: '#95a5a6',
                effects: []
            },
            {
                id: 'tank',
                name: '坦克',
                description: '每次移动后，前后2格范围内的其他玩家血量-1',
                icon: 'tank.png',
                color: '#7f8c8d',
                effects: [
                    { type: 'area_damage', params: { range: 2 } }
                ]
            },
            {
                id: 'thief',
                name: '飞贼',
                description: '前3回合移动速度翻倍，第4回合起恢复正常',
                icon: 'thief.png',
                color: '#9b59b6',
                effects: [
                    { type: 'speed_boost', params: { duration: 3 } }
                ]
            },
            {
                id: 'warrior',
                name: '勇者',
                description: '初始血量+3',
                icon: 'warrior.png',
                color: '#e74c3c',
                effects: [
                    { type: 'extra_health', params: { amount: 3 } }
                ]
            },
            {
                id: 'double_defence',
                name: '两次防',
                description: '全局可防御2次对手卡牌的负面效果（如火球术、减速等攻击型卡牌），自动抵消',
                icon: 'double_defence.png',
                color: '#2980b9',
                effects: [
                    { type: 'double_defence', params: { charges: 2 } }
                ]
            },
            {
                id: 'dragon',
                name: '龙',
                description: '全局可斜着走1次：每回合掷骰前可选择移动到对角格子，或正常掷骰。用过后只能掷骰',
                icon: 'dragon.png',
                color: '#27ae60',
                effects: [
                    { type: 'dragon_diagonal', params: { charges: 1 } }
                ]
            },
            {
                id: 'guardian',
                name: '守护者',
                description: '贴身幽灵最大持有数量+1，并且初始就拥有1个贴身幽灵',
                icon: 'guardian.png',
                color: '#16a085',
                effects: [
                    { type: 'guardian_ghost', params: { extraMax: 1, initialGhost: true } }
                ]
            },
            {
                id: 'iron_wall',
                name: '铁壁',
                description: '受到的所有伤害减少50%',
                icon: 'iron_wall.png',
                color: '#2c3e50',
                effects: [
                    { type: 'damage_reduction', params: { reduction: 0.5 } }
                ]
            },
            {
                id: 'chaos',
                name: '颠倒师',
                description: '从第2回合开始，走子后随机打乱周围8格属性（2回合冷却），每局最多3次。皮肤神殿可重置次数',
                icon: 'chaos.png',
                color: '#e91e63',
                effects: [
                    { type: 'chaos_shuffle', params: { maxShuffles: 3, cooldown: 2, startTurn: 2 } }
                ]
            },
            {
                id: 'super_warrior',
                name: '超级勇者',
                description: '走到加血格子时，加血量乘2倍；走到减血格子时，减血量也乘2倍。无回合限制',
                icon: 'super_warrior.png',
                color: '#c0392b',
                effects: [
                    { type: 'blood_amplify', params: { multiplier: 2 } }
                ]
            }
        ];
    }
    
    getSkinById(id) {
        return this.skins.find(skin => skin.id === id);
    }
    
    getAllSkins() {
        return this.skins;
    }
    
    getIconPath(skinId) {
        const skin = this.getSkinById(skinId);
        if (!skin) return '';
        return this.iconPath + skin.icon;
    }
}

const skinSystem = new SkinSystem();
```

### 步骤2：创建图片资源目录

创建 `assets/skins/` 目录，并将以下图片文件放入：

| 文件名 | 说明 |
|--------|------|
| `default.png` | 默认皮肤图标 |
| `tank.png` | 坦克皮肤图标 |
| `thief.png` | 飞贼皮肤图标 |
| `warrior.png` | 勇者皮肤图标 |
| `double_defence.png` | 两次防皮肤图标 |
| `dragon.png` | 龙皮肤图标 |
| `guardian.png` | 守护者皮肤图标 |
| `iron_wall.png` | 铁壁皮肤图标 |
| `chaos.png` | 颠倒师皮肤图标 |

### 步骤3：扩展 Player 类

在 `js/player.js` 中添加皮肤相关字段：

```javascript
class Player {
    constructor(id, name, color) {
        // ... 原有字段 ...
        
        this.skin = null;
        this.speedBoostRemainingTurns = 0;
    }
    
    reset() {
        // ... 原有重置逻辑 ...
        
        this.skin = null;
        this.speedBoostRemainingTurns = 0;
        this.chaosTurnCount = 0;
        this.chaosShuffleCount = 0;
    }
    
    setSkin(skin) {
        // 跳过默认皮肤
        if (skin && skin.id === 'default') {
            this.skin = null;
            return;
        }

        this.skin = skin;

        // 应用初始效果
        if (skin) {
            skin.effects.forEach(effect => {
                switch (effect.type) {
                    case 'extra_health':
                        this.health += effect.params.amount;
                        break;
                    case 'speed_boost':
                        this.speedBoostRemainingTurns = effect.params.duration;
                        break;
                    case 'double_defence':
                        this.doubleDefenceCharges = effect.params.charges;
                        break;
                    case 'dragon_diagonal':
                        this.dragonDiagonalCharges = effect.params.charges;
                        break;
                    case 'guardian_ghost':
                        // 守护者：贴身幽灵最大持有数量+1
                        this.maxGhostCount += effect.params.extraMax;
                        // 守护者：初始就拥有1个贴身幽灵（仅当当前没有幽灵时）
                        if (effect.params.initialGhost && !this.hasGhost) {
                            this.hasGhost = true;
                            this.ghostType = 2;            // 2 = 贴身幽灵
                            this.ghostHealth = 1;
                            this.ghostCount = 1;
                            this.ghostPosition = this.position;
                        }
                        break;
                }
            });
        }
    }

    // 两次防皮肤：尝试抵消一次对手卡牌的负面效果，返回 true 表示抵消成功
    tryDoubleDefence() {
        if (this.doubleDefenceCharges > 0) {
            this.doubleDefenceCharges--;
            return true;
        }
        return false;
    }

    // 龙皮肤：是否还有斜行次数
    hasDragonDiagonal() { return this.dragonDiagonalCharges > 0; }
    // 龙皮肤：消耗一次斜行次数
    useDragonDiagonal() {
        if (this.dragonDiagonalCharges > 0) { this.dragonDiagonalCharges--; return true; }
        return false;
    }
}
```

### 步骤4：修改游戏逻辑

在 `js/game.js` 中：

1. **修改 rollDice() 方法，应用速度加成**：
   ```javascript
   rollDice() {
       // ... 原有逻辑 ...
       
       this.dice.roll((value) => {
           let finalValue = value;
           
           // 应用速度加成效果
           if (rollingPlayer.speedBoostRemainingTurns > 0) {
               finalValue = value * 2;
               this.log(`${rollingPlayer.name} 速度翻倍！${value}×2=${finalValue}`, true);
           }
           
           this.lastRollValue = finalValue;
           this.pendingRollValue = finalValue;
           // ... 后续逻辑 ...
       });
   }
   ```

2. **修改 nextTurn() 方法，减少加速回合数**：
   ```javascript
   nextTurn() {
       // ... 原有逻辑 ...
       
       const previousPlayer = this.players[this.currentPlayerIndex];
       if (previousPlayer && previousPlayer.speedBoostRemainingTurns > 0) {
           previousPlayer.speedBoostRemainingTurns--;
           if (previousPlayer.speedBoostRemainingTurns === 0) {
               this.notify(`${previousPlayer.name} 的加速效果已结束！`, 'info');
           }
       }
       
       // ... 后续逻辑 ...
   }
   ```

3. **添加 applyMoveEffects() 和 handleAreaDamage() 方法**：
   ```javascript
   applyMoveEffects(player, newPosition) {
       if (!player.skin) return;
       
       player.skin.effects.forEach(effect => {
           switch (effect.type) {
               case 'area_damage':
                   this.handleAreaDamage(player, newPosition, effect.params.range);
                   break;
           }
       });
   }
   
   handleAreaDamage(sourcePlayer, centerPos, range) {
       const affectedPlayers = this.players.filter(p => 
           !p.isDead && 
           !p.isWinner && 
           p.id !== sourcePlayer.id &&
           p.position >= centerPos - range &&
           p.position <= centerPos + range
       );
       
       if (affectedPlayers.length > 0) {
           this.notify(`${sourcePlayer.name} 的坦克光环生效！`, 'warning');
           
           affectedPlayers.forEach(target => {
               target.changeHealth(-1);
               this.notify(`${target.name} 被坦克光环伤害！血量-1`, 'danger');
           });
           
           const alivePlayers = this.players.filter(p => !p.isDead);
           if (alivePlayers.length <= 1) {
               this.checkGameEnd();
           }
       }
   }
   ```

4. **修改 movePlayerStepByStep()，调用 applyMoveEffects()**：
   ```javascript
   movePlayerStepByStep(player, startPos, endPos, currentStep) {
       // ... 原有逻辑 ...
       
       if (hasReached) {
           player.moveTo(endPos);
           this.onPlayerMove && this.onPlayerMove(player, startPos, endPos, endPos - startPos);
           
           this.applyMoveEffects(player, endPos);  // 新增

           this.checkOvertake(player, startPos, endPos);
           // ... 后续逻辑 ...
       }
   }
   ```

5. **修改 useCard() 方法，应用两次防抵消（卡牌系统）**：
   ```javascript
   useCard(player, cardInstanceId, targetPlayerId = null) {
       // ... 前置校验 ...

       // 两次防皮肤：攻击型卡牌对目标生效前，检查目标是否可抵消
       if (card.targetType === 'enemy' && target && target.tryDoubleDefence()) {
           this.log(`${player.name} 使用了 [${card.name}]，但 ${target.name} 的【两次防】抵消了负面效果！（剩余 ${target.doubleDefenceCharges} 次）`, true);
           this.notify(`${target.name} 的【两次防】抵消了 ${card.name}！`, 'info');
           // 卡牌仍然消耗（已使用），但不产生负面效果
           player.cards.splice(cardIndex, 1);
           player.hasUsedCardThisTurn = true;
           this.notifyStateChange();
           return;
       }

       // 执行效果 ...
   }
   ```

6. **新增龙皮肤斜行方法（getDiagonalCells / movePlayerDiagonal / dragonDecideForAI）**：
   ```javascript
   // 获取当前位置可斜行的对角格子编号列表
   getDiagonalCells(player) {
       const { row, col } = this.board.getPositionByNumber(player.position);
       const cells = [];
       const directions = [[-1,-1],[-1,1],[1,-1],[1,1]];
       for (const [dr, dc] of directions) {
           const nr = row + dr, nc = col + dc;
           // 边界检查：被挡住的方向（棋盘边缘）跳过
           if (nr >= 0 && nr < this.board.rows && nc >= 0 && nc < this.board.cols) {
               const cellNum = this.board.getNumberByPosition(nr, nc);
               if (cellNum !== player.position && cellNum >= 1 && cellNum <= this.board.totalCells) {
                   cells.push(cellNum);
               }
           }
       }
       return cells;
   }

   // 执行斜行到指定格子（消耗次数，触发落点效果，结束当前回合）
   movePlayerDiagonal(player, targetPos) {
       if (!player.hasDragonDiagonal()) return;
       const startPos = player.position;
       player.hasRolled = true;            // 占用本回合掷骰行动
       player.useDragonDiagonal();         // 消耗斜行次数
       if (typeof player.recordMove === 'function') player.recordMove();
       this.log(`🐉 ${player.name} 龙之斜行！${startPos}->${targetPos}`, true);

       player.moveTo(targetPos);
       this.onPlayerMove && this.onPlayerMove(player, startPos, targetPos, targetPos - startPos);
       this.applyMoveEffects(player, targetPos);
       this.checkOvertake(player, startPos, targetPos);

       if (targetPos >= this.board.totalCells) {
           player.win();
           this.checkGameEnd();
       } else {
           const propertyHandled = this.processCellProperty(player, targetPos);
           if (!player.isDead && !propertyHandled) this.nextTurn();
           else if (player.isDead) this.checkGameEnd();
       }
   }

   // AI 决策是否使用斜行，返回目标格子编号，null 表示改为掷骰
   dragonDecideForAI(player) {
       if (!player.hasDragonDiagonal()) return null;
       const cells = this.getDiagonalCells(player);
       if (cells.length === 0) return null;
       const best = cells.reduce((b, c) => c > b ? c : b, cells[0]);
       if (best > player.position && Math.random() < 0.5) return best;
       return null;
   }
   ```

7. **修改 UI 的 handleRollDice() 和 AI 回合，接入龙皮肤选择**：
   ```javascript
   handleRollDice() {
       // ... 前置校验 ...
       // 龙皮肤：人类玩家掷骰前可选择斜行或掷骰
       if (currentPlayer.hasDragonDiagonal && currentPlayer.hasDragonDiagonal()) {
           this.showDragonDiagonalDialog(currentPlayer);
           return;
       }
       this.isRollLocked = true;
       this.setRollControlsEnabled(false);
       this.game.rollDice();
   }
   // showDragonDiagonalDialog 渲染对话框：对角格子按钮 + 投掷骰子按钮
   // AI 回合：const diagTarget = this.game.dragonDecideForAI(player);
   //         if (diagTarget) this.game.movePlayerDiagonal(player, diagTarget);
   //         else this.game.rollDice();
   ```

### 步骤5：修改 Player.changeHealth()，应用伤害减免

在 `js/player.js` 中：

```javascript
changeHealth(delta) {
    if (delta < 0) {
        let actualDamage = Math.abs(delta);
        
        // 应用伤害减免效果
        if (this.skin) {
            this.skin.effects.forEach(effect => {
                if (effect.type === 'damage_reduction') {
                    actualDamage = Math.ceil(actualDamage * (1 - effect.params.reduction));
                }
            });
        }
        
        this.health -= actualDamage;
        
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
        }
    } else {
        this.health += delta;
    }
}
```

### 步骤6：更新 UI，添加皮肤选择

修改 `js/ui.js`：

1. **修改玩家选择弹窗，添加皮肤选择**：
   ```javascript
   renderPlayerSelection() {
       const container = document.querySelector('.players-list');
       container.innerHTML = '';
       
       for (let i = 0; i < this.playerCount; i++) {
           const playerName = this.playerNames[i] || `玩家${i + 1}`;
           const isHuman = this.humanPlayerIndex === i;
           
           const playerDiv = document.createElement('div');
           playerDiv.className = 'player-selection-item';
           
           // 皮肤选择区域
           const skins = skinSystem.getAllSkins();
           let skinHtml = '<div class="skin-selector">';
           skinHtml += '<div class="skin-selector-label">选择皮肤：</div>';
           skinHtml += '<div class="skin-cards">';
           
           skins.forEach(skin => {
               const isSelected = this.playerSkins[i] === skin.id;
               const iconPath = skinSystem.getIconPath(skin.id);
               skinHtml += `
                   <div class="skin-card ${isSelected ? 'selected' : ''}" 
                        data-player="${i}" 
                        data-skin="${skin.id}"
                        title="${skin.name}\n${skin.description}">
                       <img class="skin-card-icon" src="${iconPath}" alt="${skin.name}">
                       <div class="skin-card-name">${skin.name}</div>
                   </div>
               `;
           });
           
           skinHtml += '</div></div>';
           
           playerDiv.innerHTML = `
               <div class="player-name">🎮 ${playerName}</div>
               ${skinHtml}
           `;
           
           container.appendChild(playerDiv);
       }
       
       // 绑定皮肤选择事件
       document.querySelectorAll('.skin-card').forEach(card => {
           card.addEventListener('click', (e) => {
               const playerIndex = parseInt(e.currentTarget.dataset.player);
               const skinId = e.currentTarget.dataset.skin;
               
               // 更新选中状态
               document.querySelectorAll(`.skin-card[data-player="${playerIndex}"]`).forEach(c => {
                   c.classList.remove('selected');
               });
               e.currentTarget.classList.add('selected');
               
               this.playerSkins[playerIndex] = skinId;
           });
       });
   }
   ```

2. **修改 startGame() 方法，传递皮肤信息**：
   ```javascript
   startGame() {
       // ... 原有逻辑 ...
       
       for (let i = 0; i < this.playerCount; i++) {
           const player = this.game.addPlayer(i, this.playerNames[i], CONFIG.PLAYER_COLORS[i]);
           const skinId = this.playerSkins[i] || 'default';
           player.setSkin(skinSystem.getSkinById(skinId));
       }
       
       // ... 后续逻辑 ...
   }
   ```

3. **在 UI 类构造函数中初始化 playerSkins**：
   ```javascript
   constructor() {
       // ... 原有初始化 ...
       
       this.playerSkins = {};
   }
   ```

4. **注册 `onChaosShuffle` 回调并实现 `handleChaosShuffleRender` 方法**：
   ```javascript
   // 在 setupEventListeners() 中的 setCallbacks 里注册
   this.game.setCallbacks({
       // ... 其他回调 ...
       onChaosShuffle: (affectedCells) => this.handleChaosShuffleRender(affectedCells)
   });

   // 实现棋盘重新渲染方法
   handleChaosShuffleRender(affectedCells) {
       // 重新渲染棋盘（展示打乱后的格子属性）
       this.renderBoard();
       // 棋盘 innerHTML 已清空，需重新放置玩家与幽灵标记
       this.playerTokens = {};
       this.ghostTokens = {};
       this.renderPlayerTokens();
       this.renderGhostTokens();
   }
   ```

### 步骤7：添加皮肤相关 CSS

在 `css/style.css` 中添加：

```css
.skin-selector {
    margin-top: 10px;
}

.skin-selector-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
}

.skin-cards {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.skin-card {
    width: 60px;
    height: 70px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
}

.skin-card:hover {
    border-color: #3498db;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.skin-card.selected {
    border-color: #e74c3c;
    background: #fff5f5;
}

.skin-card-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 4px;
    object-fit: contain;
}

.skin-card-name {
    font-size: 10px;
    color: #666;
    text-align: center;
}

.player-selection-item {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 10px;
}

.player-name {
    font-size: 16px;
    font-weight: bold;
    color: #2c3e50;
}
```

## 八、扩展皮肤规则的方法

### 8.1 添加新皮肤

只需在 `js/skin_system.js` 的 `loadSkins()` 方法中添加新皮肤对象：

```javascript
{
    id: 'new_skin_id',
    name: '皮肤名称',
    description: '皮肤描述',
    icon: 'new_skin.png',  // 对应 assets/skins/new_skin.png
    color: '#3498db',
    effects: [
        { 
            type: 'effect_type', 
            params: { key: value } 
        }
    ]
}
```

同时在 `assets/skins/` 目录下添加对应的图片文件。

### 8.2 添加新效果类型

1. 在 `EffectHandlers` 中添加处理函数
2. 在对应的触发时机调用处理函数
3. 在 Player 类中添加必要的状态字段

### 8.3 示例：添加"幸运星"皮肤

```javascript
{
    id: 'lucky_star',
    name: '幸运星',
    description: '每回合额外掷骰子1次',
    icon: 'lucky_star.png',
    color: '#f1c40f',
    effects: [
        { type: 'extra_roll', params: { amount: 1 } }
    ]
}
```

## 九、注意事项

1. **效果叠加**：同一类型效果可以叠加（如多个 `extra_health`）
2. **效果优先级**：按定义顺序执行，后续效果可以覆盖前序效果
3. **性能考虑**：皮肤效果在关键路径上执行，应保持逻辑简单
4. **数据准确性**：确保效果状态在 `reset()` 中正确重置
5. **扩展性**：皮肤系统与游戏逻辑解耦，添加新皮肤无需修改核心逻辑
6. **UI一致性**：皮肤选择界面应与现有UI风格保持一致
7. **皮肤冲突**：避免设计相互冲突的皮肤效果（如同时有 `speed_boost` 和减速效果）
8. **图片加载**：确保图片文件存在于 `assets/skins/` 目录下，建议使用PNG格式，尺寸建议为 64x64 或 128x128
9. **默认皮肤**：默认皮肤（`default`）不应用任何效果，仅作为无皮肤选项

## 十、皮肤神殿格子（SKIN）

### 10.1 需求概述

在棋盘上新增「皮肤神殿」功能格子（类型代码 `SKIN`，无变量）。玩家踩中后可更换皮肤1次，更换后重置皮肤属性。该机制为皮肤系统在游戏过程中的动态入口，使玩家不再局限于开局时的皮肤选择。

### 10.2 触发流程

```
玩家移动到 SKIN 格子
    ↓
processSingleProperty → case 'skintemple'
    ↓
├── AI 玩家：自动决策（50%换不同皮肤，50%重置当前皮肤）
└── 人类玩家：弹出皮肤选择弹窗（showSkinTempleSelection）
    ↓
selectSkinTempleChange(player, newSkin)
    ↓
player.changeSkin(newSkin)  ← 移除旧皮肤被动效果 → 重置属性 → 应用新皮肤
    ↓
nextTurn()  ← 回合结束
```

### 10.3 Player.changeSkin() 方法

```javascript
changeSkin(newSkin) {
    // 1. 移除旧皮肤的被动效果（如勇者的额外血量、守护者的额外幽灵容量）
    if (this.skin) {
        this.skin.effects.forEach(effect => {
            if (effect.type === 'extra_health') {
                this.changeHealth(-effect.params.amount);
            } else if (effect.type === 'guardian_ghost') {
                // 守护者：恢复贴身幽灵最大持有数量
                this.maxGhostCount -= effect.params.extraMax;
                // 若当前幽灵血量超过新上限，截断之
                if (this.ghostHealth > this.maxGhostCount) {
                    this.ghostHealth = this.maxGhostCount;
                    this.ghostCount = this.ghostHealth;
                    if (this.ghostHealth <= 0) {
                        this.hasGhost = false;
                        this.ghostType = 0;
                        this.ghostPosition = 1;
                    }
                }
            }
        });
    }

    // 2. 重置所有皮肤相关属性
    this.speedBoostRemainingTurns = 0;
    this.doubleDefenceCharges = 0;
    this.dragonDiagonalCharges = 0;
    this.chaosTurnCount = 0;
    this.chaosShuffleCount = 0;

    // 3. 应用新皮肤（setSkin 内部会重新设置上述属性）
    this.setSkin(newSkin);
}
```

### 10.4 重置效果说明

| 皮肤 | 更换后效果 |
|------|-----------|
| 坦克 (tank) | 立即获得坦克光环（每回合移动后触发范围伤害） |
| 飞贼 (thief) | 速度翻倍回合重置为3（即使之前已用完） |
| 勇者 (warrior) | 移除旧勇者的额外血量，添加新皮肤的额外血量 |
| 两次防 (double_defence) | 防御次数重置为2（即使之前已用完） |
| 龙 (dragon) | 斜行次数重置为1（即使之前已用完） |
| 守护者 (guardian) | 贴身幽灵上限+1（变回4），若当前无幽灵则获得1个贴身幽灵；离开守护者时上限恢复为3，超出部分截断 |
| 颠倒师 (chaos) | 打乱次数重置为3次（即使之前已用完），回合计数重置为0 |
| 超级勇者 (super_warrior) | 被动效果，无状态需重置；切换后立即生效/失效 |
| 默认 (default) | 移除所有皮肤属性，变为无皮肤状态 |

### 10.5 特殊场景：龙皮肤技能恢复

> 如果玩家本身是龙，并已使用了龙的技能，可再次选择龙，并恢复龙的技能。

- 玩家选择龙皮肤 → `dragonDiagonalCharges` 已为 0（已用完）
- 踩到皮肤神殿 → 再次选择龙 → `changeSkin(dragon)` 被调用
- `changeSkin` 先重置 `dragonDiagonalCharges = 0`，再由 `setSkin` 设为 1
- 龙的斜行技能恢复，下回合可再次使用

### 10.6 CSV 地图配置

在 CSV 文件中添加皮肤神殿格子：

```csv
格子,功能,变量
15,SKIN,X
```

- `功能`：`SKIN`
- `变量`：`X`（无变量，固定填 X）

### 10.7 UI 设计

皮肤神殿弹窗（`showSkinTempleSelection`）：

```
┌───────────────────────────────────────┐
│  ×                              🏛️    │
│       玩家名 皮肤神殿 — 更换皮肤       │
│  选择新皮肤（属性将重置）。当前：坦克   │
├───────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│  │ 🖼️  │ │ 🖼️  │ │ 🖼️  │ │ 🖼️  │    │
│  │ 默认 │ │ 坦克 │ │ 飞贼 │ │ 勇者 │    │
│  │     │ │当前  │ │     │ │     │    │
│  └─────┘ └─────┘ └─────┘ └─────┘    │
│  ┌─────┐ ┌─────┐                     │
│  │ 🖼️  │ │ 🖼️  │                     │
│  │两次防│ │ 龙  │                     │
│  └─────┘ └─────┘                     │
└───────────────────────────────────────┘
```

- 当前皮肤标记红色边框 + 「当前」角标
- 点击任意皮肤卡片即确认更换
- 点击 × 可取消（跳过更换，直接进入下一回合）

## 十一、关联格子类型：幸运星 (LCK) 与掠夺点 (ROB)

### 11.1 幸运星 (LCK X)

- **类型代码**：`LCK`
- **变量**：X = 持续回合数
- **效果**：踩到后下回合开始，X 回合内掷骰子点数最低+2（即最低为3）
- **实现**：
  - `Player.luckyTurns` 记录剩余回合数
  - `Player.justGotLucky` 防止当回合被递减（与 `justGotUndie` 同模式）
  - `Game.rollDice()` 中：`if (luckyTurns > 0 && finalValue < 3) finalValue = 3`
  - `Game.nextTurn()` 中递减 `luckyTurns`，归零时通知

### 11.2 掠夺点 (ROB)

- **类型代码**：`ROB`
- **变量**：无
- **效果**：踩中后选择一名其他玩家，随机偷取对方1张手牌
- **实现**：
  - `Game.selectPlunderTarget(player, targetId)` 从目标随机抽1张牌
  - 人类玩家通过 `showPlunderSelection` 弹窗选择目标
  - AI 自动随机选择有手牌的目标
  - 无可掠夺目标时跳过
