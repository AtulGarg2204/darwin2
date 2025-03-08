const Toolbar = () => {
    return (
        <div className="flex items-center h-10 px-2 space-x-4">
            {/* Text formatting */}
            <div className="flex items-center space-x-1">
                <button className="p-1 hover:bg-gray-200 rounded font-bold text-sm">B</button>
                <button className="p-1 hover:bg-gray-200 rounded italic text-sm">I</button>
                <button className="p-1 hover:bg-gray-200 rounded underline text-sm">U</button>
            </div>

            {/* Alignment */}
            <div className="flex items-center space-x-1">
                <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                    </svg>
                </button>
                <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 6h16v2H4zm2 5h12v2H6zm2 5h8v2H8z"/>
                    </svg>
                </button>
                <button className="p-1 hover:bg-gray-200 rounded">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 6h16v2H4zm4 5h8v2H8zm4 5h4v2h-4z"/>
                    </svg>
                </button>
            </div>

            {/* Currency and Percentage */}
            <div className="flex items-center space-x-1">
                <button className="p-1 hover:bg-gray-200 rounded text-sm">$</button>
                <button className="p-1 hover:bg-gray-200 rounded text-sm">%</button>
            </div>
        </div>
    );
};

export default Toolbar; 