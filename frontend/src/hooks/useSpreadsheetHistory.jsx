import { useState, useCallback } from 'react';

const useSpreadsheetHistory = (initialData) => {
    const [history, setHistory] = useState([initialData]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const pushState = useCallback((newData) => {
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newData)));
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
    }, [history, currentIndex]);

    const undo = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            return JSON.parse(JSON.stringify(history[currentIndex - 1]));
        }
        return null;
    }, [history, currentIndex]);

    const redo = useCallback(() => {
        if (currentIndex < history.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return JSON.parse(JSON.stringify(history[currentIndex + 1]));
        }
        return null;
    }, [history, currentIndex]);

    return {
        pushState,
        undo,
        redo,
        canUndo: currentIndex > 0,
        canRedo: currentIndex < history.length - 1
    };
};

export default useSpreadsheetHistory; 