import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PromptList from './components/PromptList';
import PromptDetail from './components/PromptDetail';
import PromptEditor from './components/PromptEditor';
import Settings from './components/Settings';

import { promptsApi, categoriesApi } from './services/api';

function App() {
  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promptsResponse, categoriesResponse] = await Promise.all([
        promptsApi.getAll(),
        categoriesApi.getAll()
      ]);
      setPrompts(promptsResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async (filters = {}) => {
    try {
      const params = {
        ...filters,
        category: selectedCategory || undefined,
        search: searchQuery || undefined
      };
      const response = await promptsApi.getAll(params);
      setPrompts(response.data);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, [selectedCategory, searchQuery]);

  const handlePromptSaved = () => {
    loadPrompts();
  };

  const handlePromptDeleted = () => {
    loadPrompts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-gray-50">
        <Toaster position="top-right" />
        
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
          onAddCategory={loadData}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="container mx-auto px-6 py-8">
              <Routes>
                <Route
                  path="/"
                  element={
                    <PromptList
                      prompts={prompts}
                      categories={categories}
                      onPromptDeleted={handlePromptDeleted}
                    />
                  }
                />
                <Route
                  path="/prompt/new"
                  element={
                    <PromptEditor
                      categories={categories}
                      onSave={handlePromptSaved}
                    />
                  }
                />
                <Route
                  path="/prompt/:id/edit"
                  element={
                    <PromptEditor
                      categories={categories}
                      onSave={handlePromptSaved}
                    />
                  }
                />
                <Route
                  path="/prompt/:id"
                  element={
                    <PromptDetail
                      categories={categories}
                      onPromptDeleted={handlePromptDeleted}
                    />
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Settings
                      categories={categories}
                      prompts={prompts}
                      onDataReloaded={loadData}
                    />
                  }
                />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App; 