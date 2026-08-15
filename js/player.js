class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.position = 1;
        this.isWinner = false;
        this.hasRolled = false;
        this.health = 3;
        this.isDead = false;
        this.enteredOvertakeZone = false;
        this.pauseTurns = 0;
        this.undieTurns = 0;
        this.justGotUndie = false;
        this.hasGhost = false;
        this.ghostType = 0;
        this.ghostHealth = 0;
        this.ghostPosition = 1;
        this.ghostCount = 0;
        this.maxGhostCount = 3;
        this.skin = null;
        this.speedBoostRemainingTurns = 0;
        this.doubleDefenceCharges = 0;  // 两次防皮肤：剩余防御次数
        this.dragonDiagonalCharges = 0; // 龙皮肤：剩余斜行次数
        this.luckyTurns = 0;            // 幸运星：剩余幸运回合数（骰子最低+2）
        this.justGotLucky = false;      // 幸运星：当回合获得，防止立刻被递减
        this.chaosTurnCount = 0;        // 颠倒师：已走子回合数
        this.chaosShuffleCount = 0;     // 颠倒师：已使用打乱次数（每局最多3次）
        this.pendingChaosShuffleParams = null; // 颠倒师：待执行打乱参数（最终落点执行）

        // 卡牌系统相关
        this.points = 10;                 // 当前点数（用于购买卡牌）
        this.cards = [];                  // 手牌列表
        this.activeStatuses = [];         // 激活中的状态效果
        this.hasUsedCardThisTurn = false; // 本回合是否已使用过卡牌（每回合限1张）

        // 统计数据
        this.stats = {
            totalRolls: 0,
            totalMoves: 0,
            damageTaken: 0,
            minimumHealth: this.health,
            blackholeCount: 0,
            ghostKills: 0,
            bombKills: 0,
            maxHealth: this.health,
            ghostSummons: 0,
            undieUses: 0,
            overtakeCount: 0,
            dragonDiagonalUses: 0,  // 龙皮肤：已使用斜行次数
        };
    }

    reset() {
        this.position = 1;
        this.isWinner = false;
        this.hasRolled = false;
        this.health = 3;
        this.isDead = false;
        this.enteredOvertakeZone = false;
        this.pauseTurns = 0;
        this.undieTurns = 0;
        this.justGotUndie = false;
        this.hasGhost = false;
        this.ghostType = 0;
        this.ghostHealth = 0;
        this.ghostPosition = 1;
        this.ghostCount = 0;
        this.maxGhostCount = 3;  // 守护者皮肤会在此基础值上 +1
        this.skin = null;
        this.speedBoostRemainingTurns = 0;
        this.doubleDefenceCharges = 0;
        this.dragonDiagonalCharges = 0;
        this.luckyTurns = 0;
        this.justGotLucky = false;
        this.chaosTurnCount = 0;
        this.chaosShuffleCount = 0;
        this.pendingChaosShuffleParams = null;

        // 卡牌系统相关重置
        this.points = 10;
        this.cards = [];
        this.activeStatuses = [];
        this.hasUsedCardThisTurn = false;

        // 重置统计数据
        this.stats = {
            totalRolls: 0,
            totalMoves: 0,
            damageTaken: 0,
            minimumHealth: this.health,
            blackholeCount: 0,
            ghostKills: 0,
            bombKills: 0,
            maxHealth: this.health,
            ghostSummons: 0,
            undieUses: 0,
            overtakeCount: 0,
            dragonDiagonalUses: 0,
        };
    }

    setSkin(skin) {
        if (skin && skin.id === 'default') {
            this.skin = null;
            return;
        }

        this.skin = skin;

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

    // 皮肤神殿：切换皮肤，移除旧皮肤被动效果并重置所有皮肤属性后应用新皮肤
    changeSkin(newSkin) {
        // 移除旧皮肤的被动效果（如勇者的额外血量、守护者的额外幽灵容量）
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

        // 重置所有皮肤相关属性
        this.speedBoostRemainingTurns = 0;
        this.doubleDefenceCharges = 0;
        this.dragonDiagonalCharges = 0;
        this.chaosTurnCount = 0;
        this.chaosShuffleCount = 0;
        this.pendingChaosShuffleParams = null;

        // 应用新皮肤（setSkin 内部会重新设置上述属性）
        this.setSkin(newSkin);
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
    hasDragonDiagonal() {
        return this.dragonDiagonalCharges > 0;
    }

    // 龙皮肤：消耗一次斜行次数
    useDragonDiagonal() {
        if (this.dragonDiagonalCharges > 0) {
            this.dragonDiagonalCharges--;
            return true;
        }
        return false;
    }

    moveTo(position) {
        this.position = position;
        if (this.hasGhost && this.ghostType === 2) {
            this.ghostPosition = position;
        }
    }

    ghostMoveTo(position) {
        this.ghostPosition = position;
    }

    rollDice() {
        this.hasRolled = true;
        this.recordRoll();
    }

    resetRoll() {
        this.hasRolled = false;
        this.hasUsedCardThisTurn = false;  // 新回合重置卡牌使用次数
    }

    win() {
        this.isWinner = true;
    }

    changeHealth(delta) {
        if (delta < 0) {
            this.stats.damageTaken += Math.abs(delta);
        }

        this.health += delta;

        if (this.health < this.stats.minimumHealth) {
            this.stats.minimumHealth = this.health;
        }

        if (this.health > this.stats.maxHealth) {
            this.stats.maxHealth = this.health;
        }

        if (this.health <= 0) {
            if (this.tryUndyingSave()) {
                return;
            }
            this.health = 0;
            this.isDead = true;
        }
    }

    setHealth(value) {
        this.health = value;
        if (this.health < this.stats.minimumHealth) {
            this.stats.minimumHealth = this.health;
        }
        if (this.health > this.stats.maxHealth) {
            this.stats.maxHealth = this.health;
        }
        if (this.health <= 0) {
            if (this.tryUndyingSave()) {
                return;
            }
            this.health = 0;
            this.isDead = true;
        }
    }

    // 卡牌「不死之身」状态挽救死亡，返回 true 表示已挽救
    tryUndyingSave() {
        const undying = this.getStatus('undying');
        if (undying && undying.amount > 0) {
            undying.amount--;
            if (undying.amount <= 0) {
                this.removeStatusObject(undying);
            }
            this.health = 1;
            this.isDead = false;
            this._undyingTriggered = true;
            return true;
        }
        return false;
    }

    changeGhostHealth(delta) {
        this.ghostHealth += delta;
        if (this.ghostHealth > this.maxGhostCount) {
            this.ghostHealth = this.maxGhostCount;
        }
        if (this.ghostHealth <= 0) {
            this.ghostHealth = 0;
            this.hasGhost = false;
            this.ghostType = 0;
            this.ghostPosition = 1;
        }
    }

    // ===== 卡牌系统方法 =====
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

    // 购买阶段退回卡牌（返还点数）
    refundCard(instanceId) {
        const index = this.cards.findIndex(c => c.instanceId === instanceId);
        if (index !== -1) {
            const card = this.cards.splice(index, 1)[0];
            const def = cardSystem.getCardById(card.id);
            if (def) {
                this.points += def.cost;
            }
            return card;
        }
        return null;
    }

    addStatus(status) {
        this.activeStatuses.push(status);
    }

    // 自动消耗护盾卡抵挡伤害，返回 true 表示抵挡成功
    consumeShield() {
        const idx = this.cards.findIndex(c => c.id === 'shield');
        if (idx !== -1) {
            this.cards.splice(idx, 1);
            return true;
        }
        return false;
    }

    // 自动消耗净化卡清除负面状态，返回 true 表示触发
    consumePurify() {
        const idx = this.cards.findIndex(c => c.id === 'purify');
        if (idx !== -1) {
            this.cards.splice(idx, 1);
            return true;
        }
        return false;
    }

    hasStatus(type) {
        return this.activeStatuses.some(s => s.type === type);
    }

    getStatus(type) {
        return this.activeStatuses.find(s => s.type === type);
    }

    removeStatus(type) {
        this.activeStatuses = this.activeStatuses.filter(s => s.type !== type);
    }

    removeStatusObject(statusObj) {
        this.activeStatuses = this.activeStatuses.filter(s => s !== statusObj);
    }

    // 统计相关方法
    recordRoll() { this.stats.totalRolls++; }
    recordMove() { this.stats.totalMoves++; }
    recordDamage(amount) {
        this.stats.damageTaken += amount;
        if (this.health < this.stats.minimumHealth) this.stats.minimumHealth = this.health;
    }
    recordBlackhole() { this.stats.blackholeCount++; }
    recordGhostKill() { this.stats.ghostKills++; }
    recordBombKill() { this.stats.bombKills++; }
    updateMaxHealth() { if (this.health > this.stats.maxHealth) this.stats.maxHealth = this.health; }
    recordGhostSummon() { this.stats.ghostSummons++; }
    recordUndieUse() { this.stats.undieUses++; }
    recordOvertake() { this.stats.overtakeCount++; }
    recordDragonDiagonal() { this.stats.dragonDiagonalUses++; }
}