import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, X, Plus, Lightbulb, Sparkles, Tag, Clock, BookOpen, Wand2 } from 'lucide-react';
import { promptsApi } from '../services/api';
import toast from 'react-hot-toast';

function PromptEditor({ categories, onSave }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: '',
    tags: [],
    change_reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const loadPrompt = useCallback(async () => {
    try {
      setLoading(true);
      const response = await promptsApi.getById(id);
      const prompt = response.data;
      setFormData({
        title: prompt.title,
        content: prompt.content,
        category: prompt.category || '',
        tags: prompt.tags || []
      });
    } catch (error) {
      console.error('Error loading prompt:', error);
      toast.error('Failed to load prompt');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (isEditing) {
      loadPrompt();
    }
  }, [isEditing, loadPrompt]);

  const loadSuggestions = async () => {
    if (!formData.content || formData.content.trim().length < 10) {
      toast.error('Please enter at least 10 characters in your prompt content before getting suggestions');
      return;
    }
    
    try {
      setLoadingSuggestions(true);
      const response = await promptsApi.getSuggestions(formData.content, formData.category);
      setSuggestions(response.data);
      toast.success('AI suggestions generated successfully!');
    } catch (error) {
      console.error('Error loading suggestions:', error);
      toast.error('Failed to generate suggestions. Please try again.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      setLoading(true);
      const promptData = {
        ...formData,
        title: formData.title.trim(),
        content: formData.content.trim(),
        tags: formData.tags.filter(tag => tag.trim())
      };

      if (isEditing) {
        await promptsApi.update(id, promptData);
        toast.success('Prompt updated successfully!');
      } else {
        await promptsApi.create(promptData);
        toast.success('Prompt created successfully!');
      }

      onSave();
      navigate('/');
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} prompt`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addTag = (e) => {
    e.preventDefault();
    const tag = tagInput.trim();
    
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      addTag(e);
    }
  };

  if (loading && isEditing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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

        <h1 className="text-3xl font-bold text-gray-900">
          {isEditing ? 'Edit Prompt' : 'Create New Prompt'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {/* Title */}
              <div className="mb-6">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="input-field"
                  placeholder="Enter a descriptive title for your prompt"
                  required
                />
              </div>

              {/* Category */}
              <div className="mb-6">
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="input-field"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                
                {/* Existing tags */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add tag input */}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add a tag and press Enter"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="mb-6">
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt Content *
                </label>
                <textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  className="textarea-field min-h-[300px]"
                  placeholder="Enter your prompt content here..."
                  required
                />
                <p className="mt-2 text-sm text-gray-500">
                  {formData.content.length} characters
                </p>
              </div>

              {/* Change Reason (only show when editing) */}
              {isEditing && (
                <div className="mb-6">
                  <label htmlFor="change_reason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for changes (optional)
                  </label>
                  <input
                    type="text"
                    id="change_reason"
                    value={formData.change_reason}
                    onChange={(e) => handleInputChange('change_reason', e.target.value)}
                    className="input-field"
                    placeholder="Briefly describe what you changed and why..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This will be saved in the version history to help track changes.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="btn-secondary"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Saving...' : (isEditing ? 'Update Prompt' : 'Create Prompt')}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Suggestions Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center sticky top-6 min-h-[380px]">
            <div className="flex flex-col items-center w-full mb-6">
              <Lightbulb className="h-8 w-8 text-yellow-400 mb-2" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">AI Suggestions</h3>
              <button
                type="button"
                onClick={loadSuggestions}
                disabled={loadingSuggestions || !formData.content || formData.content.trim().length < 10}
                className="mt-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2 px-6 rounded-full shadow-md transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
              >
                <Wand2 className="h-5 w-5" />
                <span>{loadingSuggestions ? 'Analyzing...' : 'Get Suggestions'}</span>
              </button>
            </div>

            <div className="w-full flex-1 flex flex-col justify-center">
              {loadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-base text-gray-600 text-center">
                    AI is analyzing your prompt...
                    <br />
                    <span className="text-xs text-gray-400">This may take a few moments</span>
                  </p>
                </div>
              ) : suggestions ? (
                <div className="space-y-7">
                  {/* Improvements */}
                  <div>
                    <h4 className="text-base font-medium text-gray-700 mb-2">Suggested Improvements</h4>
                    <ul className="space-y-2">
                      {suggestions.improvements.map((improvement, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                          <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Related Tags */}
                  <div>
                    <h4 className="text-base font-medium text-gray-700 mb-2">Suggested Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.relatedTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => {
                            if (!formData.tags.includes(tag)) {
                              setFormData(prev => ({
                                ...prev,
                                tags: [...prev.tags, tag]
                              }));
                              toast.success(`Added tag: ${tag}`);
                            }
                          }}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>Est. Tokens: {suggestions.estimatedTokens}</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <BookOpen className="h-4 w-4" />
                        <span>Readability: {suggestions.readabilityScore}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Suggestions */}
                  <div>
                    <h4 className="text-base font-medium text-gray-700 mb-2">Detailed Analysis</h4>
                    <div className="space-y-3">
                      {Object.entries(suggestions.suggestions).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                          <h5 className="text-sm font-medium text-gray-900 capitalize mb-1">{key}</h5>
                          <p className="text-sm text-gray-600">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Refresh button */}
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={loadSuggestions}
                      disabled={loadingSuggestions}
                      className="w-full btn-secondary text-sm"
                    >
                      Get New Suggestions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Lightbulb className="h-10 w-10 mb-3" />
                  <p className="text-base mb-2 text-center">Get AI-powered suggestions to improve your prompt</p>
                  <p className="text-xs text-gray-400 text-center">
                    Enter at least 10 characters in your prompt content, then click "Get Suggestions"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptEditor; 