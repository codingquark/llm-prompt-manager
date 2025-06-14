import React from 'react';
import { Link } from 'react-router-dom';
import { Edit, Trash2, Copy, Calendar, Tag, Eye, Clock } from 'lucide-react';
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
          <div key={prompt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                <Link to={`/prompt/${prompt.id}`} className="hover:underline">
                  {prompt.title}
                </Link>
              </h3>
              {prompt.category && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: categories.find(c => c.name === prompt.category)?.color + '20',
                    color: categories.find(c => c.name === prompt.category)?.color
                  }}
                >
                  {prompt.category}
                </span>
              )}
              <p className="text-gray-600 mb-4 mt-2 line-clamp-3">
                {prompt.content}
              </p>
              <div className="flex items-center text-sm text-gray-500 mb-2">
                <span className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate(prompt.updated_at)}</span>
                </span>
              </div>
            </div>
            <div className="flex justify-end mt-4 space-x-2">
              <button
                onClick={() => handleCopy(prompt.content)}
                className="flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Copy to clipboard"
              >
                <Copy className="h-5 w-5" />
              </button>
              <Link
                to={`/prompt/${prompt.id}/edit`}
                className="btn-secondary flex items-center justify-center p-2"
                title="Edit"
              >
                <Edit className="h-5 w-5" />
              </Link>
              <button
                onClick={() => handleDelete(prompt)}
                className="flex items-center justify-center p-2 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-5 w-5 text-red-600" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PromptList; 