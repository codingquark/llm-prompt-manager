import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { promptsApi } from '../services/api';
import toast from 'react-hot-toast';

function Settings({ categories, prompts, onDataReloaded }) {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const response = await promptsApi.export();
      const data = response.data;
      
      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prompts-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate data structure
      if (!data.prompts || !Array.isArray(data.prompts)) {
        throw new Error('Invalid file format');
      }

      await promptsApi.import(data);
      onDataReloaded();
      toast.success('Data imported successfully!');
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data. Please check the file format.');
    } finally {
      setImporting(false);
      event.target.value = ''; // Reset file input
    }
  };

  const handleClearData = async () => {
    const confirmMessage = 'Are you sure you want to delete ALL prompts? This action cannot be undone.';
    
    if (window.confirm(confirmMessage)) {
      try {
        setLoading(true);
        await promptsApi.deleteAll();
        onDataReloaded();
        toast.success('All prompts deleted successfully');
      } catch (error) {
        console.error('Clear data error:', error);
        toast.error('Failed to clear data');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <Link
            to="/"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to prompts</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Data Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Data Management</h2>
            
            <div className="space-y-4">
              {/* Export */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Export Data</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Download all your prompts and categories as a JSON file</p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  <span>{loading ? 'Exporting...' : 'Export'}</span>
                </button>
              </div>

              {/* Import */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Import Data</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Upload a JSON file to import prompts and categories</p>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    disabled={importing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <button
                    disabled={importing}
                    className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{importing ? 'Importing...' : 'Import'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Statistics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{categories.length}</div>
                <div className="text-sm text-gray-600">Categories</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{prompts.length}</div>
                <div className="text-sm text-gray-600">Total Prompts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Categories</h2>
            
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium text-gray-900">{category.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Created {new Date(category.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
              
              {categories.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No categories created yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-lg shadow-sm border border-red-200">
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-medium text-red-900">Danger Zone</h2>
            </div>
            
            <div className="space-y-4">
              {/* Clear all data */}
              <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                <div>
                  <h3 className="text-sm font-medium text-red-900">Clear All Data</h3>
                  <p className="text-sm text-red-700">Permanently delete all prompts and categories. This action cannot be undone.</p>
                </div>
                <button
                  onClick={handleClearData}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">About</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>LLM Prompt Manager</strong> - A web application for managing your AI prompts</p>
              <p>Features:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Create, edit, and organize prompts</li>
                <li>Categorize prompts with colors</li>
                <li>Tag prompts for better organization</li>
                <li>Search and filter functionality</li>
                <li>Export and import data</li>
                <li>Copy prompts to clipboard</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings; 