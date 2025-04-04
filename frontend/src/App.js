// import { useState, useRef } from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import Navbar from './components/layout/Navbar';
// import Login from './components/auth/Login';
// import Register from './components/auth/Register';
// import Dashboard from './components/dashboard/Dashboard';
// import HomePage from './components/home/HomePage';
// import PrivateRoute from './components/layout/PrivateRoute';
// import { AuthProvider } from './context/AuthContext';
// import useSpreadsheetHistory from './hooks/useSpreadsheetHistory';
// import './App.css';
// import * as XLSX from 'xlsx';

// function App() {
//   const [currentData, setCurrentData] = useState([
//     ['', '', '', ''],
//     ['', '', '', ''],
//     ['', '', '', '']
//   ]);
//   const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  
//   // Add view settings state
//   const [showHeaders, setShowHeaders] = useState(true);
//   const [showGridLines, setShowGridLines] = useState(true);
//   const [zoomLevel, setZoomLevel] = useState(100);

//   const { pushState, undo, redo, canUndo, canRedo } = useSpreadsheetHistory(currentData);

//   const handleDataChange = (newData) => {
//     setCurrentData(newData);
//     pushState(newData);
//   };

//   const handleNewFile = () => {
//     // Create a new grid with MIN_VISIBLE_ROWS rows and MIN_VISIBLE_COLS columns
//     const newData = Array(50).fill().map(() => Array(10).fill(''));
//     handleDataChange(newData);
//   };

//   const handleDataLoad = (file) => {
//     if (!file) return;

//     if (file.name.endsWith('.csv')) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const text = e.target.result;
//         const rows = text.split('\n').map(row => row.split(','));
//         setCurrentData(rows);
//       };
//       reader.readAsText(file);
//     } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = e.target.result;
//         const workbook = XLSX.read(data, { type: 'binary' });
//         const sheetName = workbook.SheetNames[0];
//         const worksheet = workbook.Sheets[sheetName];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
//         setCurrentData(jsonData);
//       };
//       reader.readAsBinaryString(file);
//     }
//   };

//   const handleUndo = () => {
//     const previousState = undo();
//     if (previousState) {
//       setCurrentData(previousState);
//     }
//   };

//   const handleRedo = () => {
//     const nextState = redo();
//     if (nextState) {
//       setCurrentData(nextState);
//     }
//   };

//   const handleFormatChange = (type, value) => {
//     // Pass the formatting function to Dashboard
//     if (dashboardRef.current) {
//       dashboardRef.current.handleFormatChange(type, value);
//     }
//   };

//   const dashboardRef = useRef(null);

//   return (
//     <AuthProvider>
//       <Router>
//         <div className="flex flex-col h-screen">
//           <Navbar 
//             currentData={currentData}
//             setCurrentData={setCurrentData}
//             activeCell={activeCell}
//             undoHistory={handleUndo}
//             redoHistory={handleRedo}
//             canUndo={canUndo}
//             canRedo={canRedo}
//             onNewFile={handleNewFile}
//             onDataLoad={handleDataLoad}
//             // Add view props
//             showHeaders={showHeaders}
//             setShowHeaders={setShowHeaders}
//             showGridLines={showGridLines}
//             setShowGridLines={setShowGridLines}
//             zoomLevel={zoomLevel}
//             setZoomLevel={setZoomLevel}
//             onFormatChange={handleFormatChange}
//           />
//           <div className="flex-1 overflow-hidden">
//             <Routes>
//               <Route path="/login" element={<Login />} />
//               <Route path="/register" element={<Register />} />
//               <Route path="/" element={<HomePage />} />
//               <Route 
//                 path="/dashboard" 
//                 element={
//                   <PrivateRoute>
//                     <Dashboard 
//                       ref={dashboardRef}
//                       currentData={currentData} 
//                       setCurrentData={setCurrentData}
//                       activeCell={activeCell}
//                       setActiveCell={setActiveCell}
//                       // Add view props
//                       showHeaders={showHeaders}
//                       showGridLines={showGridLines}
//                       zoomLevel={zoomLevel}
//                     />
//                   </PrivateRoute>
//                 } 
//               />
//             </Routes>
//           </div>
//         </div>
//       </Router>
//     </AuthProvider>
//   );
// }

// export default App;
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
  // Replace single sheet data with multiple sheets structure
  const [sheets, setSheets] = useState({
    sheet1: {
      id: 'sheet1',
      name: 'Sheet 1',
      data: [
        ['', '', '', ''],
        ['', '', '', ''],
        ['', '', '', '']
      ],
      activeCell: { row: 0, col: 0 },
      cellFormats: {} // Store cell formatting per sheet
    }
  });
  
  // Track the active sheet
  const [activeSheetId, setActiveSheetId] = useState('sheet1');
  
  // View settings remain the same
  const [showHeaders, setShowHeaders] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Update history hook to work with sheets object
  const { pushState, undo, redo, canUndo, canRedo } = useSpreadsheetHistory(sheets);

  const dashboardRef = useRef(null);

  // Update data change handler to work with sheets
  const handleUpdateSheetData = (newSheets) => {
    setSheets(newSheets);
    pushState(newSheets);
  };


  // Update active cell in current sheet
  const setActiveCell = (cell) => {
    const updatedSheets = { ...sheets };
    updatedSheets[activeSheetId].activeCell = cell;
    setSheets(updatedSheets);
  };

  // New file now creates a single sheet
  const handleNewFile = () => {
    const newSheets = {
      sheet1: {
        id: 'sheet1',
        name: 'Sheet 1',
        data: Array(50).fill().map(() => Array(10).fill('')),
        activeCell: { row: 0, col: 0 },
        cellFormats: {}
      }
    };
    setSheets(newSheets);
    setActiveSheetId('sheet1');
    pushState(newSheets);
  };

  // Update file loading to work with sheets
  // const handleDataLoad = (file) => {
  //   if (!file) return;

  //   // Check if the file has already been parsed
  //   if (file.parsedData) {
  //       console.log("Using pre-parsed data");
        
  //       // Create a new sheet with the loaded data
  //       const newSheetId = `sheet${Object.keys(sheets).length + 1}`;
  //       const newSheets = {
  //           ...sheets,
  //           [newSheetId]: {
  //               id: newSheetId,
  //               name: file.name.replace('.csv', '').replace('.xlsx', '').replace('.xls', ''),
  //               data: file.parsedData,
  //               activeCell: { row: 0, col: 0 },
  //               cellFormats: {}
  //           }
  //       };
        
  //       setSheets(newSheets);
  //       setActiveSheetId(newSheetId);
  //       pushState(newSheets);
  //       return;
  //   }

  //   // Original file handling for non-pre-parsed files
  //   if (file.name.endsWith('.csv')) {
  //       const reader = new FileReader();
  //       reader.onload = (e) => {
  //           const text = e.target.result;
            
  //           // Try to use XLSX for CSV parsing
  //           try {
  //               const workbook = XLSX.read(text, { type: 'string' });
  //               const sheetName = workbook.SheetNames[0];
  //               const worksheet = workbook.Sheets[sheetName];
  //               const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
  //               // Create a new sheet with the loaded data
  //               const newSheetId = `sheet${Object.keys(sheets).length + 1}`;
  //               const newSheets = {
  //                   ...sheets,
  //                   [newSheetId]: {
  //                       id: newSheetId,
  //                       name: file.name.replace('.csv', ''),
  //                       data: rows,
  //                       activeCell: { row: 0, col: 0 },
  //                       cellFormats: {}
  //                   }
  //               };
                
  //               setSheets(newSheets);
  //               setActiveSheetId(newSheetId);
  //               pushState(newSheets);
  //           } catch (error) {
  //               console.error("XLSX CSV parsing failed:", error);
                
  //               // Fall back to original method
  //               const rows = text.split('\n').map(row => {
  //                   // Parse CSV with proper handling of quoted fields
  //                   const result = [];
  //                   let inQuotes = false;
  //                   let currentField = '';
                    
  //                   for (let i = 0; i < row.length; i++) {
  //                       const char = row[i];
                        
  //                       if (char === '"') {
  //                           if (i + 1 < row.length && row[i + 1] === '"') {
  //                               // Escaped quote
  //                               currentField += '"';
  //                               i++;
  //                           } else {
  //                               // Toggle quote mode
  //                               inQuotes = !inQuotes;
  //                           }
  //                       } else if (char === ',' && !inQuotes) {
  //                           // Field separator
  //                           result.push(currentField);
  //                           currentField = '';
  //                       } else {
  //                           // Regular character
  //                           currentField += char;
  //                       }
  //                   }
                    
  //                   // Add the last field
  //                   result.push(currentField);
  //                   return result;
  //               });
                
  //               // Create a new sheet with the loaded data
  //               const newSheetId = `sheet${Object.keys(sheets).length + 1}`;
  //               const newSheets = {
  //                   ...sheets,
  //                   [newSheetId]: {
  //                       id: newSheetId,
  //                       name: file.name.replace('.csv', ''),
  //                       data: rows,
  //                       activeCell: { row: 0, col: 0 },
  //                       cellFormats: {}
  //                   }
  //               };
                
  //               setSheets(newSheets);
  //               setActiveSheetId(newSheetId);
  //               pushState(newSheets);
  //           }
  //       };
  //       reader.readAsText(file);
  //   }else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
  //     const reader = new FileReader();
  //     reader.onload = (e) => {
  //       const data = e.target.result;
  //       const workbook = XLSX.read(data, { type: 'binary' });
        
  //       // Create a new sheet for each worksheet in the Excel file
  //       const newSheets = { ...sheets };
        
  //       workbook.SheetNames.forEach((sheetName, index) => {
  //         const worksheet = workbook.Sheets[sheetName];
  //         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
  //         const newSheetId = `sheet${Object.keys(sheets).length + index + 1}`;
  //         newSheets[newSheetId] = {
  //           id: newSheetId,
  //           name: sheetName,
  //           data: jsonData,
  //           activeCell: { row: 0, col: 0 },
  //           cellFormats: {}
  //         };
  //       });
        
  //       setSheets(newSheets);
  //       setActiveSheetId(Object.keys(newSheets)[Object.keys(sheets).length]); // Set to first new sheet
  //       pushState(newSheets);
  //     };
  //     reader.readAsBinaryString(file);
  //   }
  // };
// Update file loading to work with sheets
const handleDataLoad = (file) => {
  if (!file) return;

  // Find first empty sheet, if any exists
  const emptySheetId = findFirstEmptySheet(sheets);
  console.log(`Empty sheet found: ${emptySheetId ? emptySheetId : 'None'}`);

  // Check if the file has already been parsed
  if (file.parsedData) {
    console.log("Using pre-parsed data");
    
    if (emptySheetId) {
      // If an empty sheet exists, use it for the file data
      const updatedSheets = {
        ...sheets,
        [emptySheetId]: {
          ...sheets[emptySheetId],
          name: sheets[emptySheetId].name, // Keep the original sheet name
          data: file.parsedData
        }
      };
      
      setSheets(updatedSheets);
      setActiveSheetId(emptySheetId);
      pushState(updatedSheets);
    } else {
      // If no empty sheet exists, create a new sheet
      const sheetCount = Object.keys(sheets).length + 1;
      const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
      const newSheets = {
        ...sheets,
        [newSheetId]: {
          id: newSheetId,
          name: `Sheet ${sheetCount}`, // Use sequential numbering for sheet names
          data: file.parsedData,
          activeCell: { row: 0, col: 0 },
          cellFormats: {}
        }
      };
      
      setSheets(newSheets);
      setActiveSheetId(newSheetId);
      pushState(newSheets);
    }
    return;
  }

  // Original file handling for non-pre-parsed files
  if (file.name.endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      
      // Try to use XLSX for CSV parsing
      try {
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (emptySheetId) {
          // If an empty sheet exists, use it for the CSV data
          const updatedSheets = {
            ...sheets,
            [emptySheetId]: {
              ...sheets[emptySheetId],
              name: sheets[emptySheetId].name, // Keep the original sheet name
              data: rows
            }
          };
          
          setSheets(updatedSheets);
          setActiveSheetId(emptySheetId);
          pushState(updatedSheets);
        } else {
          // If no empty sheet exists, create a new sheet
          const sheetCount = Object.keys(sheets).length + 1;
          const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
          const newSheets = {
            ...sheets,
            [newSheetId]: {
              id: newSheetId,
              name: `Sheet ${sheetCount}`, // Use sequential numbering for sheet names
              data: rows,
              activeCell: { row: 0, col: 0 },
              cellFormats: {}
            }
          };
          
          setSheets(newSheets);
          setActiveSheetId(newSheetId);
          pushState(newSheets);
        }
      } catch (error) {
        console.error("XLSX CSV parsing failed:", error);
        
        // Fall back to original method
        // (similar logic as above but with CSV parsing fallback)
        // ...
      }
    };
    reader.readAsText(file);
  } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      
      // For Excel files with multiple sheets
      if (workbook.SheetNames.length > 1) {
        const newSheets = { ...sheets };
        let sheetCount = Object.keys(sheets).length;
        
        // If there's only one empty sheet and it's the only sheet, use it for the first worksheet
        if (emptySheetId && Object.keys(sheets).length === 1) {
          const firstSheetName = workbook.SheetNames[0];
          const firstWorksheet = workbook.Sheets[firstSheetName];
          const firstJsonData = XLSX.utils.sheet_to_json(firstWorksheet, { header: 1 });
          
          newSheets[emptySheetId] = {
            ...sheets[emptySheetId],
            name: sheets[emptySheetId].name, // Keep the original sheet name
            data: firstJsonData
          };
          
          // Create new sheets for the rest of the worksheets
          workbook.SheetNames.slice(1).forEach((wsName, index) => {
            const worksheet = workbook.Sheets[wsName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const newSheetId = `sheet${Date.now() + index + 1}`; // Ensure unique IDs
            newSheets[newSheetId] = {
              id: newSheetId,
              name: `Sheet ${sheetCount + index + 1}`, // Sequential naming
              data: jsonData,
              activeCell: { row: 0, col: 0 },
              cellFormats: {}
            };
          });
          
          setSheets(newSheets);
          setActiveSheetId(emptySheetId);
          pushState(newSheets);
        } else {
          // Create new sheets for all worksheets
          workbook.SheetNames.forEach((wsName, index) => {
            const worksheet = workbook.Sheets[wsName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            const newSheetId = `sheet${Date.now() + index}`; // Ensure unique IDs
            newSheets[newSheetId] = {
              id: newSheetId,
              name: `Sheet ${sheetCount + index + 1}`, // Sequential naming
              data: jsonData,
              activeCell: { row: 0, col: 0 },
              cellFormats: {}
            };
          });
          
          setSheets(newSheets);
          setActiveSheetId(Object.keys(newSheets)[sheetCount]); // Set to first new sheet
          pushState(newSheets);
        }
      } else {
        // For Excel files with a single sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (emptySheetId) {
          // If an empty sheet exists, use it for the Excel data
          const updatedSheets = {
            ...sheets,
            [emptySheetId]: {
              ...sheets[emptySheetId],
              name: sheets[emptySheetId].name, // Keep the original sheet name
              data: jsonData
            }
          };
          
          setSheets(updatedSheets);
          setActiveSheetId(emptySheetId);
          pushState(updatedSheets);
        } else {
          // If no empty sheet exists, create a new sheet
          const sheetCount = Object.keys(sheets).length + 1;
          const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique ID
          const newSheets = {
            ...sheets,
            [newSheetId]: {
              id: newSheetId,
              name: `Sheet ${sheetCount}`, // Use sequential numbering for sheet names
              data: jsonData,
              activeCell: { row: 0, col: 0 },
              cellFormats: {}
            }
          };
          
          setSheets(newSheets);
          setActiveSheetId(newSheetId);
          pushState(newSheets);
        }
      }
    };
    reader.readAsBinaryString(file);
  }
};

// Helper function to find the first empty sheet
const findFirstEmptySheet = (sheets) => {
  for (const [sheetId, sheet] of Object.entries(sheets)) {
    if (isSheetEmpty(sheet)) {
      return sheetId;
    }
  }
  return null; // No empty sheet found
};

// Helper function to check if a sheet is empty
const isSheetEmpty = (sheet) => {
  if (!sheet || !sheet.data) return true;
  
  // A sheet is considered empty if it has no data or all cells are empty/blank
  return sheet.data.every(row => 
    !row || row.length === 0 || row.every(cell => 
      cell === '' || cell === null || cell === undefined
    )
  );
};
  // Update undo/redo to work with sheets
  const handleUndo = () => {
    const previousState = undo();
    if (previousState) {
      setSheets(previousState);
      // Ensure active sheet ID is valid
      if (!previousState[activeSheetId]) {
        setActiveSheetId(Object.keys(previousState)[0]);
      }
    }
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState) {
      setSheets(nextState);
      // Ensure active sheet ID is valid
      if (!nextState[activeSheetId]) {
        setActiveSheetId(Object.keys(nextState)[0]);
      }
    }
  };

  // Add sheet management functions
  const handleAddSheet = () => {
    const sheetCount = Object.keys(sheets).length + 1;
    const newSheetId = `sheet${Date.now()}`; // Use timestamp for unique IDs
    
    const newSheets = {
      ...sheets,
      [newSheetId]: {
        id: newSheetId,
        name: `Sheet ${sheetCount}`,
        data: Array(50).fill().map(() => Array(10).fill('')),
        activeCell: { row: 0, col: 0 },
        cellFormats: {}
      }
    };
    
    setSheets(newSheets);
    setActiveSheetId(newSheetId);
    pushState(newSheets);
  };

  const handleSheetChange = (sheetId) => {
    setActiveSheetId(sheetId);
  };

  const handleRenameSheet = (sheetId, newName) => {
    const updatedSheets = { ...sheets };
    updatedSheets[sheetId].name = newName;
    setSheets(updatedSheets);
    pushState(updatedSheets);
  };

  const handleDeleteSheet = (sheetId) => {
    if (Object.keys(sheets).length <= 1) {
      return; // Don't delete the last sheet
    }
    
    const newSheets = { ...sheets };
    delete newSheets[sheetId];
    
    // Set a new active sheet if the deleted one was active
    if (activeSheetId === sheetId) {
      setActiveSheetId(Object.keys(newSheets)[0]);
    }
    
    setSheets(newSheets);
    pushState(newSheets);
  };

  const handleFormatChange = (type, value) => {
    // Pass the formatting function to Dashboard
    if (dashboardRef.current) {
      dashboardRef.current.handleFormatChange(type, value);
    }
  };

  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col h-screen">
          <Navbar 
            sheets={sheets}
            activeSheetId={activeSheetId}
            undoHistory={handleUndo}
            redoHistory={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            onNewFile={handleNewFile}
            onDataLoad={handleDataLoad}
            showHeaders={showHeaders}
            setShowHeaders={setShowHeaders}
            showGridLines={showGridLines}
            setShowGridLines={setShowGridLines}
            zoomLevel={zoomLevel}
            setZoomLevel={setZoomLevel}
            onFormatChange={handleFormatChange}
            activeCell={sheets[activeSheetId]?.activeCell || { row: 0, col: 0 }}
  currentData={sheets[activeSheetId]?.data || []}
  setCurrentData={(newData) => {
    const updatedSheets = { ...sheets };
    if (updatedSheets[activeSheetId]) {
      updatedSheets[activeSheetId].data = newData;
      handleUpdateSheetData(updatedSheets);
    }}}
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
                      sheets={sheets}
                      activeSheetId={activeSheetId}
                      onSheetChange={handleSheetChange}
                      onAddSheet={handleAddSheet}
                      onDeleteSheet={handleDeleteSheet}
                      onRenameSheet={handleRenameSheet}
                      onUpdateSheetData={handleUpdateSheetData}
                      setActiveCell={setActiveCell}
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