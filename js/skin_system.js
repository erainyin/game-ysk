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