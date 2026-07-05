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
    }

    setCallbacks(callbacks) {
        if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
        if (callbacks.onPlayerMove) this.onPlayerMove = callbacks.onPlayerMove;
        if (callbacks.onDiceRoll) this.onDiceRoll = callbacks.onDiceRoll;
        if (callbacks.onGameEnd) this.onGameEnd = callbacks.onGameEnd;
        if (callbacks.onNotification) this.onNotification = callbacks.onNotification;
        if (callbacks.onLog) this.onLog = callbacks.onLog;
        if (callbacks.onBombExplode) this.onBombExplode = callbacks.onBombExplode;
    }

    notify(message, type = 'info') {
        if (this.onNotification) {
            this.onNotification(message, type);
        }
    }

    log(message) {
        if (this.onLog) {
            this.onLog(message);
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

        const rollingPlayer = currentPlayer;
        this.dice.roll((value) => {
            this.onDiceRoll && this.onDiceRoll(value, rollingPlayer);
            this.movePlayer(rollingPlayer, value);
        });
    }

    movePlayer(player, steps) {
        const oldPosition = player.position;
        const newPosition = this.board.getFinalPosition(oldPosition, steps);
        
        player.rollDice();
        
        this.log(`${player.name}掷出${steps}点，从位置${oldPosition}移动到位置${newPosition}`);
        
        this.movePlayerStepByStep(player, oldPosition, newPosition, 0);
    }
    
    movePlayerStepByStep(player, startPos, endPos, currentStep) {
        if (currentStep === 0) {
            player.moveTo(startPos);
            this.onPlayerMove && this.onPlayerMove(player, startPos, startPos, 0);
        }
        
        setTimeout(() => {
            if (player.isDead || player.isWinner) return;
            
            const nextPos = startPos + currentStep + 1;
            
            if (nextPos >= endPos) {
                player.moveTo(endPos);
                this.onPlayerMove && this.onPlayerMove(player, startPos, endPos, endPos - startPos);
                
                this.checkOvertake(player, startPos, endPos);
                
                if (endPos >= this.board.totalCells) {
                    player.win();
                    this.checkGameEnd();
                } else {
                    this.processCellProperty(player, endPos);
                    
                    if (!player.isDead) {
                        this.nextTurn();
                    } else {
                        this.checkGameEnd();
                    }
                }
            } else {
                player.moveTo(nextPos);
                this.onPlayerMove && this.onPlayerMove(player, startPos, nextPos, currentStep + 1);
                
                this.movePlayerStepByStep(player, startPos, endPos, currentStep + 1);
            }
        }, 100);
    }
    
    checkOvertake(movingPlayer, oldPosition, newPosition) {
        if (newPosition <= oldPosition) return;
        
        const overtakeThreshold = Math.floor(this.board.totalCells * 4 / 5);
        
        if (newPosition > overtakeThreshold && oldPosition <= overtakeThreshold && !movingPlayer.enteredOvertakeZone) {
            movingPlayer.enteredOvertakeZone = true;
            this.notify(`${movingPlayer.name}进入危险区域！小心后面玩家追杀～`, 'warning');
            this.log(`${movingPlayer.name}进入最后1/5区域，超过其他玩家将导致对方血量减少`);
        }
        
        if (newPosition > overtakeThreshold) {
            this.players.forEach(otherPlayer => {
                if (otherPlayer.id === movingPlayer.id || otherPlayer.isDead || otherPlayer.isWinner) return;
                
                if (otherPlayer.position > oldPosition && otherPlayer.position <= newPosition) {
                    otherPlayer.changeHealth(-1);
                    this.notify(`${movingPlayer.name} 超过了 ${otherPlayer.name}！${otherPlayer.name} 血量减1！`, 'danger');
                    this.log(`${movingPlayer.name}超过${otherPlayer.name}，${otherPlayer.name}血量减1，当前血量${otherPlayer.health}`);
                }
            });
        }
    }

    processCellProperty(player, position) {
        const property = CELL_PROPERTIES[position];
        if (!property) return;

        if (property.type === 'combo') {
            for (const subProp of property.properties) {
                if (player.isDead) break;
                this.processSingleProperty(player, subProp.type, subProp.value);
            }
        } else {
            this.processSingleProperty(player, property.type, property.value);
        }
    }

    processSingleProperty(player, type, value) {
        switch (type) {
            case 'blood':
                player.changeHealth(value);
                this.notify(`${player.name} ${value > 0 ? '血量加' + value : '血量减' + Math.abs(value)}！`, value > 0 ? 'success' : 'danger');
                this.log(`${player.name}触发[Bl${value > 0 ? '+' : ''}${value}]，血量变为${player.health}`);
                break;
            case 'diediedie':
                player.setHealth(0);
                this.notify(`${player.name} 触发死亡陷阱！直接死亡！`, 'danger');
                this.log(`${player.name}触发[DDD]，直接死亡！`);
                break;
            case 'fastforward':
                this.notify(`${player.name} 加速前进 ${value} 步！`, 'success');
                this.log(`${player.name}触发[FF+${value}]，额外前进${value}步`);
                this.movePlayer(player, value);
                break;
            case 'pause':
                player.pauseTurns = value;
                this.notify(`${player.name} 暂停 ${value} 回合！`, 'warning');
                this.log(`${player.name}触发[P+${value}]，暂停${value}回合`);
                break;
            case 'bomb':
                this.log(`${player.name}触发[BB+${value}]，炸弹爆炸！`);
                this.triggerBomb(player, value);
                break;
            case 'goto':
                const oldPos = player.position;
                player.position = value;
                this.notify(`${player.name} 被传送到第${value}格！`, 'warning');
                this.log(`${player.name}触发[TO→${value}]，从位置${oldPos}传送到位置${value}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, oldPos, value, value - oldPos);
                }
                this.processCellProperty(player, value);
                break;
            case 'fastback':
                const backwardSteps = Math.min(player.position - 1, value);
                const newBackPos = player.position - backwardSteps;
                const oldBackPos = player.position;
                player.position = newBackPos;
                this.notify(`${player.name} 向后退 ${backwardSteps} 步！`, 'warning');
                this.log(`${player.name}触发[FB-${value}]，从位置${oldBackPos}后退到位置${newBackPos}`);
                if (this.onPlayerMove) {
                    this.onPlayerMove(player, oldBackPos, newBackPos, -backwardSteps);
                }
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
        }
    }

    checkGameEnd() {
        const alivePlayers = this.players.filter(p => !p.isDead && !p.isWinner);
        
        if (alivePlayers.length === 0) {
            this.gameState = 'ended';
            this.notifyStateChange();
        } else if (alivePlayers.length === 1) {
            alivePlayers[0].win();
            this.gameState = 'ended';
            this.onGameEnd && this.onGameEnd(alivePlayers[0]);
            this.notifyStateChange();
        } else {
            const winners = this.players.filter(p => p.isWinner);
            if (winners.length > 0) {
                this.log(`${winners[0].name}到达终点！剩余${alivePlayers.length}位玩家继续游戏`);
            }
            this.nextTurn();
        }
    }

    nextTurn() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerCount;
            const player = this.players[this.currentPlayerIndex];
            
            if (player.pauseTurns > 0) {
                player.pauseTurns--;
            }
        } while (this.players[this.currentPlayerIndex].isWinner || 
                 (this.players[this.currentPlayerIndex].pauseTurns > 0) ||
                 this.players[this.currentPlayerIndex].isDead);
        
        this.getCurrentPlayer().resetRoll();
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