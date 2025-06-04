import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, Plus, Settings, Sun, Moon } from 'lucide-react';

function Header({ onToggleSidebar, searchQuery, onSearchChange, darkMode, onToggleDarkMode }) {
  const location = useLocation();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            LLM Prompt Manager
          </h1>
        </div>

        <div className="flex items-center space-x-4 flex-1 max-w-xl mx-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/prompt/new"
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Prompt</span>
          </Link>

          <Link
            to="/settings"
            className={`p-2 rounded-lg transition-colors ${
              location.pathname === '/settings'
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Settings className="h-5 w-5" />
          </Link>

          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Toggle dark mode"
          >
            {darkMode ? (
              <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header; 