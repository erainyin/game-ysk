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
            }
        ];
    }

    checkAchievements(winner, game) {
        if (!winner) return [];
        const unlocked = [];
        for (const achievement of this.achievements) {
            try {
                if (achievement.condition(winner, game)) unlocked.push(achievement);
            } catch (e) {
                console.error('Achievement check error', achievement.id, e);
            }
        }
        return unlocked;
    }

    getAchievementById(id) {
        return this.achievements.find(a => a.id === id);
    }
}

const achievementSystem = new AchievementSystem();
