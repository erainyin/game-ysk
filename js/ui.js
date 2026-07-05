class UI {
    constructor() {
        this.boardElement = document.getElementById('board');
        this.playersListElement = document.getElementById('players-list');
        this.playerIndicatorElement = document.getElementById('player-indicator');
        this.gameStatusElement = document.getElementById('game-status');
        this.btnStart = document.getElementById('btn-start');
        this.btnDice = document.getElementById('btn-dice');
        this.btnRestart = document.getElementById('btn-restart');
        this.btnTest = document.getElementById('btn-test'); // 测试按钮 - 测试完成后删除
        this.diceElement = document.getElementById('dice');
        this.diceValueElement = document.getElementById('dice-value');
        this.notificationsElement = document.getElementById('notifications');
        this.playerSelectorElement = document.getElementById('player-selector');
        this.gameLogElement = document.getElementById('game-log');
        this.cellInfoElement = document.getElementById('cell-info');
        this.playerCount = 2;
        
        this.game = new Game(2);
        this.playerTokens = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderBoard();
        this.updateUI();
    }

    setupEventListeners() {
        this.btnStart.addEventListener('click', () => this.handleStart());
        this.btnDice.addEventListener('click', () => this.handleRollDice());
        this.btnRestart.addEventListener('click', () => this.handleRestart());
        this.btnTest.addEventListener('click', () => this.handleTestJump()); // 测试按钮 - 测试完成后删除
        this.diceElement.addEventListener('click', () => this.handleRollDice());

        window.addEventListener('resize', () => {
            if (this.game.gameState === 'playing') {
                this.renderPlayerTokens();
            }
        });

        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handlePlayerCountChange(parseInt(e.target.dataset.count));
            });
        });

        this.game.setCallbacks({
            onStateChange: (state) => this.onStateChange(state),
            onPlayerMove: (player, oldPosition, newPosition, steps) => this.onPlayerMove(player, oldPosition, newPosition, steps),
            onDiceRoll: (value, player) => this.onDiceRoll(value, player),
            onGameEnd: (player) => this.onGameEnd(player),
            onNotification: (message, type) => this.showNotification(message, type),
            onLog: (message) => this.addLog(message),
            onBombExplode: (positions) => this.playBombAnimation(positions)
        });
    }

    renderBoard() {
        this.boardElement.innerHTML = '';

        const totalCells = CONFIG.ROWS * CONFIG.COLS;
        const dangerZoneThreshold = Math.floor(totalCells * 4 / 5);
        
        for (let row = 0; row < CONFIG.ROWS; row++) {
            const rowElement = document.createElement('div');
            rowElement.className = 'row';

            for (let col = 0; col < CONFIG.COLS; col++) {
                const cellNumber = this.game.board.getNumberByPosition(row, col);
                const cell = document.createElement('div');
                cell.className = 'cell';
                if (cellNumber > dangerZoneThreshold) {
                    cell.classList.add('danger-zone');
                }
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.dataset.number = cellNumber;

                const property = CELL_PROPERTIES[cellNumber];
                if (property) {
                    cell.innerHTML = `<span class="cell-number">${cellNumber}</span><span class="cell-property">${property.label}</span>`;
                    cell.style.backgroundColor = PROPERTY_CONFIG[property.type].bgColor;
                    cell.style.backgroundImage = `url(${PROPERTY_CONFIG[property.type].bgImage})`;
                    cell.style.backgroundSize = 'cover';
                    cell.style.color = property.color;
                    
                    let infoText = PROPERTY_CONFIG[property.type].description;
                    if (property.type === 'combo') {
                        infoText = property.properties.map(p => PROPERTY_CONFIG[p.type].description).join(' → ');
                    } else if (property.value !== undefined) {
                        infoText = PROPERTY_CONFIG[property.type].description.replace('N', property.value);
                    }
                    
                    cell.addEventListener('mouseenter', () => {
                        this.showCellInfo(cellNumber, infoText);
                    });
                    
                    cell.addEventListener('mouseleave', () => {
                        this.hideCellInfo();
                    });
                } else {
                    // cell.textContent = cellNumber;
                    cell.innerHTML = `<span class="cell-number">${cellNumber}</span>`;
                    
                    cell.addEventListener('mouseenter', () => {
                        this.showCellInfo(cellNumber, '普通格子，无特殊效果');
                    });
                    
                    cell.addEventListener('mouseleave', () => {
                        this.hideCellInfo();
                    });
                }

                if (cellNumber === 1) {
                    cell.classList.add('start');
                }
                if (cellNumber === CONFIG.ROWS * CONFIG.COLS) {
                    cell.classList.add('end');
                }

                rowElement.appendChild(cell);
            }

            this.boardElement.appendChild(rowElement);
        }
    }
    
    showCellInfo(cellNumber, info) {
        this.cellInfoElement.textContent = `格子 ${cellNumber}: ${info}`;
        this.cellInfoElement.classList.add('active');
        
        this.highlightRelatedCells(cellNumber);
    }
    
    hideCellInfo() {
        this.cellInfoElement.textContent = '悬停格子查看属性说明';
        this.cellInfoElement.classList.remove('active');
        
        this.clearHighlights();
    }
    
    highlightRelatedCells(cellNumber) {
        const property = CELL_PROPERTIES[cellNumber];
        if (!property) return;
        
        const relatedPositions = [];
        
        switch (property.type) {
            case 'bomb':
                for (let i = -property.value; i <= property.value; i++) {
                    const pos = cellNumber + i;
                    if (pos >= 1 && pos <= CONFIG.ROWS * CONFIG.COLS) {
                        relatedPositions.push(pos);
                    }
                }
                break;
            case 'fastforward':
                for (let i = 1; i <= property.value; i++) {
                    const pos = cellNumber + i;
                    if (pos >= 1 && pos <= CONFIG.ROWS * CONFIG.COLS) {
                        relatedPositions.push(pos);
                    }
                }
                break;
            case 'goto':
                relatedPositions.push(property.value);
                break;
            case 'fastback':
                for (let i = 1; i <= property.value; i++) {
                    const pos = cellNumber - i;
                    if (pos >= 1 && pos <= CONFIG.ROWS * CONFIG.COLS) {
                        relatedPositions.push(pos);
                    }
                }
                break;
            case 'combo':
                property.properties.forEach(subProp => {
                    if (subProp.type === 'bomb') {
                        for (let i = -subProp.value; i <= subProp.value; i++) {
                            const pos = cellNumber + i;
                            if (pos >= 1 && pos <= CONFIG.ROWS * CONFIG.COLS) {
                                relatedPositions.push(pos);
                            }
                        }
                    }
                    if (subProp.type === 'fastforward') {
                        for (let i = 1; i <= subProp.value; i++) {
                            const pos = cellNumber + i;
                            if (pos >= 1 && pos <= CONFIG.ROWS * CONFIG.COLS) {
                                relatedPositions.push(pos);
                            }
                        }
                    }
                });
                break;
        }
        
        relatedPositions.forEach(pos => {
            const cell = document.querySelector(`.cell[data-number="${pos}"]`);
            if (cell) {
                cell.classList.add('highlighted');
            }
        });
    }
    
    clearHighlights() {
        document.querySelectorAll('.cell.highlighted').forEach(cell => {
            cell.classList.remove('highlighted');
        });
    }
    
    playBombAnimation(positions) {
        positions.forEach(pos => {
            const cell = document.querySelector(`.cell[data-number="${pos}"]`);
            if (cell) {
                const img = document.createElement('img');
                img.src = 'assets/bb.gif';
                img.className = 'bomb-animation';
                
                img.onload = () => {
                    const duration = img.naturalDuration || 1000;
                    setTimeout(() => {
                        img.remove();
                    }, duration);
                };
                
                cell.appendChild(img);
            }
        });
    }

    renderPlayerTokens() {
        const positionGroups = {};
        this.game.players.forEach(player => {
            if (!positionGroups[player.position]) {
                positionGroups[player.position] = [];
            }
            positionGroups[player.position].push(player);
        });

        this.game.players.forEach(player => {
            let token = this.playerTokens[player.id];
            if (!token) {
                token = document.createElement('div');
                token.className = 'player-token';
                token.id = `player-${player.id}-token`;
                token.style.backgroundColor = player.color;
                this.playerTokens[player.id] = token;
                this.boardElement.appendChild(token);
            }

            const group = positionGroups[player.position];
            const indexInGroup = group.indexOf(player);
            const groupSize = group.length;
            const offsetX = (indexInGroup - (groupSize - 1) / 2) * 14;

            this.updatePlayerTokenPosition(player, offsetX);
        });
    }

    updatePlayerTokenPosition(player, offsetX = 0) {
        const token = this.playerTokens[player.id];
        if (!token) return;

        requestAnimationFrame(() => {
            const cell = document.querySelector(`.cell[data-number="${player.position}"]`);
            if (cell) {
                const cellRect = cell.getBoundingClientRect();
                const boardRect = this.boardElement.getBoundingClientRect();

                const tokenSize = 30;
                const left = cellRect.left - boardRect.left + (cellRect.width - tokenSize) / 2 + offsetX;
                const top = cellRect.top - boardRect.top + (cellRect.height - tokenSize) / 2;

                token.style.left = `${left}px`;
                token.style.top = `${top}px`;
            }
        });
    }

    renderPlayersList() {
        const sortedPlayers = [...this.game.players].sort((a, b) => {
            if (a.isWinner && !b.isWinner) return -1;
            if (!a.isWinner && b.isWinner) return 1;
            if (a.isDead && !b.isDead) return 1;
            if (!a.isDead && b.isDead) return -1;
            return b.position - a.position;
        });
        
        const positions = {};
        this.playersListElement.querySelectorAll('.player-tag').forEach(tag => {
            const rect = tag.getBoundingClientRect();
            const parentRect = this.playersListElement.getBoundingClientRect();
            positions[tag.id] = {
                x: rect.left - parentRect.left,
                y: rect.top - parentRect.top
            };
        });
        
        const newTags = [];
        sortedPlayers.forEach((player, index) => {
            let tag = document.getElementById(`player-${player.id}-tag`);
            
            if (!tag) {
                tag = document.createElement('div');
                tag.id = `player-${player.id}-tag`;
                tag.className = 'player-tag';
                tag.style.backgroundColor = player.color;
                tag.style.transition = 'none';
            }
            
            let statusText = '';
            if (player.isDead) {
                statusText = '<span class="player-dead">💀 已死亡</span>';
            } else if (player.isWinner) {
                statusText = '<span class="player-winner">🏆 获胜</span>';
            } else {
                const hearts = '❤️'.repeat(player.health) + '🖤'.repeat(Math.max(0, 3 - player.health));
                statusText = `<span>位置: ${player.position} | 血量: ${hearts}</span>`;
            }
            
            tag.innerHTML = `
                <span>${player.name}</span>
                ${statusText}
            `;
            
            if (player.id === this.game.currentPlayerIndex && this.game.gameState === 'playing') {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
            
            newTags.push(tag);
        });
        
        this.playersListElement.innerHTML = '';
        newTags.forEach(tag => {
            this.playersListElement.appendChild(tag);
        });
        
        requestAnimationFrame(() => {
            this.playersListElement.querySelectorAll('.player-tag').forEach(tag => {
                const rect = tag.getBoundingClientRect();
                const parentRect = this.playersListElement.getBoundingClientRect();
                const newX = rect.left - parentRect.left;
                const newY = rect.top - parentRect.top;
                
                const oldPos = positions[tag.id];
                if (oldPos) {
                    const deltaX = oldPos.x - newX;
                    const deltaY = oldPos.y - newY;
                    tag.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                    tag.style.transition = 'none';
                }
                
                requestAnimationFrame(() => {
                    tag.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    tag.style.transform = 'translate(0, 0)';
                });
            });
        });
    }

    handleStart() {
        const playerCount = this.getPlayerCount();
        this.game = new Game(playerCount);
        this.game.setCallbacks({
            onStateChange: (state) => this.onStateChange(state),
            onPlayerMove: (player, oldPosition, newPosition, steps) => this.onPlayerMove(player, oldPosition, newPosition, steps),
            onDiceRoll: (value, player) => this.onDiceRoll(value, player),
            onGameEnd: (player) => this.onGameEnd(player),
            onNotification: (message, type) => this.showNotification(message, type),
            onLog: (message) => this.addLog(message),
            onBombExplode: (positions) => this.playBombAnimation(positions)
        });
        this.playerTokens = {};
        this.renderBoard();
        this.playerSelectorElement.style.display = 'none';
        this.gameLogElement.value = '';
        this.addLog(`游戏开始！${playerCount}位玩家准备就绪`);
        this.game.start();
    }

    handleRollDice() {
        this.game.rollDice();
    }

    handleRestart() {
        this.game.restart();
        this.playerTokens = {};
        this.renderBoard();
        this.updateUI();
        this.playerSelectorElement.style.display = 'flex';
        this.btnTest.disabled = true; // 测试按钮 - 测试完成后删除
    }
    
    // 测试方法 - 测试完成后删除
    handleTestJump() {
        const player1 = this.game.players[0];
        if (!player1 || player1.isDead || player1.isWinner) return;
        
        const oldPosition = player1.position;
        player1.position = 25;
        
        if (this.game.onPlayerMove) {
            this.game.onPlayerMove(player1, oldPosition, 25, 25 - oldPosition);
        }
        
        this.game.processCellProperty(player1, 25);
        
        this.renderPlayersList();
    }

    handlePlayerCountChange(count) {
        this.playerCount = count;
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    getPlayerCount() {
        return this.playerCount;
    }

    addLog(message) {
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.gameLogElement.value = `[${timestamp}] ${message}\n` + this.gameLogElement.value;
    }

    onStateChange(state) {
        this.updateUI();
        this.renderPlayersList();
        this.renderPlayerTokens();
    }

    onPlayerMove(player, oldPosition, newPosition, steps) {
        this.renderPlayerTokens();
        this.renderPlayersList();
    }

    onDiceRoll(value, player) {
        const p = player || this.game.getCurrentPlayer();
        this.diceValueElement.textContent = `${p.name}向前走${value}步`;
        
        this.diceElement.classList.remove('rolling');
        
        const diceFaces = ['🎲', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        this.diceElement.textContent = diceFaces[value];
    }

    onGameEnd(player) {
        this.gameStatusElement.textContent = `🎉 ${player.name} 获胜！`;
        this.btnDice.disabled = true;
        this.btnStart.disabled = true;
        this.addLog(`${player.name}到达终点，游戏胜利！`);
        
        setTimeout(() => {
            alert(`${player.name} 获胜！恭喜！`);
        }, 500);
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        
        const colors = {
            success: '#27ae60',
            danger: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        this.notificationsElement.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3500);
    }

    updateUI() {
        const state = this.game.getGameState();
        
        switch (state.state) {
            case 'waiting':
                this.btnStart.disabled = false;
                this.btnDice.disabled = true;
                this.btnTest.disabled = true; // 测试按钮 - 测试完成后删除
                this.gameStatusElement.textContent = '点击开始游戏';
                this.playerIndicatorElement.textContent = '当前玩家：';
                this.playersListElement.innerHTML = '';
                this.diceValueElement.textContent = '等待掷骰';
                this.diceElement.textContent = '🎲';
                this.btnDice.style.background = '';
                this.btnDice.style.backgroundImage = '';
                break;
                
            case 'playing':
                this.btnStart.disabled = true;
                this.btnDice.disabled = false;
                this.btnTest.disabled = false; // 测试按钮 - 测试完成后删除
                this.gameStatusElement.textContent = '游戏进行中';
                if (state.currentPlayer) {
                    this.playerIndicatorElement.textContent = `当前玩家：${state.currentPlayer.name}`;
                    this.btnDice.style.background = state.currentPlayer.color;
                    this.btnDice.style.backgroundImage = 'none';
                    this.btnDice.textContent = `${state.currentPlayer.name}掷骰子`;
                }
                break;
                
            case 'ended':
                this.btnStart.disabled = false;
                this.btnDice.disabled = true;
                this.btnTest.disabled = true; // 测试按钮 - 测试完成后删除
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new UI();
});