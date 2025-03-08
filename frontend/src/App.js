import { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import HomePage from './components/home/HomePage';
import PrivateRoute from './components/layout/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import useSpreadsheetHistory from './hooks/useSpreadsheetHistory';
import './App.css';

function App() {
  const [currentData, setCurrentData] = useState([
    ['', '', '', ''],
    ['', '', '', ''],
    ['', '', '', '']
  ]);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const { pushState, undo, redo, canUndo, canRedo } = useSpreadsheetHistory(currentData);

  const handleDataChange = (newData) => {
    setCurrentData(newData);
    pushState(newData);
  };

  const handleNewFile = () => {
    const newData = [
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', '']
    ];
    handleDataChange(newData);
  };

  const handleDataLoad = (data) => {
    if (!data || !data.length) {
      data = [['']];
    }
    handleDataChange(data);
  };

  const handleUndo = () => {
    const previousState = undo();
    if (previousState) {
      setCurrentData(previousState);
    }
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState) {
      setCurrentData(nextState);
    }
  };

  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col h-screen">
          <Navbar 
            currentData={currentData}
            setCurrentData={handleDataChange}
            activeCell={activeCell}
            undoHistory={handleUndo}
            redoHistory={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onNewFile={handleNewFile}
            onDataLoad={handleDataLoad}
          />
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<HomePage />} />
              <Route 
                path="/dashboard" 
                element={
                  <PrivateRoute>
                    <Dashboard 
                      currentData={currentData}
                      setCurrentData={handleDataChange}
                      activeCell={activeCell}
                      setActiveCell={setActiveCell}
                    />
                  </PrivateRoute>
                } 
              />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
