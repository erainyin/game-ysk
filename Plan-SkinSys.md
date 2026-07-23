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
| `ghost_protect` | 幽灵保护次数增加 | `amount`（额外保护次数） |
| `damage_reduction` | 受到伤害减少百分比 | `reduction`（减少百分比，0-1） |
| `extra_roll` | 每回合额外掷骰子次数 | `amount`（额外次数） |

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
│       ├── guardian.png      # 守护者皮肤图标
│       └── iron_wall.png     # 铁壁皮肤图标
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

### 皮肤4：守护者 (guardian)

- **名称**：守护者
- **描述**：贴身幽灵保护次数上限+1（最多4次）
- **图标**：`guardian.png`
- **颜色**：`#3498db`
- **效果**：
  ```javascript
  {
      type: 'ghost_protect',
      params: { amount: 1 }
  }
  ```
- **触发时机**：玩家召唤贴身幽灵时

### 皮肤5：铁壁 (iron_wall)

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
│  └── handleDamageReduction(player, damageAmount)         │
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
                id: 'guardian',
                name: '守护者',
                description: '贴身幽灵保护次数上限+1（最多4次）',
                icon: 'guardian.png',
                color: '#3498db',
                effects: [
                    { type: 'ghost_protect', params: { amount: 1 } }
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
| `guardian.png` | 守护者皮肤图标 |
| `iron_wall.png` | 铁壁皮肤图标 |

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
                    case 'ghost_protect':
                        this.maxGhostCount += effect.params.amount;
                        break;
                    case 'speed_boost':
                        this.speedBoostRemainingTurns = effect.params.duration;
                        break;
                }
            });
        }
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
