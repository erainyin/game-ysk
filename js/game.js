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
    }

    setCallbacks(callbacks) {
        if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
        if (callbacks.onPlayerMove) this.onPlayerMove = callbacks.onPlayerMove;
        if (callbacks.onDiceRoll) this.onDiceRoll = callbacks.onDiceRoll;
        if (callbacks.onGameEnd) this.onGameEnd = callbacks.onGameEnd;
        if (callbacks.onNotification) this.onNotification = callbacks.onNotification;
        if (callbacks.onLog) this.onLog = callbacks.onLog;
        if (callbacks.onBombExplode) this.onBombExplode = callbacks.onBombExplode;
        if (callbacks.onGhostSelect) this.onGhostSelect = callbacks.onGhostSelect;
        if (callbacks.onMoveSelect) this.onMoveSelect = callbacks.onMoveSelect;
    }

    setAIPlayers(playerIds = []) {
        this.aiPlayerIds = new Set(playerIds);
    }

    isAIPlayer(player) {
        return !!player && this.aiPlayerIds.has(player.id);
    }

    notify(message, type = 'info') {
        if (this.onNotification) {
            this.onNotification(message, type);
        }
    }

    log(message, isMainRoll = false) {
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

    initPlayers(count) {
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

    start() {
        this.initPlayers(this.playerCount);
        this.currentPlayerIndex = 0;
        this.gameState = 'playing';
        this.notifyStateChange();
    }

    restart() {
        this.gameState = 'waiting';
        this.currentPlayerIndex = 0;
        this.players = [];
        this.notifyStateChange();
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getPlayerCount() {
        return this.playerCount;
    }

    rollDice() {
        if (this.gameState !== 'playing' || this.dice.isRollingNow()) {
            return;
        }

        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.hasRolled) {
            return;
        }

        currentPlayer.rollDice();
        
        const rollingPlayer = currentPlayer;
        this.dice.roll((value) => {
            this.lastRollValue = value;
            this.pendingRollValue = value;
            this.pendingRollPlayer = rollingPlayer;
            this.onDiceRoll && this.onDiceRoll(value, rollingPlayer);
            
            if (rollingPlayer.hasGhost && rollingPlayer.ghostType === 1) {
                this.isSelectingMoveTarget = true;
                if (this.isAIPlayer(rollingPlayer)) {
                    setTimeout(() => {
                        this.selectMoveTarget(Math.random() < 0.5 ? 'player' : 'ghost');
                    }, 400);
                } else {
                    this.onMoveSelect && this.onMoveSelect(rollingPlayer, value);
                }
            } else {
                this.movePlayer(rollingPlayer, value);
            }
        });
    }

    selectMoveTarget(target) {
        if (!this.isSelectingMoveTarget || !this.pendingRollPlayer) {
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

    movePlayer(player, steps, isFromProperty = false) {
        const oldPosition = player.position;
        const newPosition = this.board.getFinalPosition(oldPosition, steps);
        
        if (!isFromProperty) {
            player.rollDice();
            this.currentRollStartPos = oldPosition;
            this.log(`🎲${steps}，${oldPosition}->${newPosition}`, true);
        }
        
        this.movePlayerStepByStep(player, oldPosition, newPosition, 0);
    }
    
    moveGhost(player, steps) {
        const oldPosition = player.ghostPosition;
        const newPosition = this.board.getFinalPosition(oldPosition, steps);
        
        player.rollDice();
        
        this.log(`选择幽灵移动，幽灵从位置${oldPosition}移动到位置${newPosition}`, true);
        
        this.moveGhostStepByStep(player, oldPosition, newPosition, 0);
    }
    
    movePlayerStepByStep(player, startPos, endPos, currentStep) {
        if (currentStep === 0) {
            player.moveTo(startPos);
            this.onPlayerMove && this.onPlayerMove(player, startPos, startPos, 0);
        }
        
        setTimeout(() => {
            if (player.isDead || player.isWinner) return;
            
            const isForward = endPos >= startPos;
            const nextPos = isForward ? startPos + currentStep + 1 : startPos - currentStep - 1;
            
            const hasReached = isForward ? nextPos >= endPos : nextPos <= endPos;
            
            if (hasReached) {
                    player.moveTo(endPos);
                    this.onPlayerMove && this.onPlayerMove(player, startPos, endPos, endPos - startPos);
                    
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
    
    moveGhostStepByStep(player, startPos, endPos, currentStep) {
        if (currentStep === 0) {
            player.ghostMoveTo(startPos);
            this.onPlayerMove && this.onPlayerMove(player, startPos, startPos, 0);
        }
        
        setTimeout(() => {
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
    
    checkOvertake(movingPlayer, oldPosition, newPosition) {
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
                    this.notify(`${movingPlayer.name} 超过了 ${otherPlayer.name}！${otherPlayer.name} 血量减1！`, 'danger');
                    this.log(`超过${otherPlayer.name}，${otherPlayer.name}血量减1，当前血量${otherPlayer.health}`);
                }
            });
        }
    }

    processCellProperty(player, position) {
        const property = CELL_PROPERTIES[position];
        if (!property) return false;

        return this.processSingleProperty(player, property.type, property.value, property.rawValue);
    }
    
    processGhostCellProperty(player, position) {
        const property = CELL_PROPERTIES[position];
        if (!property) return;

        this.processGhostProperty(player, property.type, property.value, property.rawValue);
    }

    processSingleProperty(player, type, value, rawValue = '') {
        switch (type) {
            case 'blood':
                player.changeHealth(value);
                this.notify(`${player.name} ${value > 0 ? '血量加' + value : '血量减' + Math.abs(value)}！`, value > 0 ? 'success' : 'danger');
                this.log(`触发[BL${value > 0 ? '+' : ''}${value}]，血量变为${player.health}`);
                return false;
            case 'diediedie':
                if (player.ghostType === 2 && player.ghostCount > 0) {
                    player.ghostCount--;
                    player.ghostHealth = player.ghostCount;
                    if (player.ghostCount === 0) {
                        player.hasGhost = false;
                        player.ghostType = 0;
                    }
                    this.notify(`${player.name} 的贴身幽灵代替玩家死亡！剩余${player.ghostCount}个`, 'success');
                    this.log(`触发[DDD]，贴身幽灵代替玩家死亡，剩余${player.ghostCount}个`);
                } else if (player.undieTurns > 0) {
                    player.undieTurns--;
                    this.notify(`${player.name} 触发死亡陷阱！但不死守护生效，免于死亡！`, 'success');
                    this.log(`触发[DDD]，不死守护生效，剩余${player.undieTurns}回合`);
                } else {
                    player.setHealth(0);
                    this.notify(`${player.name} 触发死亡陷阱！直接死亡！`, 'danger');
                    this.log(`触发[DDD]，直接死亡！`);
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
                return false;
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
                    setTimeout(() => {
                        const ghostType = Math.random() < 0.5 ? 1 : 2;
                        this.selectGhostType(player, ghostType);
                    }, 400);
                } else {
                    this.onGhostSelect && this.onGhostSelect(player);
                }
                return true;
        }
    }
    
    selectGhostType(player, ghostType) {
        this.isSelectingGhost = false;
        
        if (player.hasGhost && player.ghostType === ghostType && player.ghostCount < player.maxGhostCount) {
            player.ghostCount++;
        } else {
            player.hasGhost = true;
            player.ghostType = ghostType;
            player.ghostCount = 1;
        }
        
        player.ghostHealth = player.ghostCount;
        player.ghostPosition = ghostType === 1 ? 1 : player.position;
        
        const ghostTypeName = ghostType === 1 ? '普通幽灵' : '贴身幽灵';
        this.notify(`${player.name} 召唤了${ghostTypeName}！当前${ghostTypeName}数量：${player.ghostCount}`, 'success');
        this.log(`触发[GST]，召唤${ghostTypeName}，当前数量${player.ghostCount}`);
        
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
                player.ghostCount--;
                player.ghostHealth = player.ghostCount;
                if (player.ghostCount === 0) {
                    player.hasGhost = false;
                    player.ghostType = 0;
                    player.ghostPosition = 1;
                    this.notify(`${player.name}的幽灵触发死亡陷阱！幽灵死亡！`, 'danger');
                    this.log(`幽灵触发[DDD]，幽灵死亡！`);
                } else {
                    this.notify(`${player.name}的幽灵触发死亡陷阱！剩余${player.ghostCount}个`, 'warning');
                    this.log(`幽灵触发[DDD]，剩余${player.ghostCount}个`);
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

    triggerBomb(player, range) {
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
                p.changeHealth(-1);
                this.notify(`${p.name} 被炸弹炸伤！血量减1！`, 'danger');
            });
            this.checkGameEnd();
        }
    }

    checkGameEnd() {
        const winners = this.players.filter(p => p.isWinner);
        
        if (winners.length > 0) {
            this.gameState = 'ended';
            this.onGameEnd && this.onGameEnd(winners[0]);
            this.notifyStateChange();
            return;
        }
        
        const alivePlayers = this.players.filter(p => !p.isDead);
        
        if (alivePlayers.length === 0) {
            this.gameState = 'ended';
            this.notifyStateChange();
        } else if (alivePlayers.length === 1) {
            alivePlayers[0].win();
            this.gameState = 'ended';
            this.onGameEnd && this.onGameEnd(alivePlayers[0]);
            this.notifyStateChange();
        } else {
            this.nextTurn();
        }
    }

    nextTurn() {
        const previousPlayer = this.players[this.currentPlayerIndex];
        if (previousPlayer && previousPlayer.undieTurns > 0 && !previousPlayer.isDead && previousPlayer.hasRolled && !previousPlayer.justGotUndie) {
            previousPlayer.undieTurns--;
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

    notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange({
                state: this.gameState,
                currentPlayer: this.getCurrentPlayer(),
                players: this.players,
                board: this.board
            });
        }
    }

    getGameState() {
        return {
            state: this.gameState,
            currentPlayer: this.getCurrentPlayer(),
            players: this.players,
            board: this.board
        };
    }
}