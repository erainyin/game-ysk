class Board {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.totalCells = rows * cols;
        this.cells = [];
        this.initializeCells();
    }

    initializeCells() {
        for (let i = 0; i < this.totalCells; i++) {
            const { row, col } = this.getPositionByNumber(i + 1);
            this.cells.push({
                number: i + 1,
                row: row,
                col: col,
                type: 'normal',
                effect: null
            });
        }
        this.cells[0].type = 'start';
        this.cells[this.totalCells - 1].type = 'end';
    }

    getPositionByNumber(cellNumber) {
        const index = cellNumber - 1;
        const row = Math.floor(index / this.cols);
        const isEvenRow = row % 2 === 0;
        
        let col;
        if (isEvenRow) {
            col = index % this.cols;
        } else {
            col = this.cols - 1 - (index % this.cols);
        }
        
        return { row, col };
    }

    getNumberByPosition(row, col) {
        const isEvenRow = row % 2 === 0;
        
        let index;
        if (isEvenRow) {
            index = row * this.cols + col;
        } else {
            index = row * this.cols + (this.cols - 1 - col);
        }
        
        return index + 1;
    }

    getCellByNumber(cellNumber) {
        if (cellNumber < 1 || cellNumber > this.totalCells) {
            return null;
        }
        return this.cells[cellNumber - 1];
    }

    isValidMove(from, steps) {
        const newPosition = from + steps;
        return newPosition >= 1 && newPosition <= this.totalCells;
    }

    getFinalPosition(startPosition, steps) {
        let finalPosition = startPosition + steps;
        if (finalPosition > this.totalCells) {
            finalPosition = this.totalCells;
        } else if (finalPosition < 1) {
            finalPosition = 1;
        }
        return finalPosition;
    }
}