class Game {
    constructor(playerCount = 2) {
        this.board = new Board(CONFIG.ROWS, CONFIG.COLS);
        this.dice = new Dice();
        this.players = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting';
        this.playerCount = playerCount;
        this.onStateChange = null;
        this.onPlayerMove = null;
        this.onDiceRoll = null;
        this.onGameEnd = null;
        this.onNotification = null;
        this.onLog = null;
        this.onBombExplode = null;
        this.onGhostSelect = null;
        this.onMoveSelect = null;
        this.lastRollValue = 0;
        this.pendingRollValue = 0;
        this.pendingRollPlayer = null;
        this.isSelectingGhost = false;
        this.isSelectingMoveTarget = false;
        this.roundCount = 1;
        this.currentRollStartPos = 0;
        this.aiPlayerIds = new Set();
        this.pendingTimeouts = [];
        this.isAIMode = false;
        this.humanPlayerIndex = -1;
        this.purchasePhase = false;       // 卡牌购买阶段标志
        this.onCardPurchase = null;       // 卡牌购买阶段回调（UI）
    }

    setCallbacks(callbacks) {//设置回调函数
        if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
        if (callbacks.onPlayerMove) this.onPlayerMove = callbacks.onPlayerMove;
        if (callbacks.onDiceRoll) this.onDiceRoll = callbacks.onDiceRoll;
        if (callbacks.onGameEnd) this.onGameEnd = callbacks.onGameEnd;
        if (callbacks.onNotification) this.onNotification = callbacks.onNotification;
        if (callbacks.onLog) this.onLog = callbacks.onLog;
        if (callbacks.onBombExplode) this.onBombExplode = callbacks.onBombExplode;
        if (callbacks.onGhostSelect) this.onGhostSelect = callbacks.onGhostSelect;
        if (callbacks.onMoveSelect) this.onMoveSelect = callbacks.onMoveSelect;
        if (callbacks.onCardPurchase) this.onCardPurchase = callbacks.onCardPurchase;
    }

    setAIPlayers(playerIds = []) {//设置AI玩家
        this.aiPlayerIds = new Set(playerIds);
    }

    isAIPlayer(player) {//判断是否为AI玩家
        return !!player && this.aiPlayerIds.has(player.id);
    }

    setAIMode(isAIMode, humanPlayerIndex) {//设置AI模式
        this.isAIMode = isAIMode;
        this.humanPlayerIndex = humanPlayerIndex;
    }

    notify(message, type = 'info') {//通知玩家
        if (this.onNotification) {
            this.onNotification(message, type);
        }
    }

    log(message, isMainRoll = false) {//记录日志
        if (this.onLog) {
            const player = this.getCurrentPlayer();
            const playerName = player ? player.name : '未知';
            const logInfo = {
                round: this.roundCount,
                player: playerName,
                message: message,
                isMainRoll: isMainRoll,
                startPos: this.currentRollStartPos,
                rollValue: this.lastRollValue
            };
            this.onLog(logInfo);
        }
    }

    initPlayers(count) {//初始化玩家
        this.playerCount = Math.max(CONFIG.MIN_PLAYERS, Math.min(CONFIG.MAX_PLAYERS, count));
        this.players = [];
        
        for (let i = 0; i < this.playerCount; i++) {
            this.players.push(new Player(
                i,
                CONFIG.PLAYER_NAMES[i],
                CONFIG.PLAYER_COLORS[i]
            ));
        }
    }

    start() {//开始游戏
        this.initPlayers(this.playerCount);
        this.currentPlayerIndex = 0;
        this.gameState = 'playing';
        this.notifyStateChange();
    }

    restart() {//重新开始游戏
        this.pendingTimeouts.forEach(id => clearTimeout(id));
        this.pendingTimeouts = [];
        this.gameState = 'waiting';
        this.currentPlayerIndex = 0;
        this.players = [];
        this.roundCount = 1;
        this.currentRollStartPos = 0;
        this.lastRollValue = 0;
        this.pendingRollValue = 0;
        this.pendingRollPlayer = null;
        this.isSelectingGhost = false;
        this.isSelectingMoveTarget = false;
        this.purchasePhase = false;
        this.notifyStateChange();
    }

    setTimeout(fn, delay) {
        const id = window.setTimeout(fn, delay);
        this.pendingTimeouts.push(id);
        return id;
    }

    getCurrentPlayer() {//获取当前玩家
        return this.players[this.currentPlayerIndex];
    }

    getPlayerCount() {//获取玩家数量
        return this.playerCount;
    }

    rollDice() {//掷骰子
        if (this.gameState !== 'playing' || this.dice.isRollingNow() || this.isSelectingMoveTarget) {
            return;
        }
        if (this.purchasePhase) return;

        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.hasRolled) {
            return;
        }

        currentPlayer.rollDice();

        const rollingPlayer = currentPlayer;
        this.dice.roll((value) => {
            let finalValue = value;
            if (rollingPlayer.speedBoostRemainingTurns > 0) {
                finalValue = value * 2;
                this.log(`${rollingPlayer.name} 速度翻倍！${value}×2=${finalValue}`, true);
            }

            // 减速诅咒状态（卡牌）
            const slowStatus = rollingPlayer.getStatus('slow');
            if (slowStatus) {
                const before = finalValue;
                finalValue = Math.floor(finalValue / 2);
                this.notify(`${rollingPlayer.name} 被减速诅咒！骰子数减半：${before}→${finalValue}`, 'warning');
                this.log(`被减速诅咒，骰子数减半：${before}→${finalValue}`, true);
                rollingPlayer.removeStatusObject(slowStatus);
            }

            this.lastRollValue = finalValue;
            this.pendingRollValue = finalValue;
            this.pendingRollPlayer = rollingPlayer;
            this.onDiceRoll && this.onDiceRoll(finalValue, rollingPlayer);

            if (rollingPlayer.hasGhost && rollingPlayer.ghostType === 1) {
                this.isSelectingMoveTarget = true;
                if (this.isAIPlayer(rollingPlayer)) {
                    this.setTimeout(() => {
                        this.selectMoveTarget(Math.random() < 0.5 ? 'player' : 'ghost');
                    }, 400);
                } else {
                    this.onMoveSelect && this.onMoveSelect(rollingPlayer, finalValue);
                }
            } else {
                this.movePlayer(rollingPlayer, finalValue);
            }
        });
    }

    selectMoveTarget(target) {//选择移动目标
        if (!this.isSelectingMoveTarget || !this.pendingRollPlayer) {
            return;
        }

        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer && currentPlayer.id !== this.pendingRollPlayer.id) {
            this.isSelectingMoveTarget = false;
            this.pendingRollPlayer = null;
            this.pendingRollValue = 0;
            return;
        }

        this.isSelectingMoveTarget = false;
        const player = this.pendingRollPlayer;
        const value = this.pendingRollValue;
        this.pendingRollPlayer = null;
        this.pendingRollValue = 0;

        if (target === 'player') {
            this.movePlayer(player, value);
        } else if (target === 'ghost') {
            this.moveGhost(player, value * 2);
        }
    }

    movePlayer(player, steps, isFromProperty = false) {//移动玩家
        const oldPosition = player.position;
        const newPosition = this.board.getFinalPosition(oldPosition, steps);
        
        if (!isFromProperty) {
            player.rollDice();
            this.currentRollStartPos = oldPosition;
            this.log(`🎲${steps}，${oldPosition}->${newPosition}`, true);
        }
        
        this.movePlayerStepByStep(player, oldPosition, newPosition, 0);
    }
    
    moveGhost(player, steps) {//移动幽灵
        const oldPosition = player.ghostPosition;
        const newPosition = this.board.getFinalPosition(oldPosition, steps);
        
        player.rollDice();
        
        this.log(`选择幽灵移动，幽灵从位置${oldPosition}移动到位置${newPosition}`, true);
        
        this.moveGhostStepByStep(player, oldPosition, newPosition, 0);
    }
    
    movePlayerStepByStep(player, startPos, endPos, currentStep) {//玩家移动分步
        if (currentStep === 0) {
            player.moveTo(startPos);
            this.onPlayerMove && this.onPlayerMove(player, startPos, startPos, 0);
        }
        
        this.setTimeout(() => {
            if (player.isDead || player.isWinner) return;
            
            const isForward = endPos >= startPos;
            const nextPos = isForward ? startPos + currentStep + 1 : startPos - currentStep - 1;
            
            const hasReached = isForward ? nextPos >= endPos : nextPos <= endPos;
            
            if (hasReached) {
                    player.moveTo(endPos);
                    // 记录一次完整移动
                    if (typeof player.recordMove === 'function') player.recordMove();
                    this.onPlayerMove && this.onPlayerMove(player, startPos, endPos, endPos - startPos);
                    
                    this.applyMoveEffects(player, endPos);
                    
                    this.checkOvertake(player, startPos, endPos);
                    
                    if (endPos >= this.board.totalCells) {
                        player.win();
                        this.checkGameEnd();
                    } else {
                        const propertyHandled = this.processCellProperty(player, endPos);
                        
                        if (!player.isDead && !propertyHandled) {
                            this.nextTurn();
                        } else if (player.isDead) {
                            this.checkGameEnd();
                        }
                    }
                } else {
                    player.moveTo(nextPos);
                    this.onPlayerMove && this.onPlayerMove(player, startPos, nextPos, isForward ? currentStep + 1 : -(currentStep + 1));
                    
                    this.movePlayerStepByStep(player, startPos, endPos, currentStep + 1);
            }
        }, 100);
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
                if (!this.notifyUndyingIfTriggered(target)) {
                    this.notify(`${target.name} 被坦克光环伤害！血量-1`, 'danger');
                }
            });
            
            const alivePlayers = this.players.filter(p => !p.isDead);
            if (alivePlayers.length <= 1) {
                this.checkGameEnd();
            }
        }
    }
    
    moveGhostStepByStep(player, startPos, endPos, currentStep) {//幽灵移动分步
        if (currentStep === 0) {
            player.ghostMoveTo(startPos);
            this.onPlayerMove && this.onPlayerMove(player, startPos, startPos, 0);
        }
        
        this.setTimeout(() => {
            if (player.isDead || !player.hasGhost) return;
            
            const isForward = endPos >= startPos;
            const nextPos = isForward ? startPos + currentStep + 1 : startPos - currentStep - 1;
            
            const hasReached = isForward ? nextPos >= endPos : nextPos <= endPos;
            
            if (hasReached) {
                player.ghostMoveTo(endPos);
                this.onPlayerMove && this.onPlayerMove(player, startPos, endPos, endPos - startPos);
                
                if (endPos >= this.board.totalCells) {
                    this.notify(`${player.name}的幽灵到达终点！${player.name} 获胜！`, 'success');
                    this.log(`幽灵到达终点，玩家${player.name}获胜`);
                    player.hasGhost = false;
                    player.ghostType = 0;
                    player.ghostHealth = 0;
                    player.ghostPosition = 1;
                    player.win();
                    this.checkGameEnd();
                } else {
                    this.processGhostCellProperty(player, endPos);
                    
                    if (player.hasGhost) {
                        this.nextTurn();
                    } else {
                        this.notify(`${player.name}的幽灵死亡！`, 'danger');
                        this.log(`幽灵死亡`);
                        this.nextTurn();
                    }
                }
            } else {
                player.ghostMoveTo(nextPos);
                this.onPlayerMove && this.onPlayerMove(player, startPos, nextPos, currentStep + 1);
                
                this.moveGhostStepByStep(player, startPos, endPos, currentStep + 1);
            }
        }, 100);
    }
    
    checkOvertake(movingPlayer, oldPosition, newPosition) {//检查是否超过其他玩家
        if (newPosition <= oldPosition) return;
        
        const overtakeThreshold = Math.floor(this.board.totalCells * 4 / 5);
        
        if (newPosition > overtakeThreshold && oldPosition <= overtakeThreshold && !movingPlayer.enteredOvertakeZone) {
            movingPlayer.enteredOvertakeZone = true;
            this.notify(`${movingPlayer.name}进入危险区域！小心后面玩家追杀～`, 'warning');
            this.log(`进入最后1/5区域，超过其他玩家将导致对方血量减少`);
        }
        
        if (newPosition > overtakeThreshold) {
            this.players.forEach(otherPlayer => {
                if (otherPlayer.id === movingPlayer.id || otherPlayer.isDead || otherPlayer.isWinner) return;
                
                if (otherPlayer.position > oldPosition && otherPlayer.position <= newPosition) {
                    otherPlayer.changeHealth(-1);
                    if (!this.notifyUndyingIfTriggered(otherPlayer)) {
                        this.notify(`${movingPlayer.name} 超过了 ${otherPlayer.name}！${otherPlayer.name} 血量减1！`, 'danger');
                    }
                    this.log(`超过${otherPlayer.name}，${otherPlayer.name}血量减1，当前血量${otherPlayer.health}`);
                    if (typeof movingPlayer.recordOvertake === 'function') movingPlayer.recordOvertake();
                }
            });
        }
    }

    processCellProperty(player, position) {//处理单元格属性
        const property = CELL_PROPERTIES[position];
        if (!property) return false;

        return this.processSingleProperty(player, property.type, property.value, property.rawValue);
    }
    
    processGhostCellProperty(player, position) {//处理幽灵单元格属性
        const property = CELL_PROPERTIES[position];
        if (!property) return;

        this.processGhostProperty(player, property.type, property.value, property.rawValue);
    }

    processSingleProperty(player, type, value, rawValue = '') {//处理单属性
        switch (type) {
            case 'blood':
                player.changeHealth(value);
                if (value < 0 && this.notifyUndyingIfTriggered(player)) {
                    this.log(`触发[BL${value > 0 ? '+' : ''}${value}]，不死之身卡牌生效，血量变为${player.health}`);
                } else {
                    this.notify(`${player.name} ${value > 0 ? '血量加' + value : '血量减' + Math.abs(value)}！`, value > 0 ? 'success' : 'danger');
                    this.log(`触发[BL${value > 0 ? '+' : ''}${value}]，血量变为${player.health}`);
                }
                return false;
            case 'diediedie':
                if (player.ghostType === 2 && player.ghostHealth > 0) {
                    player.ghostHealth--;
                    player.ghostCount = player.ghostHealth;
                    if (player.ghostHealth === 0) {
                        player.hasGhost = false;
                        player.ghostType = 0;
                    }
                    this.notify(`${player.name} 的贴身幽灵代替玩家死亡！剩余${player.ghostHealth}血`, 'success');
                    this.log(`触发[DDD]，贴身幽灵代替玩家死亡，剩余${player.ghostHealth}血`);
                } else if (player.undieTurns > 0) {
                    player.undieTurns--;
                    this.notify(`${player.name} 触发死亡陷阱！但不死守护生效，免于死亡！`, 'success');
                    this.log(`触发[DDD]，不死守护生效，剩余${player.undieTurns}回合`);
                } else {
                    player.setHealth(0);
                    if (this.notifyUndyingIfTriggered(player)) {
                        this.log(`触发[DDD]，不死之身卡牌生效，存活`);
                    } else {
                        this.notify(`${player.name} 触发死亡陷阱！直接死亡！`, 'danger');
                        this.log(`触发[DDD]，直接死亡！`);
                    }
                }
                return false;
            case 'fastforward':
                this.notify(`${player.name} 加速前进 ${value} 步！`, 'success');
                this.log(`触发[FF+${value}]，额外前进${value}步`);
                this.movePlayer(player, value, true);
                return true;
            case 'fastback':
                const backwardSteps = Math.min(player.position - 1, value);
                const newBackPos = player.position - backwardSteps;
                const oldBackPos = player.position;
                player.position = newBackPos;
                this.notify(`${player.name} 向后退 ${backwardSteps} 步！`, 'warning');
                this.log(`触发[FB-${value}]，从位置${oldBackPos}后退到位置${newBackPos}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, oldBackPos, newBackPos, -backwardSteps);
                }
                return this.processCellProperty(player, newBackPos);
            case 'flashforward':
                const flashSteps = this.lastRollValue * value;
                this.notify(`${player.name} 超速前进！掷骰数${this.lastRollValue}×${value}=${flashSteps}步！`, 'success');
                this.log(`触发[FL×${value}]，超速前进${flashSteps}步`);
                this.movePlayer(player, flashSteps, true);
                return true;
            case 'flashback':
                const flashBackSteps = this.lastRollValue * value;
                this.notify(`${player.name} 超速后退！掷骰数${this.lastRollValue}×${value}=${flashBackSteps}步！`, 'warning');
                this.log(`触发[FLB×${value}]，超速后退${flashBackSteps}步`);
                this.movePlayer(player, -flashBackSteps, true);
                return true;
            case 'pause':
                player.pauseTurns = value;
                this.notify(`${player.name} 暂停 ${value} 回合！`, 'warning');
                this.log(`触发[P+${value}]，暂停${value}回合`);
                return false;
            case 'bomb':
                this.log(`触发[BB+${value}]，炸弹爆炸！`);
                this.triggerBomb(player, value);
                return false;
            case 'undie':
                player.undieTurns = value;
                player.justGotUndie = true;
                this.notify(`${player.name} 获得不死守护！${value}回合内踩到DDD可不死！`, 'success');
                this.log(`触发[UND${value}]，获得${value}回合不死守护`);
                if (typeof player.recordUndieUse === 'function') player.recordUndieUse();
                return false;
            case 'changeorder':
                this.players.reverse();
                this.notify('玩家顺序已反转！', 'warning');
                this.log('触发[CR]，玩家顺序反转');
                return false;
            case 'blackhole':
                const targetHoleNumber = this.lastRollValue;
                let targetPosition = -1;
                for (const [pos, prop] of Object.entries(CELL_PROPERTIES)) {
                    if (prop.type === 'blackhole' && prop.value === targetHoleNumber) {
                        targetPosition = parseInt(pos);
                        break;
                    }
                }
                if (targetPosition !== -1 && targetPosition !== player.position) {
                    if (typeof player.recordBlackhole === 'function') player.recordBlackhole();
                    const oldPos = player.position;
                    player.position = targetPosition;
                    this.notify(`${player.name} 被黑洞吸入！移动到第${targetPosition}格！`, 'warning');
                    this.log(`触发[BH#${rawValue}]，掷骰数${this.lastRollValue}，移动到黑洞#${targetHoleNumber}（位置${targetPosition}）`);
                    if (this.onPlayerMove) {
                        this.onPlayerMove(player, oldPos, targetPosition, targetPosition - oldPos);
                    }
                    return this.processCellProperty(player, targetPosition);
                } else {
                    this.notify(`${player.name} 触发黑洞，但没有找到目标黑洞！`, 'info');
                }
                return false;
            case 'goto':
                const gotoOldPos = player.position;
                player.position = value;
                this.notify(`${player.name} 被传送到第${value}格！`, 'warning');
                this.log(`触发[TO→${value}]，从位置${gotoOldPos}传送到位置${value}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, gotoOldPos, value, value - gotoOldPos);
                }
                return this.processCellProperty(player, value);
            case 'ghost':
                this.isSelectingGhost = true;
                if (this.isAIPlayer(player)) {
                    this.setTimeout(() => {
                        const ghostType = Math.random() < 0.5 ? 1 : 2;
                        this.selectGhostType(player, ghostType);
                    }, 400);
                } else {
                    this.onGhostSelect && this.onGhostSelect(player);
                }
                return true;
        }
    }
    
    selectGhostType(player, ghostType) {//选择幽灵类型
        this.isSelectingGhost = false;
        
        if (player.hasGhost && player.ghostType === ghostType) {
            if (player.ghostHealth < player.maxGhostCount) {
                player.ghostHealth++;
                player.ghostCount = player.ghostHealth;
            }
        } else {
            const hadOtherGhostType = player.hasGhost && player.ghostType !== ghostType;
            
            player.hasGhost = true;
            player.ghostType = ghostType;
            player.ghostHealth = 1;
            player.ghostCount = 1;
            
            if (ghostType === 1) {
                if (hadOtherGhostType) {
                    player.ghostPosition = player.position;
                } else {
                    player.ghostPosition = 1;
                }
            } else {
                player.ghostPosition = player.position;
            }
        }
        
        const ghostTypeName = ghostType === 1 ? '普通幽灵' : '贴身幽灵';
        this.notify(`${player.name} 召唤了${ghostTypeName}！当前${ghostTypeName}血量：${player.ghostHealth}`, 'success');
        this.log(`触发[GST]，召唤${ghostTypeName}，当前血量${player.ghostHealth}`);
        if (typeof player.recordGhostSummon === 'function') player.recordGhostSummon();
        
        if (!player.isDead) {
            this.nextTurn();
        }
    }
    
    processGhostProperty(player, type, value, rawValue = '') {
        switch (type) {
            case 'blood':
                player.changeGhostHealth(value);
                this.notify(`${player.name}的幽灵 ${value > 0 ? '血量加' + value : '血量减' + Math.abs(value)}！`, value > 0 ? 'success' : 'danger');
                this.log(`幽灵触发[BL${value > 0 ? '+' : ''}${value}]，幽灵血量变为${player.ghostHealth}`);
                break;
            case 'diediedie':
                player.ghostHealth--;
                player.ghostCount = player.ghostHealth;
                if (player.ghostHealth === 0) {
                    player.hasGhost = false;
                    player.ghostType = 0;
                    player.ghostPosition = 1;
                    this.notify(`${player.name}的幽灵触发死亡陷阱！幽灵死亡！`, 'danger');
                    this.log(`幽灵触发[DDD]，幽灵死亡！`);
                } else {
                    this.notify(`${player.name}的幽灵触发死亡陷阱！剩余${player.ghostHealth}血`, 'warning');
                    this.log(`幽灵触发[DDD]，剩余${player.ghostHealth}血`);
                }
                break;
            case 'fastforward':
                this.notify(`${player.name}的幽灵 加速前进 ${value} 步！`, 'success');
                this.log(`幽灵触发[FF+${value}]，额外前进${value}步`);
                this.moveGhost(player, value);
                break;
            case 'fastback':
                const backwardSteps = Math.min(player.ghostPosition - 1, value);
                const newBackPos = player.ghostPosition - backwardSteps;
                const oldBackPos = player.ghostPosition;
                player.ghostPosition = newBackPos;
                this.notify(`${player.name}的幽灵 向后退 ${backwardSteps} 步！`, 'warning');
                this.log(`幽灵触发[FB-${value}]，从位置${oldBackPos}后退到位置${newBackPos}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, oldBackPos, newBackPos, -backwardSteps);
                }
                this.processGhostCellProperty(player, newBackPos);
                break;
            case 'flashforward':
                const flashSteps = this.lastRollValue * value;
                this.notify(`${player.name}的幽灵 超速前进！掷骰数${this.lastRollValue}×${value}=${flashSteps}步！`, 'success');
                this.log(`幽灵触发[FL×${value}]，超速前进${flashSteps}步`);
                this.moveGhost(player, flashSteps);
                break;
            case 'flashback':
                const flashBackSteps = value;
                const flashBackNewPos = Math.max(1, player.ghostPosition - flashBackSteps);
                const flashBackOldPos = player.ghostPosition;
                player.ghostPosition = flashBackNewPos;
                this.notify(`${player.name}的幽灵 超速后退 ${flashBackSteps} 步！`, 'warning');
                this.log(`幽灵触发[FLB-${flashBackSteps}]，从位置${flashBackOldPos}后退到位置${flashBackNewPos}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, flashBackOldPos, flashBackNewPos, -flashBackSteps);
                }
                break;
            case 'bomb':
                player.changeGhostHealth(-1);
                this.notify(`${player.name}的幽灵 被炸弹炸伤！血量减1！`, 'danger');
                this.log(`幽灵触发[BB+${value}]，炸弹爆炸，幽灵血量减1`);
                break;
            case 'blackhole':
                const targetHoleNumber = this.lastRollValue;
                let targetPosition = -1;
                for (const [pos, prop] of Object.entries(CELL_PROPERTIES)) {
                    if (prop.type === 'blackhole' && prop.value === targetHoleNumber) {
                        targetPosition = parseInt(pos);
                        break;
                    }
                }
                if (targetPosition !== -1 && targetPosition !== player.ghostPosition) {
                    const oldPos = player.ghostPosition;
                    player.ghostPosition = targetPosition;
                    this.notify(`${player.name}的幽灵 被黑洞吸入！移动到第${targetPosition}格！`, 'warning');
                    this.log(`幽灵触发[BH#${rawValue}]，掷骰数${this.lastRollValue}，移动到黑洞#${targetHoleNumber}（位置${targetPosition}）`);
                    if (this.onPlayerMove) {
                        this.onPlayerMove(player, oldPos, targetPosition, targetPosition - oldPos);
                    }
                    this.processGhostCellProperty(player, targetPosition);
                } else {
                    this.notify(`${player.name}的幽灵 触发黑洞，但没有找到目标黑洞！`, 'info');
                }
                break;
            case 'goto':
                const gotoOldPos = player.ghostPosition;
                player.ghostPosition = value;
                this.notify(`${player.name}的幽灵 被传送到第${value}格！`, 'warning');
                this.log(`${player.name}的幽灵触发[TO→${value}]，从位置${gotoOldPos}传送到位置${value}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, gotoOldPos, value, value - gotoOldPos);
                }
                this.processGhostCellProperty(player, value);
                break;
        }
    }

    triggerBomb(player, range) {//触发炸弹
        const bombPosition = player.position;
        const affectedPositions = [];
        
        for (let i = -range; i <= range; i++) {
            const pos = bombPosition + i;
            if (pos >= 1 && pos <= this.board.totalCells) {
                affectedPositions.push(pos);
            }
        }
        
        if (this.onBombExplode) {
            this.onBombExplode(affectedPositions);
        }
        
        const affectedPlayers = this.players.filter(p => !p.isDead && !p.isWinner && affectedPositions.includes(p.position));
        
        if (affectedPlayers.length > 0) {
            this.notify(`💥 炸弹爆炸！范围 ${range} 格`, 'danger');
            affectedPlayers.forEach(p => {
                const wasAlive = !p.isDead;
                p.changeHealth(-1);
                if (this.notifyUndyingIfTriggered(p)) {
                    // 不死之身挽救
                } else {
                    this.notify(`${p.name} 被炸弹炸伤！血量减1！`, 'danger');
                }
                if (wasAlive && p.isDead) {
                    if (typeof player.recordBombKill === 'function') player.recordBombKill();
                }
            });

            const alivePlayers = this.players.filter(p => !p.isDead);
            if (alivePlayers.length <= 1) {
                this.checkGameEnd();
            }
        }
    }

    checkGameEnd() {//检查游戏结束
        const winners = this.players.filter(p => p.isWinner);
        
        if (winners.length > 0) {
            this.gameState = 'ended';
            const achievements = (typeof achievementSystem !== 'undefined') ? achievementSystem.checkAchievements(winners[0], this) : [];
            this.onGameEnd && this.onGameEnd(winners[0], achievements);
            this.notifyStateChange();
            return;
        }
        
        const alivePlayers = this.players.filter(p => !p.isDead);
        
        if (alivePlayers.length === 0) {
            this.gameState = 'ended';
            this.onGameEnd && this.onGameEnd(null, []);
            this.notifyStateChange();
        } else if (alivePlayers.length === 1) {
            alivePlayers[0].win();
            this.gameState = 'ended';
            const achievements = (typeof achievementSystem !== 'undefined') ? achievementSystem.checkAchievements(alivePlayers[0], this) : [];
            this.onGameEnd && this.onGameEnd(alivePlayers[0], achievements);
            this.notifyStateChange();
        } else if (this.isAIMode && this.humanPlayerIndex >= 0) {
            const humanPlayer = this.players[this.humanPlayerIndex];
            if (humanPlayer && humanPlayer.isDead) {
                this.gameState = 'ended';
                this.onGameEnd && this.onGameEnd(null, []);
                this.notifyStateChange();
                return;
            }
            this.nextTurn();
        } else {
            this.nextTurn();
        }
    }

    nextTurn() {//下一轮
        this.isSelectingMoveTarget = false;
        this.pendingRollPlayer = null;
        this.pendingRollValue = 0;
        
        const previousPlayer = this.players[this.currentPlayerIndex];
        if (previousPlayer && previousPlayer.undieTurns > 0 && !previousPlayer.isDead && previousPlayer.hasRolled && !previousPlayer.justGotUndie) {
            previousPlayer.undieTurns--;
        }

        if (previousPlayer && previousPlayer.speedBoostRemainingTurns > 0) {
            previousPlayer.speedBoostRemainingTurns--;
            if (previousPlayer.speedBoostRemainingTurns === 0) {
                this.notify(`${previousPlayer.name} 的加速效果已结束！`, 'info');
            }
        }

        // 卡牌状态回合数递减（reflect / undying 有持续回合）
        if (previousPlayer && previousPlayer.activeStatuses && previousPlayer.activeStatuses.length > 0) {
            previousPlayer.activeStatuses.forEach(status => {
                if (status.remainingTurns && status.remainingTurns > 0) {
                    status.remainingTurns--;
                }
            });
            const expired = previousPlayer.activeStatuses.filter(s => s.remainingTurns !== undefined && s.remainingTurns <= 0 && s.type !== 'shield');
            expired.forEach(s => {
                previousPlayer.removeStatusObject(s);
                this.notify(`${previousPlayer.name} 的${this.statusName(s.type)}状态已结束`, 'info');
            });
        }
        
        const oldIndex = this.currentPlayerIndex;
        
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
            const player = this.players[this.currentPlayerIndex];
            
            if (player.pauseTurns > 0) {
                player.pauseTurns--;
            }
        } while (this.players[this.currentPlayerIndex].isWinner || 
                 (this.players[this.currentPlayerIndex].pauseTurns > 0) ||
                 this.players[this.currentPlayerIndex].isDead);
        
        if (this.currentPlayerIndex === 0 && oldIndex !== 0) {
            this.roundCount++;
        }
        
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.resetRoll();
        currentPlayer.justGotUndie = false;
        this.notifyStateChange();
    }

    // ===== 卡牌系统方法 =====

    statusName(type) {//卡牌状态中文名
        const names = {
            shield: '护盾',
            reflect: '反弹',
            undying: '不死之身',
            slow: '减速'
        };
        return names[type] || type;
    }

    notifyUndyingIfTriggered(player) {//检查不死之身是否触发并通知
        if (player._undyingTriggered) {
            player._undyingTriggered = false;
            this.notify(`${player.name} 的不死之身生效，存活下来！`, 'success');
            return true;
        }
        return false;
    }

    isNegativeStatus(status) {//判断是否为负面状态
        return ['slow'].includes(status.type);
    }

    purchaseCard(player, cardId) {//购买卡牌
        const card = cardSystem.getCardById(cardId);
        if (!card || player.points < card.cost) return false;
        player.points -= card.cost;
        player.addCard(card);
        return true;
    }

    aiPurchaseCards(player) {//AI自动购买卡牌
        const allCards = cardSystem.getAllCards();
        let budget = player.points;
        // 优先保证攻防平衡：先买一张防御卡，再随机购买
        const defenseCards = allCards.filter(c => c.type === 'defense' && c.cost <= budget);
        if (defenseCards.length > 0 && Math.random() < 0.7) {
            const pick = defenseCards[Math.floor(Math.random() * defenseCards.length)];
            this.purchaseCard(player, pick.id);
            budget = player.points;
        }
        // 用剩余点数随机购买
        let safety = 20;
        while (budget >= 2 && safety-- > 0) {
            const affordable = allCards.filter(c => c.cost <= budget);
            if (affordable.length === 0) break;
            const pick = affordable[Math.floor(Math.random() * affordable.length)];
            this.purchaseCard(player, pick.id);
            budget = player.points;
        }
    }

    startPurchasePhase() {//进入卡牌购买阶段
        this.purchasePhase = true;
        // AI玩家自动购买
        this.players.forEach(p => {
            if (this.isAIPlayer(p)) {
                this.aiPurchaseCards(p);
            }
        });
        if (this.onCardPurchase) this.onCardPurchase();
    }

    finishPurchasePhase() {//结束卡牌购买阶段，进入游戏
        this.purchasePhase = false;
        this.notifyStateChange();
    }

    useCard(player, cardInstanceId, targetPlayerId = null) {//使用卡牌
        if (this.purchasePhase) return;
        if (this.gameState !== 'playing') return;
        // 仅当前回合玩家可使用，且掷骰子前
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== player.id) return;
        if (player.hasRolled) return;
        // 每回合限用1张卡牌
        if (player.hasUsedCardThisTurn) {
            this.notify(`${player.name} 本回合已使用过卡牌，每回合限用1张`, 'warning');
            return;
        }

        const cardIndex = player.cards.findIndex(c => c.instanceId === cardInstanceId);
        if (cardIndex === -1) return;

        const card = player.cards[cardIndex];
        const target = targetPlayerId !== null
            ? this.players.find(p => p.id === targetPlayerId)
            : null;

        // 需要目标的攻击卡必须选定有效目标
        if (card.targetType === 'enemy' && (!target || target.isDead || target.id === player.id)) {
            return;
        }

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

        // 执行效果
        card.effects.forEach(effect => {
            this.executeCardEffect(card, effect, player, target);
        });

        // 移除卡牌
        player.cards.splice(cardIndex, 1);
        player.hasUsedCardThisTurn = true;  // 标记本回合已使用卡牌
        this.log(`${player.name} 使用了 [${card.name}]`, true);
        this.notifyStateChange();
    }

    executeCardEffect(card, effect, source, target) {//执行卡牌效果
        switch (effect.type) {
            case 'damage':
                this.dealCardDamage(source, target, effect.params.amount);
                break;
            case 'heal':
                source.changeHealth(effect.params.amount);
                this.notify(`${source.name} 恢复了 ${effect.params.amount} 点血量`, 'success');
                this.notifyUndyingIfTriggered(source);
                break;
            case 'move_self':
                this.movePlayerInstant(source, effect.params.steps);
                break;
            case 'move_target':
                this.movePlayerInstant(target, effect.params.steps);
                this.notify(`${target.name} 被${card.name}移动了 ${effect.params.steps} 步`, 'warning');
                break;
            case 'swap_position':
                this.swapPositions(source, target);
                this.notify(`${source.name} 与 ${target.name} 交换了位置！`, 'warning');
                break;
            case 'steal_health':
                const stolen = this.dealCardDamage(source, target, effect.params.amount);
                if (stolen) {
                    source.changeHealth(effect.params.amount);
                    this.notify(`${source.name} 从 ${target.name} 偷取了 ${effect.params.amount} 点血量`, 'success');
                    this.notifyUndyingIfTriggered(source);
                }
                break;
            case 'shield':
                source.addStatus({ type: 'shield', amount: effect.params.amount, remainingTurns: 0 });
                this.notify(`${source.name} 获得护盾，可抵挡 ${effect.params.amount} 次伤害`, 'success');
                break;
            case 'reflect':
                source.addStatus({ type: 'reflect', amount: 1, remainingTurns: effect.duration || 3 });
                this.notify(`${source.name} 获得反弹状态，持续 ${effect.duration || 3} 回合`, 'success');
                break;
            case 'undying':
                source.addStatus({ type: 'undying', amount: effect.params.amount, remainingTurns: effect.duration || 3 });
                this.notify(`${source.name} 获得不死之身，持续 ${effect.duration || 3} 回合`, 'success');
                break;
            case 'slow_target':
                target.addStatus({ type: 'slow', amount: 0, remainingTurns: effect.duration || 1 });
                this.notify(`${target.name} 被减速诅咒！下回合掷骰减半`, 'warning');
                break;
            case 'purify':
                source.activeStatuses = (source.activeStatuses || []).filter(s => !this.isNegativeStatus(s));
                this.notify(`${source.name} 净化了所有负面状态`, 'success');
                break;
            case 'place_bomb':
                this.handleCardBomb(source, target, effect.params);
                break;
        }
    }

    dealCardDamage(source, target, amount) {//卡牌伤害（处理护盾/反弹/不死），返回是否实际造成伤害
        // 护盾抵挡
        const shield = target.getStatus('shield');
        if (shield && shield.amount > 0) {
            shield.amount--;
            if (shield.amount <= 0) {
                target.removeStatusObject(shield);
            }
            this.notify(`${target.name} 的护盾抵挡了 ${amount} 点伤害！`, 'info');
            return false;
        }

        // 反弹
        const reflect = target.getStatus('reflect');
        if (reflect) {
            target.removeStatusObject(reflect);
            this.notify(`${target.name} 反弹了攻击！${source.name} 受到 ${amount} 点伤害`, 'warning');
            // 反弹伤害不递归，直接扣血
            source.changeHealth(-amount);
            this.notifyUndyingIfTriggered(source);
            this.checkCardDamageGameEnd();
            return false;
        }

        // 正常伤害
        target.changeHealth(-amount);
        this.notify(`${target.name} 受到 ${amount} 点卡牌伤害`, 'danger');
        this.notifyUndyingIfTriggered(target);
        this.checkCardDamageGameEnd();
        return true;
    }

    checkCardDamageGameEnd() {//卡牌伤害后检查游戏结束
        const alivePlayers = this.players.filter(p => !p.isDead);
        if (alivePlayers.length <= 1) {
            this.checkGameEnd();
        }
    }

    movePlayerInstant(player, steps) {//卡牌瞬移（不触发格子属性，不记录掷骰）
        const oldPosition = player.position;
        const newPosition = this.board.getFinalPosition(oldPosition, steps);
        player.moveTo(newPosition);
        if (this.onPlayerMove) {
            this.onPlayerMove(player, oldPosition, newPosition, newPosition - oldPosition);
        }
        this.notify(`${player.name} 被/使用卡牌移动到位置 ${newPosition}`, 'info');

        // 到达终点判定
        if (newPosition >= this.board.totalCells) {
            player.win();
            this.checkGameEnd();
        }
    }

    swapPositions(source, target) {//交换两名玩家位置
        const sourcePos = source.position;
        const targetPos = target.position;
        source.moveTo(targetPos);
        target.moveTo(sourcePos);
        if (this.onPlayerMove) {
            this.onPlayerMove(source, sourcePos, targetPos, targetPos - sourcePos);
            this.onPlayerMove(target, targetPos, sourcePos, sourcePos - targetPos);
        }
    }

    handleCardBomb(source, target, params) {//卡牌炸弹
        const bombPosition = target.position;
        const range = params.range;
        const damage = params.damage;
        const affectedPositions = [];

        for (let i = -range; i <= range; i++) {
            const pos = bombPosition + i;
            if (pos >= 1 && pos <= this.board.totalCells) {
                affectedPositions.push(pos);
            }
        }

        if (this.onBombExplode) {
            this.onBombExplode(affectedPositions);
        }

        const affectedPlayers = this.players.filter(p => !p.isDead && !p.isWinner && affectedPositions.includes(p.position));
        if (affectedPlayers.length > 0) {
            this.notify(`💥 ${source.name} 引爆炸弹！范围 ${range} 格，${damage} 点伤害`, 'danger');
            affectedPlayers.forEach(p => {
                // 使用 dealCardDamage 让护盾/反弹生效，但攻击者固定为 source
                this.dealCardDamage(source, p, damage);
            });
            this.checkCardDamageGameEnd();
        }
    }

    aiUseCards(player) {//AI在回合开始时使用卡牌
        if (this.purchasePhase) return;
        if (!player.cards || player.cards.length === 0) return;

        // 防御优先：血量低时使用治疗
        if (player.health <= 2) {
            const healCard = player.cards.find(c => c.id === 'heal');
            if (healCard && Math.random() < 0.8) {
                this.useCard(player, healCard.instanceId);
            }
            const shieldCard = player.cards.find(c => c.id === 'shield');
            if (shieldCard && Math.random() < 0.5) {
                this.useCard(player, shieldCard.instanceId);
            }
        }

        // 攻击：有概率使用攻击卡，目标选血量最低的敌方
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

        // 闪现：领先时不用，落后时有概率用
        const blinkCard = player.cards.find(c => c.id === 'blink');
        if (blinkCard && Math.random() < 0.3) {
            this.useCard(player, blinkCard.instanceId);
        }
    }

    notifyStateChange() {//通知状态改变
        if (this.onStateChange) {
            this.onStateChange({
                state: this.gameState,
                currentPlayer: this.getCurrentPlayer(),
                players: this.players,
                board: this.board
            });
        }
    }

    getGameState() {//获取游戏状态
        return {
            state: this.gameState,
            currentPlayer: this.getCurrentPlayer(),
            players: this.players,
            board: this.board
        };
    }
}