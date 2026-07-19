class UI {
    constructor() {
        this.boardElement = document.getElementById('board');
        this.playersListElement = document.getElementById('players-list');
        this.playerIndicatorElement = document.getElementById('player-indicator');
        this.gameStatusElement = document.getElementById('game-status');
        this.btnStart = document.getElementById('btn-start');
        this.btnDice = document.getElementById('btn-dice');
        this.btnRestart = document.getElementById('btn-restart');
        this.btnMapSelect = document.getElementById('btn-map-select');
        this.diceElement = document.getElementById('dice');
        this.diceValueElement = document.getElementById('dice-value');
        this.notificationsElement = document.getElementById('notifications');
        this.playerSelectorElement = document.getElementById('player-selector');
        this.gameLogElement = document.getElementById('game-log');
        this.logData = {};
        this.cellInfoElement = document.getElementById('cell-info');
        this.playerCount = 2;
        this.isRollLocked = false;
        this.currentMapFile = 'grid.csv';
        
        this.game = new Game(2);
        this.playerTokens = {};
        this.ghostTokens = {};
        this.mapSelectModal = null;
        
        this.init();
    }

    async init() {//初始化UI
        this.setupEventListeners();
        await loadGridCSV();
        this.renderBoard();
        this.updateUI();
    }

    setupEventListeners() {//设置事件监听器
        this.btnStart.addEventListener('click', () => this.handleStart());
        this.btnDice.addEventListener('click', () => this.handleRollDice());
        this.btnRestart.addEventListener('click', () => this.handleRestart());
        this.btnMapSelect.addEventListener('click', () => this.handleMapSelect());
        this.diceElement.addEventListener('click', () => this.handleRollDice());

        window.addEventListener('resize', () => {
            if (this.game.gameState === 'playing') {
                this.renderPlayerTokens();
                this.renderGhostTokens();
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
            onBombExplode: (positions) => this.playBombAnimation(positions),
            onGhostSelect: (player) => this.showGhostSelection(player),
            onMoveSelect: (player, value) => this.showMoveSelection(player, value)
        });
    }

    renderBoard() {//渲染游戏板
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
                    const isEvenRow = row % 2 === 0;
                    const isForward = property.direction === 'forward';
                    const isBackward = property.direction === 'backward';
                    let rotation = '';
                    
                    if (isForward && !isEvenRow) {
                        rotation = 'rotate(180deg)';
                    } else if (isBackward && isEvenRow) {
                        rotation = 'rotate(180deg)';
                    }
                    
                    const iconPart = property.label.match(/^[\u{1F300}-\u{1F9FF}➡️]/u);
                    const numberPart = property.label.replace(/^[\u{1F300}-\u{1F9FF}➡️]/u, '');
                    
                    const iconStyle = rotation ? `style="transform: ${rotation}; display: inline-block;"` : '';
                    let propertyHtml = '';
                    if (iconPart) {
                        propertyHtml = `<span class="cell-icon" ${iconStyle}>${iconPart[0]}</span>`;
                    }
                    if (numberPart) {
                        propertyHtml += `<span class="cell-number-value">${numberPart}</span>`;
                    }
                    
                    cell.innerHTML = `<span class="cell-number">${cellNumber}</span><span class="cell-property">${propertyHtml}</span>`;
                    cell.style.backgroundColor = PROPERTY_CONFIG[property.type].bgColor;
                    cell.style.color = property.color;
                    
                    const displayName = property.displayName || PROPERTY_CONFIG[property.type].name;
                    const displayRule = property.displayRule || PROPERTY_CONFIG[property.type].description;
                    const infoText = displayRule ? `${displayName}：${displayRule}` : displayName;
                    
                    cell.addEventListener('mouseenter', () => {
                        this.showCellInfo(cellNumber, infoText);
                    });
                    
                    cell.addEventListener('mouseleave', () => {
                        this.hideCellInfo();
                    });
                } else {
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
            case 'flashforward':
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
            case 'flashback':
                for (let i = 1; i <= property.value; i++) {
                    const pos = cellNumber - i;
                    if (pos >= 1 && pos <= CONFIG.ROWS * CONFIG.COLS) {
                        relatedPositions.push(pos);
                    }
                }
                break;
            case 'blackhole':
                for (const [pos, prop] of Object.entries(CELL_PROPERTIES)) {
                    if (prop.type === 'blackhole' && prop.value !== property.value) {
                        relatedPositions.push(parseInt(pos));
                    }
                }
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
            if (player.isDead) return;
            if (!positionGroups[player.position]) {
                positionGroups[player.position] = [];
            }
            positionGroups[player.position].push(player);
        });

        this.game.players.forEach(player => {
            if (player.isDead) {
                const token = this.playerTokens[player.id];
                if (token) {
                    token.remove();
                    delete this.playerTokens[player.id];
                }

                const existingBadges = document.querySelectorAll(`[data-player-badge="${player.id}"]`);
                existingBadges.forEach(badge => badge.remove());
                return;
            }

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
            this.renderPlayerBadges(player, offsetX);
        });
    }
    
    renderPlayerBadges(player, offsetX = 0) {
        const existingBadges = document.querySelectorAll(`[data-player-badge="${player.id}"]`);
        existingBadges.forEach(badge => badge.remove());
        
        if (player.isDead) return;
        
        let badgeIndex = 0;
        
        if (player.undieTurns > 0) {
            this.createPlayerBadge(player, '🛡️', player.undieTurns, badgeIndex++, offsetX);
        }
        
        if (player.hasGhost && player.ghostType === 2) {
            const ghostCount = player.ghostCount > 1 ? player.ghostCount : null;
            this.createPlayerBadge(player, '👻', ghostCount, badgeIndex++, offsetX);
        }
    }
    
    createPlayerBadge(player, icon, number, index, offsetX) {
        const badge = document.createElement('div');
        badge.className = 'player-token-badge';
        badge.dataset.playerBadge = player.id;
        badge.dataset.badgeType = icon;
        
        if (number !== null) {
            badge.textContent = `${icon}${number}`;
        } else {
            badge.textContent = icon;
        }
        
        this.boardElement.appendChild(badge);
        this.updateBadgePosition(player, badge, index, offsetX);
    }
    
    updateBadgePosition(player, badge, index, offsetX) {
        requestAnimationFrame(() => {
            const cell = document.querySelector(`.cell[data-number="${player.position}"]`);
            if (cell) {
                const cellRect = cell.getBoundingClientRect();
                const boardRect = this.boardElement.getBoundingClientRect();
                
                const tokenSize = 30;
                const badgeSize = 20;
                const spacing = 8;
                
                const baseLeft = cellRect.left - boardRect.left + (cellRect.width - tokenSize) / 2 + offsetX;
                const baseTop = cellRect.top - boardRect.top + (cellRect.height - tokenSize) / 2;
                
                badge.style.left = `${baseLeft + tokenSize / 2 - badgeSize / 2}px`;
                badge.style.top = `${baseTop - badgeSize - spacing * index}px`;
            }
        });
    }

    renderGhostTokens() {
        this.game.players.forEach(player => {
            if (!player.hasGhost || player.isDead) {
                const ghostToken = this.ghostTokens[player.id];
                if (ghostToken) {
                    ghostToken.remove();
                    delete this.ghostTokens[player.id];
                }
                return;
            }

            let ghostToken = this.ghostTokens[player.id];
            if (!ghostToken) {
                ghostToken = document.createElement('div');
                ghostToken.className = 'ghost-token';
                ghostToken.id = `ghost-${player.id}-token`;
                ghostToken.style.borderColor = player.color;
                ghostToken.style.borderStyle = 'dashed';
                ghostToken.style.borderWidth = '3px';
                this.ghostTokens[player.id] = ghostToken;
                this.boardElement.appendChild(ghostToken);
            }

            const group = [player];
            const indexInGroup = 0;
            const groupSize = 1;
            const offsetX = (indexInGroup - (groupSize - 1) / 2) * 14;

            this.updateGhostTokenPosition(player, offsetX);
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
                
                this.updateAllBadgePositions(player, offsetX);
            }
        });
    }
    
    updateAllBadgePositions(player, offsetX = 0) {
        const badges = document.querySelectorAll(`[data-player-badge="${player.id}"]`);
        let badgeIndex = 0;
        
        if (player.undieTurns > 0) {
            const undieBadge = Array.from(badges).find(b => b.dataset.badgeType === '🛡️');
            if (undieBadge) {
                undieBadge.textContent = `🛡️${player.undieTurns}`;
                this.updateBadgePosition(player, undieBadge, badgeIndex++, offsetX);
            }
        }
        
        if (player.hasGhost && player.ghostType === 2) {
            const ghostBadge = Array.from(badges).find(b => b.dataset.badgeType === '👻');
            if (ghostBadge) {
                this.updateBadgePosition(player, ghostBadge, badgeIndex++, offsetX);
            }
        }
    }

    updateGhostTokenPosition(player, offsetX = 0) {
        const ghostToken = this.ghostTokens[player.id];
        if (!ghostToken) return;

        requestAnimationFrame(() => {
            const ghostPos = player.ghostType === 2 ? player.position : player.ghostPosition;
            const cell = document.querySelector(`.cell[data-number="${ghostPos}"]`);
            if (cell) {
                const cellRect = cell.getBoundingClientRect();
                const boardRect = this.boardElement.getBoundingClientRect();

                const tokenSize = 30;
                const left = cellRect.left - boardRect.left + (cellRect.width - tokenSize) / 2 + offsetX;
                const top = cellRect.top - boardRect.top + (cellRect.height - tokenSize) / 2;

                ghostToken.style.left = `${left}px`;
                ghostToken.style.top = `${top}px`;
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
                statusText = `<span class="player-dead">${player.name}｜💀 已死亡</span>`;
            } else if (player.isWinner) {
                statusText = `<span class="player-winner">${player.name}｜🏆 获胜</span>`;
            } else {
                let ghostText = '';
                if (player.hasGhost) {
                    const ghostTypeText = player.ghostType === 1 ? '普通' : '贴身';
                    const ghostHearts = '🩸'.repeat(player.ghostHealth);
                    ghostText = `👻${ghostTypeText}${ghostHearts}`;
                }
                statusText = `<span>${player.name}：📍${player.position}🩸${player.health}${ghostText}</span>`;
            }
            
            tag.innerHTML = statusText;
            tag.setAttribute('data-player-id', player.id);
            
            if (player.id === this.playerIndex) {
                tag.classList.add('is-self');
            } else {
                tag.classList.remove('is-self');
                tag.onclick = (e) => this.showPlayerInfo(e, player);
            }
            
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

    async handleStart() {
        await loadGridCSV(this.currentMapFile);
        this.showSelectPlayerModal(2);
    }
    
    showSelectPlayerModal(playerCount) {
        this.hideSelectionModal();
        
        const modal = document.createElement('div');
        modal.className = 'selection-modal';
        
        let buttonsHtml = this.renderPlayerButtons(playerCount);
        
        modal.innerHTML = `
            <div class="modal-content">
                <h3>选择你要扮演的角色</h3>
                <div class="player-count-selector">
                    <label>玩家数量：</label>
                    <button class="player-count-btn ${playerCount === 2 ? 'active' : ''}" data-count="2" onclick="ui.updatePlayerCount(2)">2人</button>
                    <button class="player-count-btn ${playerCount === 3 ? 'active' : ''}" data-count="3" onclick="ui.updatePlayerCount(3)">3人</button>
                    <button class="player-count-btn ${playerCount === 4 ? 'active' : ''}" data-count="4" onclick="ui.updatePlayerCount(4)">4人</button>
                </div>
                <div class="ai-checkbox-container">
                    <label>
                        <input type="checkbox" id="ai-mode">
                        <span class="checkbox-text">人机大战（其他玩家自动行动）</span>
                    </label>
                </div>
                <div class="selection-buttons" id="selection-buttons">
                    ${buttonsHtml}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.selectionModal = modal;
    }
    
    renderPlayerButtons(playerCount) {
        let buttonsHtml = '';
        for (let i = 0; i < playerCount; i++) {
            const color = CONFIG.PLAYER_COLORS[i];
            buttonsHtml += `
                <button class="player-select-btn" style="background: ${color};" onclick="ui.handleSelectPlayer(${i}, ${playerCount}, document.getElementById('ai-mode').checked)">
                    <span class="player-select-icon">👤</span>
                    <span class="player-select-name">玩家${i + 1}</span>
                </button>
            `;
        }
        return buttonsHtml;
    }
    
    updatePlayerCount(count) {
        const selectionButtons = document.getElementById('selection-buttons');
        const playerCountBtns = document.querySelectorAll('.player-count-btn');
        playerCountBtns.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        selectionButtons.innerHTML = this.renderPlayerButtons(count);
    }
    
    handleSelectPlayer(playerIndex, playerCount, aiMode = false) {
        this.hideSelectionModal();
        
        this.aiMode = aiMode;
        this.playerIndex = playerIndex;
        
        this.game = new Game(playerCount);
        this.game.setAIPlayers(aiMode ? Array.from({ length: playerCount }, (_, index) => index).filter(index => index !== playerIndex) : []);
        this.game.setAIMode(aiMode, playerIndex);
        this.game.setCallbacks({
            onStateChange: (state) => this.onStateChange(state),
            onPlayerMove: (player, oldPosition, newPosition, steps) => this.onPlayerMove(player, oldPosition, newPosition, steps),
            onDiceRoll: (value, player) => this.onDiceRoll(value, player),
            onGameEnd: (player) => this.onGameEnd(player),
            onNotification: (message, type) => this.showNotification(message, type),
            onLog: (message) => this.addLog(message),
            onBombExplode: (positions) => this.playBombAnimation(positions),
            onGhostSelect: (player) => this.showGhostSelection(player),
            onMoveSelect: (player, value) => this.showMoveSelection(player, value)
        });
        
        this.playerTokens = {};
        this.ghostTokens = {};
        this.isRollLocked = false;
        this.playerSelectorElement.style.display = 'none';
        this.btnMapSelect.disabled = true;
        this.logData = {};
        this.gameLogElement.innerHTML = '';
        
        this.renderBoard();
        
        this.game.start();
        
        this.game.players[playerIndex].name = '我';
        
        this.onStateChange();
        this.addLog(`游戏开始！${playerCount}位玩家准备就绪${aiMode ? '（人机大战模式）' : ''}`);
    }
    
    setRollControlsEnabled(enabled) {
        this.btnDice.disabled = !enabled;
        this.diceElement.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    handleAIPlayerTurn() {
        if (!this.aiMode || this.game.gameState !== 'playing') return;
        
        const currentPlayer = this.game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.isDead) return;
        
        if (currentPlayer.id === this.playerIndex) return;
        
        if (currentPlayer.hasRolled) return;
        
        if (this.isAIProcessing) return;
        this.isAIProcessing = true;
        
        setTimeout(() => {
            if (this.game.gameState === 'playing') {
                const player = this.game.getCurrentPlayer();
                if (player && !player.isDead && player.id !== this.playerIndex && !player.hasRolled) {
                    this.game.rollDice();
                }
            }
            this.isAIProcessing = false;
        }, 1500);
    }

    handleRollDice() {
        const currentPlayer = this.game.getCurrentPlayer();
        if (!currentPlayer || this.game.gameState !== 'playing' || this.isRollLocked || this.btnDice.disabled || currentPlayer.hasRolled) {
            return;
        }

        this.isRollLocked = true;
        this.setRollControlsEnabled(false);
        this.game.rollDice();
    }

    handleRestart() {
        this.showRestartConfirmModal();
    }
    
    showRestartConfirmModal() {
        const modal = document.createElement('div');
        modal.className = 'selection-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h3>是否要重新开始游戏？</h3>
                <div style="display: flex; gap: 20px; justify-content: center; margin-top: 20px;">
                    <button class="btn-restart-confirm" onclick="ui.confirmRestart()">是，重新开始</button>
                    <button class="btn-restart-cancel" onclick="ui.hideRestartConfirmModal()">继续游戏</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.restartConfirmModal = modal;
    }
    
    hideRestartConfirmModal() {
        if (this.restartConfirmModal) {
            this.restartConfirmModal.remove();
            this.restartConfirmModal = null;
        }
    }
    
    confirmRestart() {
        this.hideRestartConfirmModal();
        this.game.restart();
        this.playerTokens = {};
        this.ghostTokens = {};
        this.isRollLocked = false;
        this.logData = {};
        this.gameLogElement.innerHTML = '';
        this.playerSelectorElement.style.display = 'flex';
        this.btnMapSelect.disabled = false;
        this.showSelectPlayerModal(2);
    }
    
    async handleMapSelect() {
        if (this.game.gameState === 'playing') return;
        
        const maps = await this.loadMapList();
        this.showMapSelectionModal(maps);
    }
    
    async loadMapList() {
        try {
            const response = await fetch('map/');
            if (!response.ok) {
                throw new Error('Failed to load map directory');
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href$=".csv"]');
            const maps = [];
            
            links.forEach(link => {
                const href = link.getAttribute('href');
                const name = href.replace('.csv', '');
                maps.push({
                    name: name,
                    path: 'map/' + href
                });
            });
            
            maps.unshift({
                name: '默认地图',
                path: 'grid.csv'
            });
            
            return maps;
        } catch (error) {
            console.error('Error loading map list:', error);
            return [
                { name: '默认地图', path: 'grid.csv' },
                { name: 'grid1', path: 'map/grid1.csv' },
                { name: 'grid2', path: 'map/grid2.csv' },
                { name: 'grid3', path: 'map/grid3.csv' },
                { name: 'grid4', path: 'map/grid4.csv' }
            ];
        }
    }
    
    showMapSelectionModal(maps) {
        this.hideMapSelectModal();
        
        const modal = document.createElement('div');
        modal.className = 'map-select-modal';
        
        const currentPath = this.currentMapFile;
        
        modal.innerHTML = `
            <div class="modal-content">
                <h3>🗺️ 选择地图</h3>
                <ul class="map-list">
                    ${maps.map(map => `
                        <li class="map-item ${map.path === currentPath ? 'selected' : ''}" data-path="${map.path}">
                            <span class="map-name">${map.name}</span>
                            ${map.path === currentPath ? '<span class="map-check">✓</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
                <div class="modal-buttons">
                    <button class="btn-cancel" onclick="ui.hideMapSelectModal()">取消</button>
                    <button class="btn-confirm" onclick="ui.confirmMapSelection()">确认选择</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.mapSelectModal = modal;
        
        const mapItems = modal.querySelectorAll('.map-item');
        mapItems.forEach(item => {
            item.addEventListener('click', () => {
                mapItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                const checkSpans = modal.querySelectorAll('.map-check');
                checkSpans.forEach(s => s.remove());
                const checkSpan = document.createElement('span');
                checkSpan.className = 'map-check';
                checkSpan.textContent = '✓';
                item.appendChild(checkSpan);
            });
        });
    }
    
    hideMapSelectModal() {
        if (this.mapSelectModal) {
            this.mapSelectModal.remove();
            this.mapSelectModal = null;
        }
    }
    
    async confirmMapSelection() {
        if (!this.mapSelectModal) return;
        
        const selectedItem = this.mapSelectModal.querySelector('.map-item.selected');
        if (selectedItem) {
            const mapPath = selectedItem.dataset.path;
            if (mapPath !== this.currentMapFile) {
                await loadMapFromFile(mapPath);
                this.currentMapFile = mapPath;
                this.renderBoard();
                this.addLog(`已切换到地图: ${selectedItem.querySelector('.map-name').textContent}`);
            }
        }
        
        this.hideMapSelectModal();
    }
    
    showGhostSelection(player) {
        this.hideSelectionModal();
        
        const modal = document.createElement('div');
        modal.className = 'selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${player.name} 召唤幽灵！选择幽灵类型</h3>
                <div class="selection-buttons">
                    <button class="ghost-btn normal" onclick="ui.handleGhostTypeSelect(1)">
                        <span class="ghost-icon">👻</span>
                        <span class="ghost-name">普通幽灵</span>
                        <span class="ghost-desc">在起点出发，可选择移动玩家或幽灵</span>
                    </button>
                    <button class="ghost-btn companion" onclick="ui.handleGhostTypeSelect(2)">
                        <span class="ghost-icon">👻</span>
                        <span class="ghost-name">贴身幽灵</span>
                        <span class="ghost-desc">与玩家一起移动，可挡一次DDD</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.selectionModal = modal;
        this.pendingGhostPlayer = player;
    }
    
    handleGhostTypeSelect(ghostType) {
        if (this.pendingGhostPlayer) {
            this.game.selectGhostType(this.pendingGhostPlayer, ghostType);
            this.pendingGhostPlayer = null;
        }
        this.hideSelectionModal();
    }
    
    showMoveSelection(player, value) {
        this.hideSelectionModal();
        
        const modal = document.createElement('div');
        modal.className = 'selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${player.name} 掷出了 ${value} 点！选择移动方式</h3>
                <div class="selection-buttons">
                    <button class="move-btn player" onclick="ui.handleMoveTargetSelect('player')">
                        <span class="move-icon">👤</span>
                        <span class="move-name">玩家移动</span>
                        <span class="move-desc">玩家向前移动 ${value} 步</span>
                    </button>
                    <button class="move-btn ghost" onclick="ui.handleMoveTargetSelect('ghost')">
                        <span class="move-icon">👻</span>
                        <span class="move-name">幽灵移动</span>
                        <span class="move-desc">幽灵向前移动 ${value} 步</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.selectionModal = modal;
    }
    
    handleMoveTargetSelect(target) {
        this.game.selectMoveTarget(target);
        this.hideSelectionModal();
    }
    
    hideSelectionModal() {
        if (this.selectionModal) {
            this.selectionModal.remove();
            this.selectionModal = null;
        }
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

    addLog(logInfo) {
        if (typeof logInfo === 'string') {
            if (!this.logData['system']) {
                this.logData['system'] = [];
            }
            this.logData['system'].unshift(logInfo);
        } else {
            const { round, player, message } = logInfo;
            const roundKey = `round_${round}`;
            
            if (!this.logData[roundKey]) {
                this.logData[roundKey] = {
                    round: round,
                    players: {}
                };
            }
            
            if (!this.logData[roundKey].players[player]) {
                this.logData[roundKey].players[player] = [];
            }
            
            this.logData[roundKey].players[player].unshift(message);
        }
        
        this.renderLog();
    }
    
    renderLog() {
        let html = '';
        
        const roundKeys = Object.keys(this.logData).filter(key => key.startsWith('round_'));
        roundKeys.sort((a, b) => parseInt(b.replace('round_', '')) - parseInt(a.replace('round_', '')));
        
        for (const key of roundKeys) {
            const roundData = this.logData[key];
            html += `<div class="round-group">`;
            html += `<div class="round-header">[第${roundData.round}回合]</div>`;
            html += `<div class="player-logs">`;
            
            const playerNames = Object.keys(roundData.players);
            playerNames.sort();
            
            for (const playerName of playerNames) {
                const messages = roundData.players[playerName];
                for (const msg of messages) {
                    html += `<div class="player-log-item"><span class="player-name">${playerName}：</span><span class="log-message">${msg}</span></div>`;
                }
            }
            
            html += `</div></div>`;
        }
        
        if (this.logData['system'] && this.logData['system'].length > 0) {
            for (const msg of this.logData['system']) {
                html += `<div style="color: #28a745; font-weight: 600;">${msg}</div>`;
            }
        }
        
        this.gameLogElement.innerHTML = html;
    }

    onStateChange(state) {
        this.updateUI();
        this.renderPlayersList();
        this.renderPlayerTokens();
        this.renderGhostTokens();
        
        if (this.aiMode) {
            setTimeout(() => {
                this.handleAIPlayerTurn();
            }, 500);
        }
    }

    onPlayerMove(player, oldPosition, newPosition, steps) {
        this.renderPlayerTokens();
        this.renderGhostTokens();
        this.renderPlayersList();
    }

    showPlayerInfo(e, player) {
        e.stopPropagation();
        
        this.hidePlayerInfo();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'player-info-tooltip';
        tooltip.id = 'player-info-tooltip';
        
        let statusText = '';
        if (player.isDead) {
            statusText = `<span class="player-dead">${player.name}｜💀 已死亡</span>`;
        } else if (player.isWinner) {
            statusText = `<span class="player-winner">${player.name}｜🏆 获胜</span>`;
        } else {
            let ghostText = '';
            if (player.hasGhost) {
                const ghostTypeText = player.ghostType === 1 ? '普通' : '贴身';
                const ghostHearts = '🩸'.repeat(player.ghostHealth);
                ghostText = `｜👻：${ghostTypeText}（${ghostHearts}）`;
            }
            statusText = `<span>${player.name}｜📍：${player.position}｜🩸：${player.health}${ghostText}</span>`;
        }
        
        tooltip.innerHTML = statusText;
        tooltip.style.borderColor = player.color;
        
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 10}px`;
        
        document.body.appendChild(tooltip);
        this.playerInfoTooltip = tooltip;
        
        document.addEventListener('click', this.hidePlayerInfo.bind(this), { once: true });
    }
    
    hidePlayerInfo() {
        if (this.playerInfoTooltip) {
            this.playerInfoTooltip.remove();
            this.playerInfoTooltip = null;
        }
    }
    
    onDiceRoll(value, player) {
        const p = player || this.game.getCurrentPlayer();
        this.diceValueElement.textContent = `${p.name}向前走${value}步`;
        
        this.diceElement.classList.remove('rolling');
        
        const diceFaces = ['🎲', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        this.diceElement.textContent = diceFaces[value];
    }

    onGameEnd(player) {
        this.btnDice.disabled = true;
        this.btnStart.disabled = true;
        
        if (!player) {
            this.gameStatusElement.textContent = '💀 你输了！';
            this.addLog('你死亡了，游戏结束！');
            
            setTimeout(() => {
                alert('你输了！');
            }, 500);
        } else {
            this.gameStatusElement.textContent = `🎉 ${player.name} 获胜！`;
            this.addLog(`${player.name}到达终点，游戏胜利！`);
            
            setTimeout(() => {
                alert(`${player.name} 获胜！恭喜！`);
            }, 500);
        }
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
        }, 12000);
    }

    updateUI() {
        const state = this.game.getGameState();

        if (state.currentPlayer && !state.currentPlayer.hasRolled) {
            this.isRollLocked = false;
        }
        
        switch (state.state) {
            case 'waiting':
                this.btnStart.disabled = false;
                this.btnStart.textContent = '开始游戏';
                this.setRollControlsEnabled(false);
                this.gameStatusElement.textContent = '点击开始游戏';
                this.playerIndicatorElement.textContent = '点击开始游戏';
                this.playersListElement.innerHTML = '';
                this.diceValueElement.textContent = '等待掷骰';
                this.diceElement.textContent = '🎲';
                this.btnDice.style.background = '';
                this.btnDice.style.backgroundImage = '';
                break;
                
            case 'playing':
                this.btnStart.disabled = true;
                this.btnStart.textContent = '游戏进行中';
                this.gameStatusElement.textContent = '游戏进行中';
                if (state.currentPlayer) {
                    this.playerIndicatorElement.textContent = `当前玩家：${state.currentPlayer.name}`;
                    this.btnDice.style.background = state.currentPlayer.color;
                    this.btnDice.style.backgroundImage = 'none';
                    this.btnDice.textContent = `${state.currentPlayer.name}掷骰子`;
                    
                    const canRoll = !state.currentPlayer.hasRolled && !this.isRollLocked && !(this.aiMode && state.currentPlayer.id !== this.playerIndex);
                    this.setRollControlsEnabled(canRoll);
                } else {
                    this.setRollControlsEnabled(false);
                }
                break;
                
            case 'ended':
                this.btnStart.disabled = false;
                this.btnStart.textContent = '开始游戏';
                this.btnDice.disabled = true;
                break;
        }
    }
}

let ui = null;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI();
});