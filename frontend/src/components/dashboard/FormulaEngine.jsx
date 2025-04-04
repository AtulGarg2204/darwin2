import excelFunctions from "../../utils/ExcelFunctions";

const FormulaEngine = {
  // Get cell value from a reference like 'A1'
  getCellValue: (cellRef, data) => {
    try {
      const col = cellRef.match(/[A-Z]+/)[0];
      const row = parseInt(cellRef.match(/[0-9]+/)[0]) - 1;
      const colIndex = col.split('').reduce((acc, char) => 
        acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
      );
      const value = data[row]?.[colIndex];
      return parseFloat(value) || 0;
    } catch (error) {
      return 0;
    }
  },

  // Function to get range of cells (e.g., A1:A2)
  getCellRange: (start, end, data) => {
    try {
      const startCol = start.match(/[A-Z]+/)[0];
      const startRow = parseInt(start.match(/[0-9]+/)[0]) - 1;
      const endCol = end.match(/[A-Z]+/)[0];
      const endRow = parseInt(end.match(/[0-9]+/)[0]) - 1;

      const startColIndex = startCol.split('').reduce((acc, char) => 
        acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
      );
      const endColIndex = endCol.split('').reduce((acc, char) => 
        acc * 26 + char.charCodeAt(0) - 'A'.charCodeAt(0), 0
      );

      const values = [];
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startColIndex; col <= endColIndex; col++) {
          const value = parseFloat(data[row]?.[col]) || 0;
          values.push(value);
        }
      }
      return values;
    } catch (error) {
      return [];
    }
  },

  // Helper function to apply operators
  applyOperator: (a, b, operator) => {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : NaN;
      default: return NaN;
    }
  },

  // Helper function for safe mathematical expression evaluation
  evaluateMathExpression: (expression) => {
    try {
      // Remove all spaces and convert to lowercase
      expression = expression.replace(/\s+/g, '').toLowerCase();
      
      // Split the expression into tokens
      const tokens = expression.match(/(\d*\.?\d+|[+\-*/()])/g) || [];
      
      // Stack for numbers and operators
      const numbers = [];
      const operators = [];
      
      // Operator precedence
      const precedence = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2
      };
      
      // Process each token
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (!isNaN(token) || token.includes('.')) {
          // If it's a number, push to numbers stack
          numbers.push(parseFloat(token));
        } else if (token === '(') {
          // If it's an opening parenthesis, push to operators stack
          operators.push(token);
        } else if (token === ')') {
          // If it's a closing parenthesis, process until we find matching opening parenthesis
          while (operators.length > 0 && operators[operators.length - 1] !== '(') {
            const operator = operators.pop();
            const b = numbers.pop();
            const a = numbers.pop();
            numbers.push(FormulaEngine.applyOperator(a, b, operator));
          }
          operators.pop(); // Remove the opening parenthesis
        } else if (['+', '-', '*', '/'].includes(token)) {
          // If it's an operator, process higher precedence operators first
          while (operators.length > 0 && 
                 operators[operators.length - 1] !== '(' && 
                 precedence[operators[operators.length - 1]] >= precedence[token]) {
            const operator = operators.pop();
            const b = numbers.pop();
            const a = numbers.pop();
            numbers.push(FormulaEngine.applyOperator(a, b, operator));
          }
          operators.push(token);
        }
      }
      
      // Process remaining operators
      while (operators.length > 0) {
        const operator = operators.pop();
        const b = numbers.pop();
        const a = numbers.pop();
        numbers.push(FormulaEngine.applyOperator(a, b, operator));
      }
      
      return numbers[0];
    } catch (error) {
      console.error('Math expression evaluation error:', error);
      return NaN;
    }
  },

  // Main formula evaluation function
  evaluateFormula: (formula, data) => {
    if (!formula.startsWith('=')) return formula;

    try {
      // Check for Excel functions
      const functionMatch = formula.match(/^=([A-Z]+)\((.*)\)$/);
      if (functionMatch) {
        const [_, functionName, params] = functionMatch;
        const fn = excelFunctions[functionName];
        if (!fn) return '#NAME?';
        console.log(_);
        // Check for range notation (e.g., A1:A2)
        const rangeMatch = params.match(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/);
        if (rangeMatch) {
          const [_, start, end] = rangeMatch;
          console.log(_)
          const values = FormulaEngine.getCellRange(start, end, data);
          return fn(values).toString();
        }

        // Handle comma-separated values
        const values = params.split(',').map(param => {
          const cellRef = param.trim().match(/[A-Z]+[0-9]+/);
          return cellRef ? FormulaEngine.getCellValue(cellRef[0], data) : parseFloat(param.trim());
        });
        return fn(values).toString();
      }

      // Handle basic arithmetic
      let expression = formula.substring(1);
      expression = expression.replace(/[A-Z]+[0-9]+/g, (cellRef) => {
        return FormulaEngine.getCellValue(cellRef, data);
      });
      
      // Evaluate the expression safely
      const result = FormulaEngine.evaluateMathExpression(expression);
      return isNaN(result) ? '#ERROR!' : result.toString();
    } catch (error) {
      console.error('Formula evaluation error:', error);
      return '#ERROR!';
    }
  }
};

export default FormulaEngine;