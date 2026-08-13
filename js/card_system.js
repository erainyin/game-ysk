// 卡牌（道具）系统
// 详见 Plan-CardSys.md
class CardSystem {
    constructor() {
        this.cards = this.loadCards();
        this.iconPath = 'assets/cards/';
    }

    loadCards() {
        return [
            // ===== 攻击型卡牌 =====
            {
                id: 'fireball',
                name: '火球术',
                description: '对指定玩家造成 2 点伤害',
                icon: 'fireball.png',
                emoji: '🔥',
                type: 'attack',
                cost: 2,
                targetType: 'enemy',
                effects: [{ type: 'damage', params: { amount: 2 } }]
            },
            {
                id: 'slow_curse',
                name: '减速诅咒',
                description: '指定玩家下回合掷骰数减半（向下取整）',
                icon: 'slow_curse.png',
                emoji: '🐌',
                type: 'attack',
                cost: 2,
                targetType: 'enemy',
                effects: [{ type: 'slow_target', params: {}, duration: 1 }]
            },
            {
                id: 'swap',
                name: '交换位置',
                description: '与指定玩家交换当前位置',
                icon: 'swap.png',
                emoji: '🔄',
                type: 'attack',
                cost: 4,
                targetType: 'enemy',
                effects: [{ type: 'swap_position', params: {} }]
            },
            {
                id: 'life_drain',
                name: '偷取生命',
                description: '从指定玩家偷取 2 点血量，转化为自身血量',
                icon: 'life_drain.png',
                emoji: '🧛',
                type: 'attack',
                cost: 4,
                targetType: 'enemy',
                effects: [{ type: 'steal_health', params: { amount: 2 } }]
            },
            {
                id: 'push_back',
                name: '推后',
                description: '将指定玩家向后推 3 步',
                icon: 'push_back.png',
                emoji: '⬅️',
                type: 'attack',
                cost: 2,
                targetType: 'enemy',
                effects: [{ type: 'move_target', params: { steps: -3 } }]
            },
            {
                id: 'bomb_card',
                name: '炸弹',
                description: '在目标位置放置炸弹，前后2格内所有玩家各受2点伤害',
                icon: 'bomb_card.png',
                emoji: '💣',
                type: 'attack',
                cost: 4,
                targetType: 'enemy',
                effects: [{ type: 'place_bomb', params: { range: 2, damage: 2 } }]
            },
            // ===== 防御型卡牌 =====
            {
                id: 'shield',
                name: '护盾',
                description: '持有期间，自动抵挡下一次受到的攻击伤害（火球、炸弹、坦克光环等），自动消耗',
                icon: 'shield.png',
                emoji: '🛡️',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                auto: true,  // 自动触发型卡牌，无需主动使用
                effects: []  // 效果由 game.js 的 tryAutoShield 在伤害入口拦截实现
            },
            {
                id: 'heal',
                name: '治疗',
                description: '恢复 3 点血量',
                icon: 'heal.png',
                emoji: '💚',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                effects: [{ type: 'heal', params: { amount: 3 } }]
            },
            {
                id: 'blink',
                name: '闪现',
                description: '不掷骰子，直接前进 4 步（使用后本回合仍可掷骰子）',
                icon: 'blink.png',
                emoji: '⚡',
                type: 'defense',
                cost: 3,
                targetType: 'self',
                effects: [{ type: 'move_self', params: { steps: 4 } }]
            },
            {
                id: 'undying',
                name: '不死之身',
                description: '3 回合内下次死亡时存活并恢复 1 点血量',
                icon: 'undying.png',
                emoji: '💀',
                type: 'defense',
                cost: 4,
                targetType: 'self',
                effects: [{ type: 'undying', params: { amount: 1 }, duration: 3 }]
            },
            {
                id: 'reflect',
                name: '反弹',
                description: '3 回合内下次受到攻击伤害时，将伤害反弹给攻击者',
                icon: 'reflect.png',
                emoji: '🔁',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                effects: [{ type: 'reflect', params: {}, duration: 3 }]
            },
            {
                id: 'purify',
                name: '净化',
                description: '持有期间，自动清除获得的负面状态（减速诅咒等），自动消耗',
                icon: 'purify.png',
                emoji: '✨',
                type: 'defense',
                cost: 2,
                targetType: 'self',
                auto: true,  // 自动触发型卡牌，无需主动使用
                effects: []  // 效果由 game.js 在负面状态施加入口拦截实现
            }
        ];
    }

    getCardById(id) {
        return this.cards.find(card => card.id === id);
    }

    getAllCards() {
        return this.cards;
    }

    getCardsByType(type) {
        return this.cards.filter(card => card.type === type);
    }

    getIconPath(cardId) {
        const card = this.getCardById(cardId);
        if (!card) return '';
        return this.iconPath + card.icon;
    }

    // 返回卡片图标的 HTML：有图片则用 <img>，加载失败自动回退到 emoji
    getIconHtml(card, className = 'card-icon-img') {
        if (!card) return '';
        if (card.icon) {
            return `<img src="${this.iconPath}${card.icon}" class="${className}" alt="${card.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span class="card-icon-fallback" style="display:none;">${card.emoji}</span>`;
        }
        return card.emoji;
    }
}

const cardSystem = new CardSystem();
