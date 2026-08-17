class AchievementSystem {
    constructor() {
        this.storageKey = 'ysk_achievement_unlocks_v1';
        this.playCountKey = 'ysk_play_count_v1';
        this.achievements = this.loadAchievements();
        this.unlockedIds = this.loadUnlockedIds();
        this.playCount = this.loadPlayCount();
    }

    loadPlayCount() {
        try {
            const raw = localStorage.getItem(this.playCountKey);
            if (raw === null) return 0;
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : 0;
        } catch (e) {
            return 0;
        }
    }

    savePlayCount() {
        try {
            localStorage.setItem(this.playCountKey, String(this.playCount));
        } catch (e) {
            console.warn('Play count storage failed', e);
        }
    }

    recordPlay() {
        this.playCount += 1;
        this.savePlayCount();
    }

    getPlayCount() {
        return this.playCount;
    }

    loadUnlockedIds() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            return new Set(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
            return new Set();
        }
    }

    saveUnlockedIds() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify([...this.unlockedIds]));
        } catch (e) {
            console.warn('Achievement storage failed', e);
        }
    }

    isUnlocked(id) {
        return this.unlockedIds.has(id);
    }

    unlock(ids) {
        if (!Array.isArray(ids)) return;
        let changed = false;
        ids.forEach(id => {
            if (!this.unlockedIds.has(id)) {
                this.unlockedIds.add(id);
                changed = true;
            }
        });
        if (changed) this.saveUnlockedIds();
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
                    try {
                        return !!winner && winner.position === 1 && winner.stats.totalRolls === 0 && winner.stats.totalMoves === 0;
                    } catch (e) { return false; }
                }
            },
            {
                id: 'speed_run',
                name: '极速通关',
                description: '在3回合内到达终点获胜',
                icon: '⚡',
                type: 'win',
                condition: (winner, game) => {
                    try {
                        return !!winner && winner.position >= game.board.totalCells && game.roundCount <= 3;
                    } catch (e) { return false; }
                }
            },
            {
                id: 'narrow_escape',
                name: '九死一生',
                description: '血量曾降至1，最终获胜',
                icon: '💀',
                type: 'win',
                condition: (winner, game) => {
                    try { return !!winner && winner.stats.minimumHealth === 1; } catch (e) { return false; }
                }
            },
            {
                id: 'undie_legend',
                name: '不死传说',
                description: '全程未受到任何伤害获胜',
                icon: '🛡️',
                type: 'win',
                condition: (winner, game) => {
                    try { return !!winner && winner.stats.damageTaken === 0; } catch (e) { return false; }
                }
            },
            {
                id: 'ghost_killer',
                name: '幽灵杀手',
                description: '消灭3个敌方幽灵',
                icon: '👻',
                type: 'action',
                condition: (winner, game) => {
                    try { return !!winner && winner.stats.ghostKills >= 3; } catch (e) { return false; }
                }
            },
            {
                id: 'bomb_expert',
                name: '炸弹专家',
                description: '使用炸弹炸死至少2名玩家',
                icon: '💣',
                type: 'action',
                condition: (winner, game) => {
                    try { return !!winner && winner.stats.bombKills >= 2; } catch (e) { return false; }
                }
            },
            {
                id: 'blackhole_walker',
                name: '黑洞行者',
                description: '经历至少3次黑洞传送后获胜',
                icon: '🕳️',
                type: 'action',
                condition: (winner, game) => {
                    try { return !!winner && winner.stats.blackholeCount >= 3; } catch (e) { return false; }
                }
            },
            {
                id: 'health_king',
                name: '血量之王',
                description: '最终血量达到200以上',
                icon: '❤️',
                type: 'milestone',
                condition: (winner, game) => {
                    try { return !!winner && winner.health >= 200; } catch (e) { return false; }
                }
            },
            {
                id: 'long_march',
                name: '长征',
                description: '超过20回合并最终获胜',
                icon: '🚶',
                type: 'milestone',
                condition: (winner, game) => {
                    try { return !!winner && game.roundCount > 20; } catch (e) { return false; }
                }
            },
            {
                id: 'dragon_wanderer',
                name: '龙行万里',
                description: '使用"龙"皮肤，本局使用斜行功能超过2次并最终获胜',
                icon: '🐉',
                type: 'action',
                condition: (winner, game) => {
                    try {
                        if (!winner) return false;
                        const isDragonSkin = winner.skin && winner.skin.id === 'dragon';
                        return isDragonSkin && winner.stats.dragonDiagonalUses > 2;
                    } catch (e) { return false; }
                }
            },
            {
                id: 'immovable',
                name: '不动如山',
                description: '全程未超车任何玩家并最终获胜（其他玩家均已死亡）',
                icon: '⛰️',
                type: 'win',
                condition: (winner, game) => {
                    try {
                        if (!winner) return false;
                        return winner.stats.overtakeCount === 0;
                    } catch (e) { return false; }
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
            } catch (e) {
                console.error('Achievement check error', achievement.id, e);
            }
        }
        if (unlocked.length > 0) {
            this.unlock(unlocked.map(a => a.id));
        }
        return unlocked;
    }

    getAchievementById(id) {
        return this.achievements.find(a => a.id === id);
    }
}

const achievementSystem = new AchievementSystem();
