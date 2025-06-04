import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit, Trash2, Copy, ArrowLeft, Calendar, Tag, Clock } from 'lucide-react';
import { promptsApi } from '../services/api';
import toast from 'react-hot-toast';
import VersionHistory from './VersionHistory';

function PromptDetail({ categories, onPromptDeleted }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const loadPrompt = useCallback(async () => {
    try {
      setLoading(true);
      const response = await promptsApi.getById(id);
      setPrompt(response.data);
    } catch (error) {
      console.error('Error loading prompt:', error);
      toast.error('Failed to load prompt');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPrompt();
  }, [id, loadPrompt, categories]);

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete "${prompt.title}"?`)) {
      try {
        await promptsApi.delete(prompt.id);
        onPromptDeleted();
        toast.success('Prompt deleted successfully!');
        navigate('/');
      } catch (error) {
        toast.error('Failed to delete prompt');
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content).then(() => {
      toast.success('Prompt copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy prompt');
    });
  };

  const getCategoryColor = (categoryName) => {
    const category = categories.find(c => c.name === categoryName);
    return category ? category.color : '#6B7280';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Prompt not found</h3>
        <Link to="/" className="text-blue-600 hover:text-blue-800">
          ← Back to prompts
        </Link>
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

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {prompt.title}
            </h1>
            
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              {prompt.category && (
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getCategoryColor(prompt.category) }}
                  />
                  <span>{prompt.category}</span>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Updated {formatDate(prompt.updated_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Clock className="h-4 w-4" />
              <span>Versions</span>
            </button>

            <button
              onClick={handleCopy}
              className="btn-secondary flex items-center space-x-2"
            >
              <Copy className="h-4 w-4" />
              <span>Copy</span>
            </button>
            
            <Link
              to={`/prompt/${prompt.id}/edit`}
              className="btn-secondary flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </Link>
            
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center space-x-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tags */}
      {prompt.tags && prompt.tags.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <Tag className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {prompt.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Prompt Content</h2>
            <button
              onClick={handleCopy}
              className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
            >
              Copy to clipboard
            </button>
          </div>
          
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 overflow-x-auto">
              {prompt.content}
            </pre>
          </div>
        </div>
      </div>

      {/* Version History */}
      {showVersionHistory && (
        <div className="mt-6">
          <VersionHistory
            prompt={prompt}
            onVersionRestore={() => {
              loadPrompt();
              setShowVersionHistory(false);
            }}
            onClose={() => setShowVersionHistory(false)}
          />
        </div>
      )}

      {/* Metadata */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Details</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Created</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(prompt.created_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Updated</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{formatDate(prompt.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{prompt.category || 'None'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-700 dark:text-gray-300">Character Count</dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100">{prompt.content.length}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export default PromptDetail; 