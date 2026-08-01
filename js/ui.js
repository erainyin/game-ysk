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
        this.playerSkins = {};
        this.selectedPlayerIndex = null;
        
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
            onGameEnd: (player, achievements) => this.onGameEnd(player, achievements),
            onNotification: (message, type) => this.showNotification(message, type),
            onLog: (message) => this.addLog(message),
            onBombExplode: (positions) => this.playBombAnimation(positions),
            onGhostSelect: (player) => this.showGhostSelection(player),
            onMoveSelect: (player, value) => this.showMoveSelection(player, value),
            onCardPurchase: () => this.showPurchaseModal()
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
                this.playerTokens[player.id] = token;
                this.boardElement.appendChild(token);
            }
            
            token.style.backgroundColor = player.color;
            
            if (player.skin && player.skin.id !== 'default') {
                const skinIconPath = skinSystem.getIconPath(player.skin.id);
                token.style.backgroundImage = `url(${skinIconPath})`;
                token.style.backgroundSize = '70%';
                token.style.backgroundPosition = 'center';
                token.style.backgroundRepeat = 'no-repeat';
            } else {
                token.style.backgroundImage = '';
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
            
            let skinIcon = '';
            if (player.skin && player.skin.id !== 'default') {
                const skinIconPath = skinSystem.getIconPath(player.skin.id);
                skinIcon = `<img class="skin-icon-mini" src="${skinIconPath}" alt="${player.skin.name}">`;
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
                statusText = `<span>${skinIcon}${player.name}：📍${player.position}🩸${player.health}${ghostText}</span>`;
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
        // 保存当前选择的人数
        this.playerCount = playerCount;
        
        let buttonsHtml = this.renderPlayerButtons(playerCount);
        
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close-btn" onclick="ui.hideSelectionModal()" aria-label="关闭">×</button>
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
                <div class="modal-action-bar">
                    <button class="btn-start-game" onclick="ui.startSelectedGame()">开始游戏</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.selectionModal = modal;
        
        this.bindSkinSelectionEvents();
    }
    
    renderPlayerButtons(playerCount) {
        let buttonsHtml = '';
        for (let i = 0; i < playerCount; i++) {
            const color = CONFIG.PLAYER_COLORS[i];
            const isSelected = this.selectedPlayerIndex === i;
            const buttonText = isSelected ? '我' : `玩家${i + 1}`;
            buttonsHtml += `
                <div class="player-selection-item">
                    <button class="player-select-btn ${isSelected ? 'selected-player' : ''}" style="background: ${color};" onclick="ui.selectPlayer(${i}, ${playerCount})">
                        <span class="player-select-icon">👤</span>
                        <span class="player-select-name">${buttonText}</span>
                    </button>
                    <div class="skin-selector">
                        <div class="skin-selector-label">选择皮肤：</div>
                        <div class="skin-cards">
                            ${this.renderSkinCards(i)}
                        </div>
                    </div>
                </div>
            `;
        }
        return buttonsHtml;
    }
    
    renderSkinCards(playerIndex) {
        const skins = skinSystem.getAllSkins();
        const defaultSkin = skins.find(s => s.id === 'default');
        const selectedSkinId = this.playerSkins[playerIndex] || 'default';
        const selectedSkin = skins.find(s => s.id === selectedSkinId);
        
        let html = `
            <div class="skin-icons">
        `;
        
        skins.forEach(skin => {
            const isSelected = this.playerSkins[playerIndex] === skin.id;
            const iconPath = skinSystem.getIconPath(skin.id);
            html += `
                <div class="skin-icon ${isSelected ? 'selected' : ''}" 
                     data-player="${playerIndex}" 
                     data-skin="${skin.id}">
                    <img src="${iconPath}" alt="${skin.name}">
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="skin-detail" id="skin-detail-${playerIndex}">
                <div class="skin-detail-icon">
                    <img src="${skinSystem.getIconPath(selectedSkinId)}" alt="${selectedSkin.name}">
                </div>
                <div class="skin-detail-info">
                    <div class="skin-detail-name">${selectedSkin.name}</div>
                    <div class="skin-detail-desc">${selectedSkin.description}</div>
                </div>
            </div>
        `;
        
        return html;
    }
    
    bindSkinSelectionEvents() {
        document.querySelectorAll('.skin-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const playerIndex = parseInt(e.currentTarget.dataset.player);
                const skinId = e.currentTarget.dataset.skin;
                
                document.querySelectorAll(`.skin-icon[data-player="${playerIndex}"]`).forEach(c => {
                    c.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
                
                this.playerSkins[playerIndex] = skinId;
                
                this.updateSkinDetail(playerIndex, skinId, e.currentTarget);
            });
        });
    }
    
    updateSkinDetail(playerIndex, skinId, triggerElement = null) {
        const skin = skinSystem.getSkinById(skinId);
        const detailElement = document.getElementById(`skin-detail-${playerIndex}`);
        if (!detailElement || !skin) return;

        const isMobile = window.innerWidth < 768;
        detailElement.innerHTML = `
            <div class="skin-detail-icon">
                <img src="${skinSystem.getIconPath(skinId)}" alt="${skin.name}">
            </div>
            <div class="skin-detail-info">
                <div class="skin-detail-name">${skin.name}</div>
                <div class="skin-detail-desc">${skin.description}</div>
            </div>
        `;

        if (isMobile) {
            this.hideSkinDetailTooltips();
            detailElement.classList.add('active');

            if (triggerElement && this.selectionModal) {
                const modalContent = this.selectionModal.querySelector('.modal-content');
                if (modalContent) {
                    const modalRect = modalContent.getBoundingClientRect();
                    const rect = triggerElement.getBoundingClientRect();
                    const left = rect.left - modalRect.left + rect.width / 2 - 110;
                    const top = rect.top - modalRect.top - 90;
                    detailElement.style.left = `${Math.max(8, Math.min(left, modalRect.width - 220))}px`;
                    detailElement.style.top = `${Math.max(8, top)}px`;
                }
            }
        } else {
            detailElement.classList.remove('active');
        }
    }

    hideSkinDetailTooltips() {
        document.querySelectorAll('.skin-detail.active').forEach(detail => {
            detail.classList.remove('active');
        });
    }
    
    updatePlayerCount(count) {
        const selectionButtons = document.getElementById('selection-buttons');
        // 更新内部记录的人数
        this.playerCount = count;
        const playerCountBtns = document.querySelectorAll('.player-count-btn');
        playerCountBtns.forEach(btn => {
            if (parseInt(btn.dataset.count) === count) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        selectionButtons.innerHTML = this.renderPlayerButtons(count);
        this.bindSkinSelectionEvents();
    }
    
    selectPlayer(playerIndex, playerCount) {
        this.selectedPlayerIndex = playerIndex;
        const selectionButtons = document.getElementById('selection-buttons');
        if (selectionButtons) {
            selectionButtons.innerHTML = this.renderPlayerButtons(playerCount);
            this.bindSkinSelectionEvents();
        }
    }

    startSelectedGame(playerCount) {
        // playerCount optional; prefer current selected value
        const count = typeof playerCount === 'number' ? playerCount : (this.playerCount || 2);
        const aiModeElement = document.getElementById('ai-mode');
        const aiMode = aiModeElement ? aiModeElement.checked : false;
        const playerIndex = this.selectedPlayerIndex;

        if (playerIndex === undefined || playerIndex === null) {
            this.showNotification('请先选择你要扮演的角色', 'warning');
            return;
        }

        this.hideSelectionModal();

        this.aiMode = aiMode;
        this.playerIndex = playerIndex;

        this.game = new Game(count);
        this.game.setAIPlayers(aiMode ? Array.from({ length: count }, (_, index) => index).filter(index => index !== playerIndex) : []);
        this.game.setAIMode(aiMode, playerIndex);
        this.game.setCallbacks({
            onStateChange: (state) => this.onStateChange(state),
            onPlayerMove: (player, oldPosition, newPosition, steps) => this.onPlayerMove(player, oldPosition, newPosition, steps),
            onDiceRoll: (value, player) => this.onDiceRoll(value, player),
            onGameEnd: (player, achievements) => this.onGameEnd(player, achievements),
            onNotification: (message, type) => this.showNotification(message, type),
            onLog: (message) => this.addLog(message),
            onBombExplode: (positions) => this.playBombAnimation(positions),
            onGhostSelect: (player) => this.showGhostSelection(player),
            onMoveSelect: (player, value) => this.showMoveSelection(player, value),
            onCardPurchase: () => this.showPurchaseModal()
        });

        this.playerTokens = {};
        this.ghostTokens = {};
        this.isRollLocked = false;
        // this.playerSelectorElement.style.display = 'none';
        this.btnMapSelect.disabled = true;
        this.logData = {};
        this.gameLogElement.innerHTML = '';

        this.renderBoard();

        // 进入卡牌购买阶段（先于第一回合，阻断AI回合与掷骰）
        this.game.purchasePhase = true;
        this.game.start();

        const skins = skinSystem.getAllSkins();
        const nonDefaultSkins = skins.filter(s => s.id !== 'default');

        for (let i = 0; i < count; i++) {
            let skinId = this.playerSkins[i];

            if (!skinId && aiMode && i !== playerIndex) {
                const randomIndex = Math.floor(Math.random() * nonDefaultSkins.length);
                skinId = nonDefaultSkins[randomIndex].id;
            }

            skinId = skinId || 'default';
            this.game.players[i].setSkin(skinSystem.getSkinById(skinId));
        }

        this.game.players[playerIndex].name = '我';

        this.onStateChange();
        this.addLog(`游戏开始！${count}位玩家准备就绪${aiMode ? '（人机大战模式）' : ''}`);

        // 启动购买阶段：AI自动购买 + 显示人类玩家购买弹窗
        this.game.startPurchasePhase();
    }
    
    setRollControlsEnabled(enabled) {
        this.btnDice.disabled = !enabled;
        this.diceElement.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    handleAIPlayerTurn() {
        if (!this.aiMode || this.game.gameState !== 'playing') return;
        if (this.game.purchasePhase) return;

        const currentPlayer = this.game.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.isDead) return;

        if (currentPlayer.id === this.playerIndex) return;

        if (currentPlayer.hasRolled) return;

        if (this.isAIProcessing) return;
        this.isAIProcessing = true;

        setTimeout(() => {
            if (this.game.gameState === 'playing' && !this.game.purchasePhase) {
                const player = this.game.getCurrentPlayer();
                if (player && !player.isDead && player.id !== this.playerIndex && !player.hasRolled) {
                    // AI先使用卡牌，再掷骰子
                    this.game.aiUseCards(player);
                    this.game.rollDice();
                }
            }
            this.isAIProcessing = false;
        }, 1500);
    }

    handleRollDice() {
        const currentPlayer = this.game.getCurrentPlayer();
        if (!currentPlayer || this.game.gameState !== 'playing' || this.game.purchasePhase || this.isRollLocked || this.btnDice.disabled || currentPlayer.hasRolled) {
            return;
        }

        this.isRollLocked = true;
        this.setRollControlsEnabled(false);
        this.game.rollDice();
    }

    handleRestart() {
        // this.playerSelectorElement.style.display = 'none';
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
        // 直接刷新页面，重置所有游戏状态
        window.location.reload();
    }
    
    async handleMapSelect() {
        if (this.game.gameState === 'playing') return;
        
        const maps = await this.loadMapList();
        this.showMapSelectionModal(maps);
    }
    
    async loadMapList() {
        try {
            const response = await fetch('map/maplist.json', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Failed to load map list');
            }

            const maps = await response.json();
            if (!Array.isArray(maps)) {
                throw new Error('Invalid map list format');
            }

            return maps.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name, 'zh-Hans-CN', { sensitivity: 'base' }));
        } catch (error) {
            console.warn('Error loading map list from maplist.json, using fallback list:', error);
            return [{
                name: '默认地图',
                displayName: '默认地图',
                path: 'grid.csv'
            }];
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
                            <span class="map-name">${map.displayName || map.name}</span>
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
            if (parseInt(btn.dataset.count) === count) btn.classList.add('active');
            else btn.classList.remove('active');
        });
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
        
        let skinIcon = '';
        if (player.skin && player.skin.id !== 'default') {
            const skinIconPath = skinSystem.getIconPath(player.skin.id);
            skinIcon = `<img class="skin-icon-mini" src="${skinIconPath}" alt="${player.skin.name}">`;
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
                ghostText = `｜👻：${ghostTypeText}（${ghostHearts}）`;
            }
            statusText = `<span>${skinIcon}${player.name}｜📍：${player.position}｜🩸：${player.health}${ghostText}</span>`;
        }

        // 卡牌信息：剩余点数 + 手牌
        const cardCount = (player.cards || []).length;
        let cardInfo = '';
        if (!player.isDead && !player.isWinner) {
            const cardsText = (player.cards || []).map(c => `${c.emoji}${c.name}`).join('、');
            cardInfo = `<div class="player-info-cards">
                <div class="player-info-points">💰 点数：${player.points}</div>
                <div class="player-info-hand">🃏 手牌（${cardCount}张）：${cardsText || '无'}</div>
            </div>`;
        }

        tooltip.innerHTML = statusText + cardInfo;
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

    onGameEnd(player, achievements = []) {
        this.btnDice.disabled = true;
        this.btnStart.disabled = true;

        const modal = document.createElement('div');
        modal.className = 'selection-modal';

        let contentHtml = '<div class="modal-content">';
        contentHtml += `<button class="modal-close-btn" onclick="ui.closeGameEndModal()" aria-label="关闭">×</button>`;

        if (!player) {
            contentHtml += `<div class="game-end-winner">💀 你输了！</div>`;
            this.addLog('你死亡了，游戏结束！');
        } else {
            contentHtml += `<div class="game-end-winner">🏆 ${player.name} 获得胜利！</div>`;
            this.addLog(`${player.name}到达终点，游戏胜利！`);

            if (achievements && achievements.length > 0) {
                contentHtml += `<div class="achievements-section">`;
                contentHtml += `<div class="achievements-title">🎖️ 获得成就：</div>`;
                contentHtml += `<div class="achievements-list">`;
                achievements.forEach(a => {
                    contentHtml += `
                        <div class="achievement-item">
                            <div class="achievement-icon">${a.icon}</div>
                            <div class="achievement-info">
                                <div class="achievement-name">${a.name}</div>
                                <div class="achievement-desc">${a.description}</div>
                            </div>
                        </div>
                    `;
                });
                contentHtml += `</div></div>`;
            }
        }

        contentHtml += `
            <div class="game-end-buttons">
                <button class="btn-start-game" onclick="ui.handleRestartFromEnd()">再来一局</button>
                <button class="btn-restart-cancel" onclick="ui.closeGameEndModal()">返回首页</button>
            </div>`;

        contentHtml += '</div>';

        modal.innerHTML = contentHtml;
        document.body.appendChild(modal);
        this.gameEndModal = modal;
    }

    closeGameEndModal() {
        if (this.gameEndModal) {
            this.gameEndModal.remove();
            this.gameEndModal = null;
        }
    }

    handleRestartFromEnd() {
        this.closeGameEndModal();
        // reload page or restart
        this.btnRestart && this.btnRestart.click();
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
                {
                    const hc = document.getElementById('hand-cards-container');
                    if (hc) hc.style.display = 'none';
                }
                break;
                
            case 'playing':
                this.btnStart.disabled = true;
                this.btnStart.textContent = '游戏进行中';
                this.gameStatusElement.textContent = '游戏进行中';
                if (this.game.purchasePhase) {
                    this.playerIndicatorElement.textContent = '🛒 卡牌购买阶段';
                    this.setRollControlsEnabled(false);
                } else if (state.currentPlayer) {
                    this.playerIndicatorElement.textContent = `当前玩家：${state.currentPlayer.name}`;
                    this.btnDice.style.background = state.currentPlayer.color;
                    this.btnDice.style.backgroundImage = 'none';
                    this.btnDice.textContent = `${state.currentPlayer.name}掷骰子`;

                    const canRoll = !state.currentPlayer.hasRolled && !this.isRollLocked && !(this.aiMode && state.currentPlayer.id !== this.playerIndex);
                    this.setRollControlsEnabled(canRoll);
                } else {
                    this.setRollControlsEnabled(false);
                }
                this.renderHandCards();
                break;
                
            case 'ended':
                this.btnStart.disabled = false;
                this.btnStart.textContent = '开始游戏';
                this.btnDice.disabled = true;
                {
                    const hc = document.getElementById('hand-cards-container');
                    if (hc) hc.style.display = 'none';
                }
                break;
        }
    }

    // ===== 卡牌系统 UI 方法 =====

    showPurchaseModal() {//显示卡牌购买弹窗
        // 非人机模式：为每个非AI玩家依次购买（本地多人）
        // 人机模式：仅人类玩家购买，AI已自动购买
        if (this.aiMode) {
            this.currentPurchasePlayerIndex = this.playerIndex;
            this.renderPurchaseModal(this.playerIndex);
        } else {
            this.currentPurchasePlayerIndex = 0;
            this.renderPurchaseModal(0);
        }
    }

    renderPurchaseModal(playerIndex) {//渲染购买弹窗
        if (this.purchaseModal) this.purchaseModal.remove();

        const player = this.game.players[playerIndex];
        if (!player) return;

        const allCards = cardSystem.getAllCards();
        const attackCards = allCards.filter(c => c.type === 'attack');
        const defenseCards = allCards.filter(c => c.type === 'defense');

        const renderCardItem = (card) => {
            const canAfford = player.points >= card.cost;
            return `
                <div class="purchase-card-item ${canAfford ? '' : 'disabled'}"
                     data-card-id="${card.id}"
                     data-player="${playerIndex}">
                    <div class="purchase-card-emoji">${card.emoji}</div>
                    <div class="purchase-card-name">${card.name}</div>
                    <div class="purchase-card-cost">${card.cost}点</div>
                </div>
            `;
        };

        const isLast = this.aiMode ? true : (playerIndex >= this.game.playerCount - 1);

        const modal = document.createElement('div');
        modal.className = 'selection-modal';
        modal.innerHTML = `
            <div class="modal-content purchase-modal-content">
                <div class="purchase-header">
                    <h3>🛒 卡牌购买阶段 - ${player.name}</h3>
                    <div class="purchase-points">💰 剩余点数：<span id="purchase-points-value">${player.points}</span></div>
                </div>
                <div class="purchase-desc-box" id="purchase-desc-box">
                    <div class="purchase-desc-emoji" id="purchase-desc-emoji">❓</div>
                    <div class="purchase-desc-text">
                        <div class="purchase-desc-title" id="purchase-desc-title">将鼠标移到卡牌上查看详情</div>
                        <div class="purchase-desc-body" id="purchase-desc-body">
                            点击卡牌列表中的卡牌可以购买，点击已购卡牌可以取消购买。
                        </div>
                    </div>
                </div>
                <div class="purchase-section">
                    <div class="purchase-section-label">⚔️ 攻击型卡牌</div>
                    <div class="purchase-cards-grid" id="purchase-grid-attack">
                        ${attackCards.map(renderCardItem).join('')}
                    </div>
                </div>
                <div class="purchase-section">
                    <div class="purchase-section-label">🛡️ 防御型卡牌</div>
                    <div class="purchase-cards-grid" id="purchase-grid-defense">
                        ${defenseCards.map(renderCardItem).join('')}
                    </div>
                </div>
                <div class="purchase-hand">
                    <div class="purchase-hand-label">🃏 已购卡牌（${player.cards.length}张）：</div>
                    <div class="purchase-hand-list" id="purchase-hand-list">
                        ${player.cards.map(c => `<span class="purchase-hand-card" data-instance-id="${c.instanceId}">${c.emoji}${c.name} <span class="purchase-hand-remove">✕</span></span>`).join('') || '<span class="purchase-hand-empty">暂无卡牌</span>'}
                    </div>
                </div>
                <div class="modal-action-bar">
                    <button class="btn-start-game" onclick="ui.finishPurchase(${playerIndex}, ${isLast})">${isLast ? '开始游戏' : '下一位玩家'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.purchaseModal = modal;

        // 绑定购买点击 + 悬停显示详情
        const bindCardInteractions = (container) => {
            container.querySelectorAll('.purchase-card-item').forEach(item => {
                const cardId = item.dataset.cardId;
                const pIdx = parseInt(item.dataset.player);
                const cardDef = cardSystem.getCardById(cardId);

                // 悬停/点击显示详情
                const showDesc = () => this.updatePurchaseDesc(cardDef);
                item.addEventListener('mouseenter', showDesc);
                item.addEventListener('click', (e) => {
                    const p = this.game.players[pIdx];
                    if (!p.purchaseCard) { /* guard */ }
                    if (this.game.purchaseCard(p, cardId)) {
                        this.showNotification(`${p.name} 购买了 ${cardDef.name}`, 'success');
                        this.refreshPurchaseModal(pIdx);
                    } else {
                        this.showNotification('点数不足', 'warning');
                    }
                    showDesc();
                });
            });
        };
        bindCardInteractions(modal.querySelector('#purchase-grid-attack'));
        bindCardInteractions(modal.querySelector('#purchase-grid-defense'));

        // 初始显示第一张攻击卡的详情
        this.updatePurchaseDesc(attackCards[0] || defenseCards[0]);
    }

    updatePurchaseDesc(cardDef) {//更新顶部卡牌详情文本框
        if (!this.purchaseModal || !cardDef) return;
        const emojiEl = this.purchaseModal.querySelector('#purchase-desc-emoji');
        const titleEl = this.purchaseModal.querySelector('#purchase-desc-title');
        const bodyEl = this.purchaseModal.querySelector('#purchase-desc-body');
        if (emojiEl) emojiEl.textContent = cardDef.emoji;
        if (titleEl) titleEl.textContent = `${cardDef.name}（${cardDef.cost}点）`;
        if (bodyEl) bodyEl.textContent = cardDef.description;
    }

    refreshPurchaseModal(playerIndex) {//刷新购买弹窗数据
        const player = this.game.players[playerIndex];
        if (!player || !this.purchaseModal) return;
        const pointsEl = this.purchaseModal.querySelector('#purchase-points-value');
        if (pointsEl) pointsEl.textContent = player.points;
        const handListEl = this.purchaseModal.querySelector('#purchase-hand-list');
        if (handListEl) {
            handListEl.innerHTML = player.cards.map(c => `<span class="purchase-hand-card" data-instance-id="${c.instanceId}">${c.emoji}${c.name} <span class="purchase-hand-remove">✕</span></span>`).join('') || '<span class="purchase-hand-empty">暂无卡牌</span>';
            // 绑定取消购买（退回）
            handListEl.querySelectorAll('.purchase-hand-card').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const instanceId = parseFloat(el.dataset.instanceId);
                    const refunded = player.refundCard(instanceId);
                    if (refunded) {
                        this.showNotification(`退回 ${refunded.name}，返还 ${cardSystem.getCardById(refunded.id).cost} 点`, 'info');
                        this.refreshPurchaseModal(playerIndex);
                    }
                });
            });
        }
        // 更新可购买状态
        this.purchaseModal.querySelectorAll('.purchase-card-item').forEach(item => {
            const card = cardSystem.getCardById(item.dataset.cardId);
            const canAfford = player.points >= card.cost;
            item.classList.toggle('disabled', !canAfford);
        });
        const handLabel = this.purchaseModal.querySelector('.purchase-hand-label');
        if (handLabel) handLabel.textContent = `🃏 已购卡牌（${player.cards.length}张）：`;
    }

    finishPurchase(playerIndex, isLast) {//完成当前玩家购买
        if (this.purchaseModal) {
            this.purchaseModal.remove();
            this.purchaseModal = null;
        }
        if (isLast) {
            // 所有玩家购买完成，进入游戏
            this.game.finishPurchasePhase();
            this.renderHandCards();
        } else {
            // 下一位玩家购买
            this.currentPurchasePlayerIndex = playerIndex + 1;
            this.renderPurchaseModal(this.currentPurchasePlayerIndex);
        }
    }

    renderHandCards() {//渲染人类玩家手牌
        const container = document.getElementById('hand-cards-container');
        const handEl = document.getElementById('hand-cards');
        if (!container || !handEl) return;

        // 仅显示人类玩家（AI模式）或当前玩家（非AI模式）的手牌
        const showPlayer = this.aiMode
            ? this.game.players[this.playerIndex]
            : this.game.getCurrentPlayer();

        if (!showPlayer || this.game.gameState !== 'playing' || this.game.purchasePhase) {
            container.style.display = 'none';
            return;
        }

        const cards = showPlayer.cards || [];
        if (cards.length === 0) {
            container.style.display = 'none';
            return;
        }

        // 仅在掷骰前可使用，且每回合限1张
        const canUse = !showPlayer.hasRolled && !this.game.purchasePhase && !showPlayer.hasUsedCardThisTurn;
        container.style.display = 'block';

        const usedHint = showPlayer.hasUsedCardThisTurn && !showPlayer.hasRolled
            ? '<span class="hand-cards-used-hint">（本回合已用1张）</span>' : '';

        const labelEl = container.querySelector('.hand-cards-label');
        if (labelEl) {
            labelEl.innerHTML = `🃏 手牌（掷骰前可使用，每回合限1张）${usedHint}`;
        }

        handEl.innerHTML = cards.map(card => `
            <div class="hand-card ${canUse ? '' : 'disabled'}"
                 data-instance-id="${card.instanceId}"
                 data-card-id="${card.id}"
                 title="${card.name}\n${card.description}">
                <span class="hand-card-emoji">${card.emoji}</span>
                <span class="hand-card-name">${card.name}</span>
            </div>
        `).join('');

        if (canUse) {
            handEl.querySelectorAll('.hand-card').forEach(el => {
                el.addEventListener('click', (e) => {
                    const instanceId = parseFloat(e.currentTarget.dataset.instanceId);
                    const cardId = e.currentTarget.dataset.cardId;
                    this.usePlayerCard(showPlayer, instanceId, cardId);
                });
            });
        }
    }

    usePlayerCard(player, instanceId, cardId) {//使用卡牌入口
        const card = cardSystem.getCardById(cardId);
        if (!card) return;

        if (card.targetType === 'self') {
            // 自身卡牌直接使用
            this.game.useCard(player, instanceId, null);
            this.onStateChange();
        } else if (card.targetType === 'enemy') {
            // 需要选择目标
            this.showCardTargetSelection(player, instanceId, card);
        }
    }

    showCardTargetSelection(player, instanceId, card) {//显示目标选择弹窗
        if (this.targetModal) this.targetModal.remove();

        const enemies = this.game.players.filter(p => !p.isDead && p.id !== player.id);

        const modal = document.createElement('div');
        modal.className = 'selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close-btn" onclick="ui.hideCardTargetSelection()" aria-label="关闭">×</button>
                <h3>选择目标 - ${card.emoji}${card.name}</h3>
                <div class="target-card-desc">${card.description}</div>
                <div class="target-list">
                    ${enemies.map(p => `
                        <div class="target-item" data-target-id="${p.id}" style="border-color:${p.color};">
                            <span class="target-color-dot" style="background:${p.color};"></span>
                            <span class="target-name">${p.name}</span>
                            <span class="target-info">📍${p.position} 🩸${p.health}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-action-bar">
                    <button class="btn-restart-cancel" onclick="ui.hideCardTargetSelection()">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.targetModal = modal;

        modal.querySelectorAll('.target-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetId = parseInt(e.currentTarget.dataset.targetId);
                this.hideCardTargetSelection();
                this.game.useCard(player, instanceId, targetId);
                this.onStateChange();
            });
        });
    }

    hideCardTargetSelection() {//关闭目标选择弹窗
        if (this.targetModal) {
            this.targetModal.remove();
            this.targetModal = null;
        }
    }
}

let ui = null;

document.addEventListener('DOMContentLoaded', () => {
    ui = new UI();
});