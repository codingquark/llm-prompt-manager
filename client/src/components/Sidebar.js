import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Tag, Plus, X } from 'lucide-react';
import { categoriesApi } from '../services/api';
import toast from 'react-hot-toast';

function Sidebar({ isOpen, categories, selectedCategory, onCategorySelect, onAddCategory }) {
  const location = useLocation();
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await categoriesApi.create({
        name: newCategoryName.trim(),
        color: newCategoryColor
      });
      setNewCategoryName('');
      setNewCategoryColor('#3B82F6');
      setShowNewCategory(false);
      onAddCategory();
      toast.success('Category added successfully!');
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  if (!isOpen) {
    return null;
  }

  const colors = [
    '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
    '#6B7280', '#EC4899', '#14B8A6', '#F97316', '#84CC16'
  ];

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-6">
        <nav className="space-y-2">
          <Link
            to="/"
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              location.pathname === '/' && !selectedCategory
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200'
            }`}
            onClick={() => onCategorySelect('')}
          >
            <Home className="h-5 w-5" />
            <span>All Prompts</span>
          </Link>
        </nav>
      </div>

      <div className="px-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Categories</h3>
          <button
            onClick={() => setShowNewCategory(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {showNewCategory && (
          <form onSubmit={handleAddCategory} className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
            <input
              type="text"
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              autoFocus
            />
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs text-gray-600 dark:text-gray-300">Color:</span>
              <div className="flex space-x-1">
                {colors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                    className={`w-4 h-4 rounded-full border-2 ${
                      newCategoryColor === color ? 'border-gray-400' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewCategory(false);
                  setNewCategoryName('');
                  setNewCategoryColor('#3B82F6');
                }}
                className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <nav className="space-y-1 max-h-96 overflow-y-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategorySelect(category.name)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-left ${
                selectedCategory === category.name
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200'
              }`}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-sm">{category.name}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar; 