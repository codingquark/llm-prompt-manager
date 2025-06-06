import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, X, Calendar, MessageSquare } from 'lucide-react';
import { promptsApi } from '../services/api';
import toast from 'react-hot-toast';

function VersionHistory({ prompt, onVersionRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoreReason, setRestoreReason] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  useEffect(() => {
    if (prompt?.id) {
      loadVersions();
    }
  }, [prompt?.id]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await promptsApi.getVersions(prompt.id);
      setVersions(response.data);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;

    try {
      await promptsApi.restoreVersion(
        prompt.id,
        selectedVersion.version_number,
        restoreReason || `Restored to version ${selectedVersion.version_number}`
      );
      
      toast.success(`Restored to version ${selectedVersion.version_number}`);
      setShowRestoreModal(false);
      setSelectedVersion(null);
      setRestoreReason('');
      
      if (onVersionRestore) {
        onVersionRestore();
      }
      
      // Reload versions to show the new version created by restore
      loadVersions();
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDiffText = (currentContent, versionContent) => {
    if (currentContent === versionContent) return 'No changes';
    
    const currentLength = currentContent.length;
    const versionLength = versionContent.length;
    const diff = currentLength - versionLength;
    
    if (diff > 0) {
      return `+${diff} characters`;
    } else if (diff < 0) {
      return `${diff} characters`;
    }
    return 'Modified';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-medium text-gray-900">Version History</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1">

          {versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p>No version history available yet.</p>
              <p className="text-sm">Versions will be created when you edit this prompt.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Version {version.version_number}
                        </span>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(version.created_at)}</span>
                        </div>
                      </div>
                      
                      {version.change_reason && (
                        <div className="flex items-start space-x-2 mb-3">
                          <MessageSquare className="h-4 w-4 text-gray-500 mt-0.5" />
                          <span className="text-sm text-gray-700">{version.change_reason}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Title:</span>
                          <p className="text-gray-900 truncate" title={version.title}>
                            {version.title}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Category:</span>
                          <p className="text-gray-900">{version.category || 'None'}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Changes:</span>
                          <p className="text-gray-900">
                            {getDiffText(prompt.content, version.content)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <details className="group">
                          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 font-medium">
                            View content preview
                          </summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded border">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-hidden">
                              {version.content.length > 200 
                                ? version.content.substring(0, 200) + '...'
                                : version.content
                              }
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>

                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowRestoreModal(true);
                        }}
                        className="btn-secondary flex items-center space-x-2 text-sm"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Restore</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && selectedVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Restore Version {selectedVersion.version_number}
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                This will restore your prompt to version {selectedVersion.version_number} from{' '}
                {formatDate(selectedVersion.created_at)}. Your current version will be saved as a new version.
              </p>

              <div className="mb-4">
                <label htmlFor="restore-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for restore (optional)
                </label>
                <textarea
                  id="restore-reason"
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Reverting unwanted changes..."
                  value={restoreReason}
                  onChange={(e) => setRestoreReason(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    setSelectedVersion(null);
                    setRestoreReason('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Restore Version
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default VersionHistory;