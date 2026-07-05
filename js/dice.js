class Dice {
    constructor() {
        this.value = 0;
        this.isRolling = false;
        this.onRollComplete = null;
    }

    roll(callback) {
        if (this.isRolling) return;
        
        this.isRolling = true;
        this.onRollComplete = callback;
        
        let rollCount = 0;
        const maxRolls = 12;
        const rollInterval = 50;
        
        const rollAnimation = () => {
            this.value = Math.floor(Math.random() * 6) + 1;
            
            if (rollCount < maxRolls) {
                rollCount++;
                setTimeout(rollAnimation, rollInterval);
            } else {
                this.isRolling = false;
                if (this.onRollComplete) {
                    this.onRollComplete(this.value);
                    this.onRollComplete = null;
                }
            }
        };
        
        rollAnimation();
    }

    getValue() {
        return this.value;
    }

    isRollingNow() {
        return this.isRolling;
    }
}