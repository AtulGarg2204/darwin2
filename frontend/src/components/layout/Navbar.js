import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import EditMenu from '../menus/EditMenu';

const Navbar = ({ currentData, setCurrentData, activeCell, undoHistory, redoHistory, onNewFile, onDataLoad }) => {
    const { user } = useAuth();
    const [showFileMenu, setShowFileMenu] = useState(false);
    const fileInputRef = useRef(null);

    // If not on dashboard, show simple navbar
    if (!window.location.pathname.includes('dashboard')) {
        return (
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="text-xl font-semibold">Sheet Chat</div>
                        <div className="space-x-4">
                            <Link to="/login" className="text-gray-700 hover:text-gray-900">Login</Link>
                            <Link to="/register" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                                Register
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
        );
    }

    // File menu handlers
    const handleNew = () => {
        const confirmNew = window.confirm('Are you sure you want to create a new file? Any unsaved changes will be lost.');
        if (confirmNew) {
            onNewFile();
            setShowFileMenu(false);
        }
    };

    const handleOpen = () => {
        fileInputRef.current.click();
        setShowFileMenu(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                if (file.name.endsWith('.csv')) {
                    // Parse CSV
                    const text = event.target.result;
                    const rows = text.split('\n').map(row => row.split(','));
                    onDataLoad(rows);
                } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    // Parse Excel
                    const data = event.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    onDataLoad(jsonData);
                }
            } catch (error) {
                console.error('Error reading file:', error);
                alert('Error reading file. Please make sure it\'s a valid CSV or Excel file.');
            }
        };

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    };

    const handleSave = () => {
        if (!currentData || currentData.length === 0) {
            alert('No data to save!');
            return;
        }

        try {
            const worksheet = XLSX.utils.aoa_to_sheet(currentData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            XLSX.writeFile(workbook, 'spreadsheet.xlsx');
            setShowFileMenu(false);
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file. Please try again.');
        }
    };

    const handleSaveAs = () => {
        if (!currentData || currentData.length === 0) {
            alert('No data to save!');
            return;
        }

        const fileType = prompt('Enter file type (xlsx or csv):', 'xlsx');
        if (!fileType) return;

        const fileName = prompt('Enter file name:', 'spreadsheet');
        if (!fileName) return;

        try {
            const worksheet = XLSX.utils.aoa_to_sheet(currentData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

            if (fileType.toLowerCase() === 'csv') {
                const csv = XLSX.utils.sheet_to_csv(worksheet);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${fileName}.csv`;
                link.click();
            } else {
                XLSX.writeFile(workbook, `${fileName}.xlsx`);
            }
            setShowFileMenu(false);
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file. Please try again.');
        }
    };

    // Edit menu handlers
    const handleUndo = () => {
        // Implement undo functionality
        console.log('Undo');
    };

    const handleRedo = () => {
        // Implement redo functionality
        console.log('Redo');
    };

    const handleCut = () => {
        document.execCommand('cut');
    };

    const handleCopy = () => {
        document.execCommand('copy');
    };

    const handlePaste = () => {
        document.execCommand('paste');
    };

    // Dashboard navbar with full menu
    return (
        <div className="flex flex-col">
            <nav className="bg-white border-b border-gray-200">
                <div className="flex items-center h-12 px-4">
                    <div className="flex items-center space-x-4">
                        <span className="text-xl font-semibold">Sheet chat</span>
                        <div className="flex items-center space-x-6">
                            {/* File Menu Dropdown */}
                            <div className="relative">
                                <button 
                                    className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded"
                                    onClick={() => setShowFileMenu(!showFileMenu)}
                                >
                                    <span className="mr-1">File</span>
                                </button>
                                {showFileMenu && (
                                    <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                        <div className="py-1">
                                            <button
                                                onClick={handleNew}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                New
                                            </button>
                                            <button
                                                onClick={handleOpen}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Open...
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={handleSaveAs}
                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                Save As...
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept=".csv,.xlsx,.xls"
                                className="hidden"
                            />

                            {/* Edit Menu */}
                            <EditMenu 
                                activeCell={activeCell}
                                currentData={currentData}
                                setCurrentData={setCurrentData}
                                undoHistory={undoHistory}
                                redoHistory={redoHistory}
                            />

                            {/* Other menu items */}
                            <button className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded">
                                <span className="mr-1">View</span>
                            </button>
                            <button className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded">
                                <span className="mr-1">Insert</span>
                            </button>
                            <button className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded">
                                <span className="mr-1">Format</span>
                            </button>
                            <button className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded">
                                <span className="mr-1">Help</span>
                            </button>
                            <button className="flex items-center text-sm text-gray-700 hover:bg-gray-100 px-3 py-1 rounded">
                                <span className="mr-1">Feedback</span>
                            </button>
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="ml-auto flex items-center space-x-4">
                        <span className="text-sm text-gray-600">My Team / Untitled</span>
                        <button className="bg-blue-500 text-white px-4 py-1 rounded text-sm hover:bg-blue-600">
                            Share
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
};

export default Navbar; 