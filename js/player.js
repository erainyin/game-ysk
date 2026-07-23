class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.position = 1;
        this.isWinner = false;
        this.hasRolled = false;
        this.health = 3;
        this.isDead = false;
        this.enteredOvertakeZone = false;
        this.pauseTurns = 0;
        this.undieTurns = 0;
        this.justGotUndie = false;
        this.hasGhost = false;
        this.ghostType = 0;
        this.ghostHealth = 0;
        this.ghostPosition = 1;
        this.ghostCount = 0;
        this.maxGhostCount = 3;
        this.skin = null;
        this.speedBoostRemainingTurns = 0;
    }

    reset() {
        this.position = 1;
        this.isWinner = false;
        this.hasRolled = false;
        this.health = 3;
        this.isDead = false;
        this.enteredOvertakeZone = false;
        this.pauseTurns = 0;
        this.undieTurns = 0;
        this.justGotUndie = false;
        this.hasGhost = false;
        this.ghostType = 0;
        this.ghostHealth = 0;
        this.ghostPosition = 1;
        this.ghostCount = 0;
        this.skin = null;
        this.speedBoostRemainingTurns = 0;
    }

    setSkin(skin) {
        if (skin && skin.id === 'default') {
            this.skin = null;
            return;
        }

        this.skin = skin;

        if (skin) {
            skin.effects.forEach(effect => {
                switch (effect.type) {
                    case 'extra_health':
                        this.health += effect.params.amount;
                        break;
                    case 'speed_boost':
                        this.speedBoostRemainingTurns = effect.params.duration;
                        break;
                }
            });
        }
    }

    moveTo(position) {
        this.position = position;
        if (this.hasGhost && this.ghostType === 2) {
            this.ghostPosition = position;
        }
    }

    ghostMoveTo(position) {
        this.ghostPosition = position;
    }

    rollDice() {
        this.hasRolled = true;
    }

    resetRoll() {
        this.hasRolled = false;
    }

    win() {
        this.isWinner = true;
    }

    changeHealth(delta) {
        this.health += delta;
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
        }
    }

    setHealth(value) {
        this.health = value;
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
        }
    }

    changeGhostHealth(delta) {
        this.ghostHealth += delta;
        if (this.ghostHealth > this.maxGhostCount) {
            this.ghostHealth = this.maxGhostCount;
        }
        if (this.ghostHealth <= 0) {
            this.ghostHealth = 0;
            this.hasGhost = false;
            this.ghostType = 0;
            this.ghostPosition = 1;
        }
    }
}