const excelFunctions = {
    // Mathematical Functions
    SUM: (values) => values.reduce((acc, val) => acc + (parseFloat(val) || 0), 0),
    AVERAGE: (values) => {
        const nums = values.filter(v => !isNaN(parseFloat(v)));
        return nums.length ? excelFunctions.SUM(nums) / nums.length : 0;
    },
    MAX: (values) => Math.max(...values.map(v => parseFloat(v) || -Infinity)),
    MIN: (values) => Math.min(...values.map(v => parseFloat(v) || Infinity)),
    COUNT: (values) => values.filter(v => !isNaN(parseFloat(v))).length,
    
    // Text Functions
    CONCATENATE: (values) => values.join(''),
    UPPER: (value) => String(value).toUpperCase(),
    LOWER: (value) => String(value).toLowerCase(),
    LEN: (value) => String(value).length,
    
    // Logical Functions
    IF: (condition, trueValue, falseValue) => condition ? trueValue : falseValue,
    AND: (values) => values.every(Boolean),
    OR: (values) => values.some(Boolean),
    
    // Reference Functions
    VLOOKUP: (lookupValue, tableArray, colIndex) => {
        const row = tableArray.find(row => row[0] === lookupValue);
        return row ? row[colIndex - 1] : '#N/A';
    }
};

export default excelFunctions; 