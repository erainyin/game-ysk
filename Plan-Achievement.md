# 成就系统设计文档

## 一、需求概述

为 YSK 大作战游戏添加成就系统，在玩家获胜时根据游戏数据进行统计，判断是否达成特定成就。成就系统采用可扩展的规则列表方式维护，便于后续添加新成就。

## 二、成就规则设计

### 2.1 成就数据结构

每个成就包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 成就唯一标识符 |
| `name` | string | 成就名称（中文） |
| `description` | string | 成就描述 |
| `icon` | string | 成就图标（emoji） |
| `condition` | function | 判断条件函数，返回 boolean |
| `type` | string | 成就类型：`win`（胜利相关）、`action`（行为相关）、`milestone`（里程碑） |

### 2.2 初始成就列表

#### 成就1：天胡 (win_with_no_move)

- **名称**：天胡
- **描述**：还未掷骰子就赢得比赛
- **图标**：🀄
- **类型**：`win`
- **条件**：
  - 玩家获胜时，位置仍为初始位置（1）
  - 玩家从未掷过骰子（`totalRolls === 0`）
  - 玩家未移动过（`totalMoves === 0`）

#### 成就2：极速通关 (speed_run)

- **名称**：极速通关
- **描述**：在3回合内到达终点获胜
- **图标**：⚡
- **类型**：`win`
- **条件**：
  - 玩家通过到达终点获胜
  - 获胜时回合数 ≤ 3

#### 成就3：九死一生 (narrow_escape)

- **名称**：九死一生
- **描述**：血量曾降至1，最终获胜
- **图标**：💀
- **类型**：`win`
- **条件**：
  - 玩家获胜
  - 游戏过程中血量最低曾达到1

#### 成就4：不死传说 (undie_legend)

- **名称**：不死传说
- **描述**：全程未受到任何伤害获胜
- **图标**：🛡️
- **类型**：`win`
- **条件**：
  - 玩家获胜
  - 游戏过程中血量从未减少（`damageTaken === 0`）

#### 成就5：幽灵杀手 (ghost_killer)

- **名称**：幽灵杀手
- **描述**：消灭3个敌方幽灵
- **图标**：👻
- **类型**：`action`
- **条件**：
  - 玩家获胜
  - 游戏过程中消灭的敌方幽灵数量 ≥ 3

#### 成就6：炸弹专家 (bomb_expert)

- **名称**：炸弹专家
- **描述**：使用炸弹炸死至少2名玩家
- **图标**：💣
- **类型**：`action`
- **条件**：
  - 玩家获胜
  - 通过炸弹爆炸导致至少2名其他玩家死亡

#### 成就7：黑洞行者 (blackhole_walker)

- **名称**：黑洞行者
- **描述**：经历至少3次黑洞传送后获胜
- **图标**：🕳️
- **类型**：`action`
- **条件**：
  - 玩家获胜
  - 游戏过程中经历黑洞传送次数 ≥ 3

#### 成就8：血量之王 (health_king)

- **名称**：血量之王
- **描述**：最终血量达到200以上
- **图标**：❤️
- **类型**：`milestone`
- **条件**：
  - 玩家获胜
  - 获胜时血量 ≥ 200

## 三、数据采集设计

### 3.1 玩家统计数据

在 Player 类中添加统计字段：

```javascript
class Player {
    constructor(id, name, color) {
        // ... 原有字段 ...
        
        // 统计数据
        this.stats = {
            totalRolls: 0,           // 掷骰子次数
            totalMoves: 0,           // 移动次数
            damageTaken: 0,          // 受到的伤害总量
            minimumHealth: 3,        // 最低血量记录
            blackholeCount: 0,       // 经历黑洞次数
            ghostKills: 0,           // 消灭幽灵数量
            bombKills: 0,            // 炸弹击杀数量
            maxHealth: 3,            // 最高血量记录
            ghostSummons: 0,         // 召唤幽灵次数
            undieUses: 0,            // 使用不死守护次数
            overtakeCount: 0,        // 超车次数
        };
    }
}
```

### 3.2 数据更新时机

| 事件 | 更新字段 | 代码位置 |
|------|----------|----------|
| 掷骰子 | `totalRolls++` | `Game.rollDice()` |
| 移动玩家 | `totalMoves++` | `Game.movePlayer()` |
| 受到伤害 | `damageTaken += delta`, 更新 `minimumHealth` | `Player.changeHealth()` |
| 经历黑洞 | `blackholeCount++` | `Game.triggerCellProperty()` - blackhole 处理 |
| 消灭幽灵 | `ghostKills++` | `Game.triggerCellProperty()` - DDD 处理（贴身幽灵死亡） |
| 炸弹击杀 | `bombKills++` | `Game.triggerBomb()` |
| 血量增加 | 更新 `maxHealth` | `Player.changeHealth()` |
| 召唤幽灵 | `ghostSummons++` | `Game.triggerCellProperty()` - ghost 处理 |
| 使用不死守护 | `undieUses++` | `Game.triggerCellProperty()` - undie 处理 |
| 超车成功 | `overtakeCount++` | `Game.handleOvertake()` |

## 四、成就判定流程

### 4.1 判定时机

在 `Game.checkGameEnd()` 方法中，当玩家获胜时触发成就判定。

### 4.2 判定流程

```
游戏结束 → 检测到获胜玩家 → 遍历所有成就规则 → 
对每个成就调用 condition(winner, game) → 
收集所有满足条件的成就 → 显示成就结果
```

### 4.3 伪代码实现

```javascript
class AchievementSystem {
    constructor() {
        this.achievements = [];
        this.loadAchievements();
    }
    
    loadAchievements() {
        this.achievements = [
            {
                id: 'win_with_no_move',
                name: '天胡',
                description: '还未掷骰子就赢得比赛',
                icon: '🀄',
                type: 'win',
                condition: (winner, game) => {
                    return winner.position === 1 && 
                           winner.stats.totalRolls === 0 &&
                           winner.stats.totalMoves === 0;
                }
            },
            // ... 其他成就
        ];
    }
    
    checkAchievements(winner, game) {
        const unlocked = [];
        for (const achievement of this.achievements) {
            if (achievement.condition(winner, game)) {
                unlocked.push(achievement);
            }
        }
        return unlocked;
    }
}
```

## 五、UI 展示设计

### 5.1 游戏结束弹窗增强

在现有的游戏结束弹窗中添加成就展示区域：

```
┌─────────────────────────────┐
│         游戏结束            │
├─────────────────────────────┤
│  🏆 玩家1 获得胜利！        │
├─────────────────────────────┤
│                             │
│  🎖️ 获得成就：              │
│  ┌─────────────────────┐    │
│  │ 🀄 天胡             │    │
│  │   还未掷骰子就赢了   │    │
│  └─────────────────────┘    │
│  ┌─────────────────────┐    │
│  │ ⚡ 极速通关         │    │
│  │   3回合内到达终点    │    │
│  └─────────────────────┘    │
│                             │
├─────────────────────────────┤
│  [再来一局]  [返回首页]     │
└─────────────────────────────┘
```

### 5.2 成就动画效果

- 成就图标依次弹出，带有缩放动画
- 成就名称和描述淡入显示
- 背景添加庆祝粒子效果

## 六、代码实现步骤

### 步骤1：扩展 Player 类

在 `js/player.js` 中添加统计字段和方法：

```javascript
class Player {
    constructor(id, name, color) {
        // ... 原有字段 ...
        
        this.stats = {
            totalRolls: 0,
            totalMoves: 0,
            damageTaken: 0,
            minimumHealth: 3,
            blackholeCount: 0,
            ghostKills: 0,
            bombKills: 0,
            maxHealth: 3,
            ghostSummons: 0,
            undieUses: 0,
            overtakeCount: 0,
        };
    }
    
    reset() {
        // ... 原有重置逻辑 ...
        
        // 重置统计数据
        this.stats = {
            totalRolls: 0,
            totalMoves: 0,
            damageTaken: 0,
            minimumHealth: 3,
            blackholeCount: 0,
            ghostKills: 0,
            bombKills: 0,
            maxHealth: 3,
            ghostSummons: 0,
            undieUses: 0,
            overtakeCount: 0,
        };
    }
    
    // 更新统计数据的辅助方法
    recordRoll() { this.stats.totalRolls++; }
    recordMove() { this.stats.totalMoves++; }
    recordDamage(amount) {
        this.stats.damageTaken += amount;
        if (this.health < this.stats.minimumHealth) {
            this.stats.minimumHealth = this.health;
        }
    }
    recordBlackhole() { this.stats.blackholeCount++; }
    recordGhostKill() { this.stats.ghostKills++; }
    recordBombKill() { this.stats.bombKills++; }
    updateMaxHealth() {
        if (this.health > this.stats.maxHealth) {
            this.stats.maxHealth = this.health;
        }
    }
    recordGhostSummon() { this.stats.ghostSummons++; }
    recordUndieUse() { this.stats.undieUses++; }
    recordOvertake() { this.stats.overtakeCount++; }
}
```

### 步骤2：创建成就系统类

创建 `js/achievements.js`：

```javascript
class AchievementSystem {
    constructor() {
        this.achievements = this.loadAchievements();
    }
    
    loadAchievements() {
        return [
            {
                id: 'win_with_no_move',
                name: '天胡',
                description: '还未掷骰子就赢得比赛',
                icon: '🀄',
                type: 'win',
                condition: (winner, game) => {
                    return winner.position === 1 && 
                           winner.stats.totalRolls === 0;
                }
            },
            {
                id: 'speed_run',
                name: '极速通关',
                description: '在3回合内到达终点获胜',
                icon: '⚡',
                type: 'win',
                condition: (winner, game) => {
                    return game.roundCount <= 3 && winner.position === game.board.totalCells;
                }
            },
            {
                id: 'narrow_escape',
                name: '九死一生',
                description: '血量曾降至1，最终获胜',
                icon: '💀',
                type: 'win',
                condition: (winner, game) => {
                    return winner.stats.minimumHealth === 1;
                }
            },
            {
                id: 'undie_legend',
                name: '不死传说',
                description: '全程未受到任何伤害获胜',
                icon: '🛡️',
                type: 'win',
                condition: (winner, game) => {
                    return winner.stats.damageTaken === 0;
                }
            },
            {
                id: 'ghost_killer',
                name: '幽灵杀手',
                description: '消灭3个敌方幽灵',
                icon: '👻',
                type: 'action',
                condition: (winner, game) => {
                    return winner.stats.ghostKills >= 3;
                }
            },
            {
                id: 'bomb_expert',
                name: '炸弹专家',
                description: '使用炸弹炸死至少2名玩家',
                icon: '💣',
                type: 'action',
                condition: (winner, game) => {
                    return winner.stats.bombKills >= 2;
                }
            },
            {
                id: 'blackhole_walker',
                name: '黑洞行者',
                description: '经历至少3次黑洞传送后获胜',
                icon: '🕳️',
                type: 'action',
                condition: (winner, game) => {
                    return winner.stats.blackholeCount >= 3;
                }
            },
            {
                id: 'health_king',
                name: '血量之王',
                description: '最终血量达到200以上',
                icon: '❤️',
                type: 'milestone',
                condition: (winner, game) => {
                    return winner.health >= 200;
                }
            }
        ];
    }
    
    checkAchievements(winner, game) {
        if (!winner) return [];
        
        const unlocked = [];
        for (const achievement of this.achievements) {
            try {
                if (achievement.condition(winner, game)) {
                    unlocked.push(achievement);
                }
            } catch (error) {
                console.error(`Error checking achievement ${achievement.id}:`, error);
            }
        }
        return unlocked;
    }
    
    getAchievementById(id) {
        return this.achievements.find(a => a.id === id);
    }
}

const achievementSystem = new AchievementSystem();
```

### 步骤3：更新游戏逻辑，采集统计数据

在 `js/game.js` 中：

1. **掷骰子时**：
   ```javascript
   rollDice(player) {
       // ... 原有逻辑 ...
       player.recordRoll();
       // ... 后续逻辑 ...
   }
   ```

2. **移动玩家时**：
   ```javascript
   movePlayer(player, steps, isFromProperty = false) {
       // ... 原有逻辑 ...
       player.recordMove();
       // ... 后续逻辑 ...
   }
   ```

3. **受到伤害时**（修改 Player.changeHealth）：
   ```javascript
   changeHealth(delta) {
       if (delta < 0) {
           this.recordDamage(Math.abs(delta));
       }
       this.health += delta;
       if (delta > 0) {
           this.updateMaxHealth();
       }
       if (this.health <= 0) {
           this.health = 0;
           this.isDead = true;
       }
   }
   ```

4. **黑洞传送时**：
   ```javascript
   case 'blackhole':
       player.recordBlackhole();
       // ... 原有逻辑 ...
   ```

5. **召唤幽灵时**：
   ```javascript
   case 'ghost':
       player.recordGhostSummon();
       // ... 原有逻辑 ...
   ```

6. **使用不死守护时**：
   ```javascript
   case 'undie':
       player.recordUndieUse();
       // ... 原有逻辑 ...
   ```

7. **超车时**：
   ```javascript
   handleOvertake(player) {
       // ... 原有逻辑 ...
       player.recordOvertake();
       // ... 后续逻辑 ...
   }
   ```

8. **炸弹击杀时**（在 triggerBomb 中）：
   ```javascript
   triggerBomb(player, range) {
       // ... 原有逻辑 ...
       const killedPlayers = affectedPlayers.filter(p => p.health <= 0);
       killedPlayers.forEach(() => {
           player.recordBombKill();
       });
       // ... 后续逻辑 ...
   }
   ```

9. **幽灵死亡时**（在处理 DDD 时）：
   ```javascript
   case 'diediedie':
       if (player.hasGhost && player.ghostType === 2) {
           // 贴身幽灵代替死亡
           player.changeGhostHealth(-1);
           // 记录消灭敌方幽灵（如果是其他玩家的幽灵被消灭）
           // 需要在游戏层面处理
       }
       // ... 原有逻辑 ...
   ```

### 步骤4：在游戏结束时调用成就系统

修改 `js/game.js` 的 `checkGameEnd()` 方法：

```javascript
checkGameEnd() {
    const winners = this.players.filter(p => p.isWinner);
    
    if (winners.length > 0) {
        this.gameState = 'ended';
        const winner = winners[0];
        const achievements = achievementSystem.checkAchievements(winner, this);
        this.onGameEnd && this.onGameEnd(winner, achievements);
        this.notifyStateChange();
        return;
    }
    
    // ... 后续逻辑 ...
}
```

### 步骤5：更新 UI，展示成就

修改 `js/ui.js` 中的游戏结束处理：

```javascript
// 在 setCallbacks 中
this.game.setCallbacks({
    // ... 其他回调 ...
    onGameEnd: (winner, achievements) => this.onGameEnd(winner, achievements),
});

// 修改 onGameEnd 方法
onGameEnd(winner, achievements = []) {
    // ... 原有逻辑 ...
    
    if (winner) {
        let content = `<div class="game-end-winner">🏆 ${winner.name} 获得胜利！</div>`;
        
        if (achievements.length > 0) {
            content += `<div class="achievements-section">`;
            content += `<div class="achievements-title">🎖️ 获得成就：</div>`;
            content += `<div class="achievements-list">`;
            
            achievements.forEach(achievement => {
                content += `
                    <div class="achievement-item">
                        <div class="achievement-icon">${achievement.icon}</div>
                        <div class="achievement-info">
                            <div class="achievement-name">${achievement.name}</div>
                            <div class="achievement-desc">${achievement.description}</div>
                        </div>
                    </div>
                `;
            });
            
            content += `</div></div>`;
        }
        
        content += `
            <div class="game-end-buttons">
                <button class="btn btn-primary" onclick="ui.showStartModal()">再来一局</button>
                <button class="btn btn-secondary" onclick="ui.closeGameEndModal()">返回首页</button>
            </div>
        `;
        
        // 显示弹窗
        this.showModal(content);
    }
}
```

### 步骤6：添加成就相关 CSS

在 `css/style.css` 中添加：

```css
.achievements-section {
    margin-top: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
}

.achievements-title {
    font-size: 16px;
    font-weight: bold;
    color: #495057;
    margin-bottom: 10px;
}

.achievements-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.achievement-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 15px;
    background: white;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    animation: achievementPop 0.3s ease-out;
}

@keyframes achievementPop {
    0% {
        transform: scale(0.8);
        opacity: 0;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

.achievement-icon {
    font-size: 32px;
}

.achievement-info {
    flex: 1;
}

.achievement-name {
    font-size: 14px;
    font-weight: bold;
    color: #2c3e50;
}

.achievement-desc {
    font-size: 12px;
    color: #6c757d;
    margin-top: 2px;
}

.game-end-winner {
    font-size: 24px;
    font-weight: bold;
    color: #d35400;
    text-align: center;
    margin-bottom: 15px;
}

.game-end-buttons {
    display: flex;
    gap: 15px;
    justify-content: center;
    margin-top: 20px;
}
```

## 七、扩展成就规则的方法

### 7.1 添加新成就

只需在 `js/achievements.js` 的 `loadAchievements()` 方法中添加新成就对象：

```javascript
{
    id: 'new_achievement_id',
    name: '成就名称',
    description: '成就描述',
    icon: '🏆',
    type: 'win', // win | action | milestone
    condition: (winner, game) => {
        // 返回 true 表示达成成就
        // 可以使用 winner.stats 中的统计数据
        // 可以使用 game 中的游戏状态
        return winner.stats.someStat >= 10;
    }
}
```

### 7.2 需要新增统计数据时

1. 在 `Player.stats` 中添加新字段
2. 在 `Player` 类中添加记录方法
3. 在 `Game` 类的对应逻辑中调用记录方法
4. 在成就规则中使用新字段

## 八、注意事项

1. **性能考虑**：成就判定只在游戏结束时执行一次，对性能影响极小
2. **数据准确性**：确保统计数据在正确的时机更新
3. **异常处理**：在条件函数中添加 try-catch，避免单个成就判定失败影响其他成就
4. **扩展性**：成就规则与游戏逻辑解耦，添加新成就无需修改游戏核心逻辑
5. **本地存储**：可后续扩展将获得的成就保存到 localStorage，实现跨游戏记录
