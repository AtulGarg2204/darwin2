import { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import HomePage from './components/home/HomePage';
import PrivateRoute from './components/layout/PrivateRoute';
import { AuthProvider } from './context/AuthContext';
import './App.css';

function App() {
  const [currentData, setCurrentData] = useState([
    ['', '', '', ''],
    ['', '', '', ''],
    ['', '', '', '']
  ]);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const dashboardRef = useRef();

  const handleNewFile = () => {
    setCurrentData([
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', '']
    ]);
  };

  const handleDataLoad = (data) => {
    if (!data || !data.length) {
      data = [['']];
    }
    setCurrentData(data);
  };

  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col h-screen">
          <Navbar 
            currentData={currentData}
            onNewFile={handleNewFile}
            onDataLoad={handleDataLoad}
            activeCell={activeCell}
            undoHistory={() => dashboardRef.current?.undo()}
            redoHistory={() => dashboardRef.current?.redo()}
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
                      ref={dashboardRef}
                      currentData={currentData} 
                      setCurrentData={setCurrentData}
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
