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
import * as XLSX from 'xlsx';

function App() {
  const [currentData, setCurrentData] = useState([
    ['', '', '', ''],
    ['', '', '', ''],
    ['', '', '', '']
  ]);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  
  // Add view settings state
  const [showHeaders, setShowHeaders] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  const { pushState, undo, redo, canUndo, canRedo } = useSpreadsheetHistory(currentData);

  const handleDataChange = (newData) => {
    setCurrentData(newData);
    pushState(newData);
  };

  const handleNewFile = () => {
    // Create a new grid with MIN_VISIBLE_ROWS rows and MIN_VISIBLE_COLS columns
    const newData = Array(50).fill().map(() => Array(10).fill(''));
    handleDataChange(newData);
  };

  const handleDataLoad = (file) => {
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split('\n').map(row => row.split(','));
        setCurrentData(rows);
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        setCurrentData(jsonData);
      };
      reader.readAsBinaryString(file);
    }
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

  const handleFormatChange = (type, value) => {
    // Pass the formatting function to Dashboard
    if (dashboardRef.current) {
      dashboardRef.current.handleFormatChange(type, value);
    }
  };

  const dashboardRef = useRef(null);

  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col h-screen">
          <Navbar 
            currentData={currentData}
            setCurrentData={setCurrentData}
            activeCell={activeCell}
            undoHistory={handleUndo}
            redoHistory={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onNewFile={handleNewFile}
            onDataLoad={handleDataLoad}
            // Add view props
            showHeaders={showHeaders}
            setShowHeaders={setShowHeaders}
            showGridLines={showGridLines}
            setShowGridLines={setShowGridLines}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            onFormatChange={handleFormatChange}
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
                      // Add view props
                      showHeaders={showHeaders}
                      showGridLines={showGridLines}
                      zoomLevel={zoomLevel}
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
