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
    }

    reset() {
        this.position = 1;
        this.isWinner = false;
        this.hasRolled = false;
        this.health = 3;
        this.isDead = false;
        this.enteredOvertakeZone = false;
    }

    moveTo(position) {
        this.position = position;
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
}