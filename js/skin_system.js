class SkinSystem {
    constructor() {
        this.skins = this.loadSkins();
        this.iconPath = 'assets/skins/';
    }
    
    loadSkins() {
        return [
            {
                id: 'default',
                name: '默认',
                description: '无特殊效果，以初始状态开始游戏',
                icon: 'default.png',
                color: '#95a5a6',
                effects: []
            },
            {
                id: 'tank',
                name: '坦克',
                description: '每次移动后，前后2格范围内的其他玩家血量-1',
                icon: 'tank.png',
                color: '#7f8c8d',
                effects: [
                    { type: 'area_damage', params: { range: 2 } }
                ]
            },
            {
                id: 'thief',
                name: '飞贼',
                description: '前3回合移动速度翻倍，第4回合起恢复正常',
                icon: 'thief.png',
                color: '#9b59b6',
                effects: [
                    { type: 'speed_boost', params: { duration: 3 } }
                ]
            },
            {
                id: 'warrior',
                name: '勇者',
                description: '初始血量+3',
                icon: 'warrior.png',
                color: '#e74c3c',
                effects: [
                    { type: 'extra_health', params: { amount: 3 } }
                ]
            },
            {
                id: 'double_defence',
                name: '两次防',
                description: '全局可防御2次对手卡牌的负面效果（如火球术、减速等攻击型卡牌），自动抵消',
                icon: 'double_defence.png',
                color: '#2980b9',
                effects: [
                    { type: 'double_defence', params: { charges: 2 } }
                ]
            },
            {
                id: 'dragon',
                name: '龙',
                description: '全局可斜着走1次：每回合掷骰前可选择移动到对角格子，或正常掷骰。用过后只能掷骰',
                icon: 'dragon.png',
                color: '#27ae60',
                effects: [
                    { type: 'dragon_diagonal', params: { charges: 1 } }
                ]
            },
            {
                id: 'chaos',
                name: '颠倒师',
                description: '从第2回合开始，走子后随机打乱周围8格属性（2回合冷却），每局最多3次。皮肤神殿可重置次数',
                icon: 'chaos.png',
                color: '#e91e63',
                effects: [
                    { type: 'chaos_shuffle', params: { maxShuffles: 3, cooldown: 2, startTurn: 2 } }
                ]
            },
            {
                id: 'super_warrior',
                name: '超级勇者',
                description: '走到加血格子时，加血量乘2倍；走到减血格子时，减血量也乘2倍。无回合限制',
                icon: 'super_warrior.png',
                color: '#c0392b',
                effects: [
                    { type: 'blood_amplify', params: { multiplier: 2 } }
                ]
            },
            {
                id: 'guardian',
                name: '守护者',
                description: '贴身幽灵最大持有数量+1，并且初始就拥有1个贴身幽灵',
                icon: 'guardian.png',
                color: '#16a085',
                effects: [
                    { type: 'guardian_ghost', params: { extraMax: 1, initialGhost: true } }
                ]
            }
        ];
    }
    
    getSkinById(id) {
        return this.skins.find(skin => skin.id === id);
    }
    
    getAllSkins() {
        return this.skins;
    }
    
    getIconPath(skinId) {
        const skin = this.getSkinById(skinId);
        if (!skin) return '';
        return this.iconPath + skin.icon;
    }
}

const skinSystem = new SkinSystem();