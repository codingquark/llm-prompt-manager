import React from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Copy, Calendar, Tag } from 'lucide-react';
import { promptsApi } from '../services/api';
import toast from 'react-hot-toast';

function PromptList({ prompts, categories, onPromptDeleted }) {
  const handleDelete = async (prompt) => {
    if (window.confirm(`Are you sure you want to delete "${prompt.title}"?`)) {
      try {
        await promptsApi.delete(prompt.id);
        onPromptDeleted();
        toast.success('Prompt deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete prompt');
      }
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content).then(() => {
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
      month: 'short',
      day: 'numeric',
    });
  };

  if (prompts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <Tag className="h-12 w-12 text-gray-400 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No prompts found</h3>
        <p className="text-gray-500 mb-6">Get started by creating your first prompt.</p>
        <Link
          to="/prompt/new"
          className="btn-primary"
        >
          Create New Prompt
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {prompts.length} Prompt{prompts.length !== 1 ? 's' : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <Link
                    to={`/prompt/${prompt.id}`}
                    className="block hover:text-blue-600 transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {prompt.title}
                    </h3>
                  </Link>
                  
                  {prompt.category && (
                    <div className="flex items-center space-x-2 mb-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getCategoryColor(prompt.category) }}
                      />
                      <span className="text-sm text-gray-600">{prompt.category}</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {prompt.content}
              </p>

              {prompt.tags && prompt.tags.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {tag}
                      </span>
                    ))}
                    {prompt.tags.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        +{prompt.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(prompt.updated_at)}</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopy(prompt.content)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Copy prompt"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  
                  <Link
                    to={`/prompt/${prompt.id}/edit`}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Edit prompt"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  
                  <button
                    onClick={() => handleDelete(prompt)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Delete prompt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PromptList; 