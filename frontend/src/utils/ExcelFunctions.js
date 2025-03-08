class ExcelFunctions {
    constructor(data) {
        this.data = data;
    }

    // Convert column letter to index (A -> 0, B -> 1, etc.)
    columnToIndex(column) {
        return column.split('').reduce((acc, char) => 
            acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
        );
    }

    // Convert cell reference to row and column indices (A1 -> {row: 0, col: 0})
    getCellIndices(cellRef) {
        const match = cellRef.match(/([A-Z]+)(\d+)/);
        if (!match) return null;
        
        const col = this.columnToIndex(match[1]);
        const row = parseInt(match[2]) - 1;
        return { row, col };
    }

    // Get cell value from reference
    getCellValue(cellRef) {
        const indices = this.getCellIndices(cellRef);
        if (!indices) return 0;
        
        const value = this.data[indices.row]?.[indices.col];
        return !isNaN(parseFloat(value)) ? parseFloat(value) : 0;
    }

    // Get range of cells (e.g., A1:B3)
    getRange(rangeRef) {
        const [start, end] = rangeRef.split(':');
        const startIndices = this.getCellIndices(start);
        const endIndices = this.getCellIndices(end);
        
        if (!startIndices || !endIndices) return [];

        const values = [];
        for (let row = startIndices.row; row <= endIndices.row; row++) {
            for (let col = startIndices.col; col <= endIndices.col; col++) {
                const value = this.data[row]?.[col];
                if (!isNaN(parseFloat(value))) {
                    values.push(parseFloat(value));
                }
            }
        }
        return values;
    }

    // Basic Arithmetic Functions
    add(args) {
        return args.reduce((sum, arg) => sum + this.evaluateArg(arg), 0);
    }

    subtract(args) {
        const first = this.evaluateArg(args[0]);
        return args.slice(1).reduce((diff, arg) => diff - this.evaluateArg(arg), first);
    }

    multiply(args) {
        return args.reduce((product, arg) => product * this.evaluateArg(arg), 1);
    }

    divide(args) {
        const first = this.evaluateArg(args[0]);
        return args.slice(1).reduce((quotient, arg) => {
            const divisor = this.evaluateArg(arg);
            if (divisor === 0) throw new Error('#DIV/0!');
            return quotient / divisor;
        }, first);
    }

    // Statistical Functions
    sum(args) {
        return this.flattenArgs(args).reduce((sum, value) => sum + value, 0);
    }

    average(args) {
        const values = this.flattenArgs(args);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }

    max(args) {
        const values = this.flattenArgs(args);
        return values.length ? Math.max(...values) : 0;
    }

    min(args) {
        const values = this.flattenArgs(args);
        return values.length ? Math.min(...values) : 0;
    }

    count(args) {
        return this.flattenArgs(args).length;
    }

    counta(args) {
        return this.flattenArgs(args, true).length;
    }

    // Logical Functions
    if(args) {
        const condition = this.evaluateArg(args[0]);
        return condition ? this.evaluateArg(args[1]) : this.evaluateArg(args[2]);
    }

    and(args) {
        return args.every(arg => this.evaluateArg(arg));
    }

    or(args) {
        return args.some(arg => this.evaluateArg(arg));
    }

    not(args) {
        return !this.evaluateArg(args[0]);
    }

    // Text Functions
    concatenate(args) {
        return args.map(arg => this.evaluateArg(arg).toString()).join('');
    }

    left(args) {
        const text = this.evaluateArg(args[0]).toString();
        const chars = this.evaluateArg(args[1]);
        return text.substring(0, chars);
    }

    right(args) {
        const text = this.evaluateArg(args[0]).toString();
        const chars = this.evaluateArg(args[1]);
        return text.substring(text.length - chars);
    }

    mid(args) {
        const text = this.evaluateArg(args[0]).toString();
        const start = this.evaluateArg(args[1]) - 1;
        const chars = this.evaluateArg(args[2]);
        return text.substring(start, start + chars);
    }

    len(args) {
        return this.evaluateArg(args[0]).toString().length;
    }

    // Helper Functions
    evaluateArg(arg) {
        if (typeof arg === 'number') return arg;
        if (typeof arg === 'string') {
            if (arg.includes(':')) {
                // Handle range reference (e.g., A1:B3)
                return this.sum([arg]);
            } else if (/^[A-Z]+\d+$/.test(arg)) {
                // Handle cell reference (e.g., A1)
                return this.getCellValue(arg);
            }
        }
        return arg;
    }

    flattenArgs(args, countNonNumeric = false) {
        const values = [];
        for (const arg of args) {
            if (typeof arg === 'string' && arg.includes(':')) {
                values.push(...this.getRange(arg));
            } else if (typeof arg === 'string' && /^[A-Z]+\d+$/.test(arg)) {
                const value = this.getCellValue(arg);
                if (!isNaN(value) || countNonNumeric) {
                    values.push(value);
                }
            } else if (!isNaN(arg) || countNonNumeric) {
                values.push(parseFloat(arg));
            }
        }
        return values;
    }

    // Formula Parser
    parseFormula(formula) {
        if (!formula.startsWith('=')) return formula;

        try {
            formula = formula.substring(1); // Remove the '=' sign
            return this.evaluateFormula(formula);
        } catch (error) {
            return '#ERROR!';
        }
    }

    evaluateFormula(formula) {
        // Handle basic arithmetic
        if (/^[A-Z0-9+\-*/() .]+$/.test(formula)) {
            return this.evaluateArithmetic(formula);
        }

        // Handle functions
        const functionMatch = formula.match(/^([A-Z]+)\((.*)\)$/);
        if (functionMatch) {
            const [, functionName, argsString] = functionMatch;
            const args = this.parseArgs(argsString);
            
            switch (functionName.toLowerCase()) {
                case 'sum': return this.sum(args);
                case 'average': return this.average(args);
                case 'max': return this.max(args);
                case 'min': return this.min(args);
                case 'count': return this.count(args);
                case 'counta': return this.counta(args);
                case 'if': return this.if(args);
                case 'and': return this.and(args);
                case 'or': return this.or(args);
                case 'not': return this.not(args);
                case 'concatenate': return this.concatenate(args);
                case 'left': return this.left(args);
                case 'right': return this.right(args);
                case 'mid': return this.mid(args);
                case 'len': return this.len(args);
                default: return '#NAME?';
            }
        }

        return '#ERROR!';
    }

    evaluateArithmetic(formula) {
        // Replace cell references with their values
        formula = formula.replace(/[A-Z]+\d+/g, match => this.getCellValue(match));
        
        // Safely evaluate the arithmetic expression
        try {
            return Function(`'use strict'; return (${formula})`)();
        } catch (error) {
            return '#ERROR!';
        }
    }

    parseArgs(argsString) {
        const args = [];
        let current = '';
        let depth = 0;
        
        for (const char of argsString) {
            if (char === '(' || char === '[' || char === '{') {
                depth++;
                current += char;
            } else if (char === ')' || char === ']' || char === '}') {
                depth--;
                current += char;
            } else if (char === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current) {
            args.push(current.trim());
        }
        
        return args;
    }
}

export default ExcelFunctions; 