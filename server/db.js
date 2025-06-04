const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'prompts.db');
let db;

// Internal helper to resolve a prompt ID (full or prefix)
function _resolvePromptId(idInput) {
  return new Promise((resolve, reject) => {
    if (!idInput || String(idInput).trim() === '') {
      return reject(new Error("Prompt ID or prefix cannot be empty."));
    }
    const idString = String(idInput);

    // Standard UUID length is 36 characters
    if (idString.length === 36) {
      db.get('SELECT id FROM prompts WHERE id = ?', [idString], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error(`Prompt with ID \"${idString}\" not found.`));
        resolve(row.id);
      });
    } else if (idString.length > 0 && idString.length < 36) {
      db.all('SELECT id FROM prompts WHERE id LIKE ?', [idString + '%'], (err, rows) => {
        if (err) return reject(err);
        if (rows.length === 1) {
          resolve(rows[0].id);
        } else if (rows.length > 1) {
          reject(new Error(`Ambiguous ID prefix \"${idString}\". ${rows.length} prompts found. Please be more specific.`));
        } else { // 0 rows
          reject(new Error(`No prompt found with ID prefix \"${idString}\".`));
        }
      });
    } else { // Should be caught by initial check, but as a fallback
      reject(new Error(`Invalid ID or prefix provided: \"${idString}\".`));
    }
  });
}

function connectDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error connecting to the database:', err.message);
        reject(err);
      } else {
        console.log('Connected to the SQLite database.');
        // Enable foreign key constraints to ensure related records
        // (like prompt versions) are removed when a prompt is deleted
        db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
          if (pragmaErr) {
            console.error('Failed to enable foreign key support:', pragmaErr.message);
            return reject(pragmaErr);
          }
          resolve();
        });
      }
    });
  });
}

function initializeDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
      });

      db.run(`CREATE TABLE IF NOT EXISTS prompt_versions (
        id TEXT PRIMARY KEY,
        prompt_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        change_reason TEXT,
        FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
        UNIQUE(prompt_id, version_number)
      )`, (err) => {
        if (err) return reject(err);
      });

      db.run(`CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#3B82F6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return reject(err);
      });

      const defaultCategories = [
        { name: 'Writing', color: '#10B981' },
        { name: 'Coding', color: '#8B5CF6' },
        { name: 'Analysis', color: '#F59E0B' },
        { name: 'Creative', color: '#EF4444' },
        { name: 'General', color: '#6B7280' }
      ];

      const stmt = db.prepare(`INSERT OR IGNORE INTO categories (id, name, color) VALUES (?, ?, ?)`);
      defaultCategories.forEach(category => {
        stmt.run(uuidv4(), category.name, category.color, (err) => {
          if (err) console.error('Error inserting default category:', category.name, err.message);
        });
      });
      stmt.finalize((err) => {
        if (err) {
          console.error('Error finalizing default categories insertion:', err.message);
          return reject(err);
        }
        console.log('Database initialized successfully.');
        resolve();
      });
    });
  });
}

async function setupDatabase() {
  await connectDb();
  await initializeDb();
}

function closeDb() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        console.log('Database connection closed.');
        resolve();
      }
    });
  });
}

function getAllPrompts({ category, search } = {}) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM prompts';
    let params = [];

    if (category || search) {
      const conditions = [];
      if (category) {
        conditions.push('category = ?');
        params.push(category);
      }
      if (search) {
        conditions.push('(title LIKE ? OR content LIKE ? OR tags LIKE ?)');
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam, searchParam);
      }
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY updated_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) return reject(err);
      const prompts = rows.map(row => ({
        ...row,
        tags: row.tags ? row.tags.split(',') : []
      }));
      resolve(prompts);
    });
  });
}

async function getPromptById(idInput) {
  const fullId = await _resolvePromptId(idInput);
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM prompts WHERE id = ?', [fullId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error(`Prompt ${fullId} was not found after ID resolution. This should not happen.`));
      const prompt = {
        ...row,
        tags: row.tags ? row.tags.split(',') : []
      };
      resolve(prompt);
    });
  });
}

function createPrompt({ title, content, category, tags }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const tagsString = Array.isArray(tags) ? tags.join(',') : tags || '';
    db.run(
      'INSERT INTO prompts (id, title, content, category, tags) VALUES (?, ?, ?, ?, ?)',
      [id, title, content, category, tagsString],
      function(err) {
        if (err) return reject(err);
        resolve({ id, title, content, category, tags: tags || [] });
      }
    );
  });
}

async function updatePrompt(idInput, dataToUpdate) {
  const fullId = await _resolvePromptId(idInput);
  const { title, content, category, tags, change_reason } = dataToUpdate;
  
  // Get current prompt data for versioning
  const currentPrompt = await getPromptById(fullId);
  
  // Ensure tags are handled correctly: join array, use string as is, or default to empty for null/undefined
  let tagsString;
  if (Array.isArray(tags)) {
    tagsString = tags.join(',');
  } else if (tags === null || tags === undefined) {
    tagsString = ''; // Default to empty string if tags are null/undefined to clear them
  } else {
    tagsString = tags; // Assume it's already a string
  }

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Get the current version number for this prompt
        const versionResult = await new Promise((vResolve, vReject) => {
          db.get('SELECT MAX(version_number) as max_version FROM prompt_versions WHERE prompt_id = ?', [fullId], (err, row) => {
            if (err) return vReject(err);
            vResolve(row?.max_version || 0);
          });
        });

        const nextVersion = versionResult + 1;

        // Create version record of current state before updating
        await new Promise((vResolve, vReject) => {
          const versionId = uuidv4();
          const currentTagsString = Array.isArray(currentPrompt.tags) ? currentPrompt.tags.join(',') : currentPrompt.tags || '';
          
          db.run(
            'INSERT INTO prompt_versions (id, prompt_id, version_number, title, content, category, tags, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [versionId, fullId, nextVersion, currentPrompt.title, currentPrompt.content, currentPrompt.category, currentTagsString, change_reason || 'Updated prompt'],
            function(err) {
              if (err) return vReject(err);
              vResolve();
            }
          );
        });

        // Update the main prompt
        await new Promise((uResolve, uReject) => {
          db.run(
            'UPDATE prompts SET title = ?, content = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, category, tagsString, fullId],
            function(err) {
              if (err) return uReject(err);
              uResolve();
            }
          );
        });

        // Fetch the updated prompt to return its latest state
        const updatedPromptData = await getPromptById(fullId);
        resolve(updatedPromptData);
      } catch (err) {
        console.error(`Error updating prompt ${fullId}:`, err);
        reject(err);
      }
    });
  });
}

async function deletePrompt(idInput) {
  const fullId = await _resolvePromptId(idInput);
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM prompts WHERE id = ?', [fullId], function(err) {
      if (err) return reject(err);
      resolve(this.changes > 0); // True if a row was deleted, false otherwise
    });
  });
}

function getAllCategories() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM categories ORDER BY name', (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function createCategory({ name, color }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)',
      [id, name, color || '#3B82F6'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return reject(new Error('Category already exists'));
          }
          return reject(err);
        }
        resolve({ id, name, color: color || '#3B82F6' });
      }
    );
  });
}

function exportData() {
  return new Promise(async (resolve, reject) => {
    try {
      const prompts = await getAllPrompts();
      const categories = await getAllCategories();
      const exportDate = new Date().toISOString();
      resolve({ prompts, categories, exportDate });
    } catch (err) {
      reject(err);
    }
  });
}

function importData({ prompts, categories }) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        if (categories && Array.isArray(categories)) {
          const stmtCat = db.prepare('INSERT OR IGNORE INTO categories (id, name, color) VALUES (?, ?, ?)');
          for (const category of categories) {
            await new Promise((res, rej) => stmtCat.run(category.id || uuidv4(), category.name, category.color || '#3B82F6', err => err ? rej(err) : res()));
          }
          await new Promise((res, rej) => stmtCat.finalize(err => err ? rej(err) : res()));
        }

        if (prompts && Array.isArray(prompts)) {
          const stmtPrompt = db.prepare('INSERT OR REPLACE INTO prompts (id, title, content, category, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)');
          for (const prompt of prompts) {
            const tagsString = Array.isArray(prompt.tags) ? prompt.tags.join(',') : prompt.tags || '';
            await new Promise((res, rej) => stmtPrompt.run(prompt.id || uuidv4(), prompt.title, prompt.content, prompt.category, tagsString, prompt.created_at || new Date().toISOString(), err => err ? rej(err) : res()));
          }
          await new Promise((res, rej) => stmtPrompt.finalize(err => err ? rej(err) : res()));
        }
        resolve({ message: 'Import completed successfully' });
      } catch (err) {
        console.error('Error during import transaction, attempting rollback:', err);
        db.run('ROLLBACK', (rollbackErr) => {
          if (rollbackErr) console.error('Rollback failed:', rollbackErr);
          reject(err); 
        });
      }
    });
  });
}

function deleteAllPrompts() {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM prompts', function(err) {
            if (err) return reject(err);
            resolve({ message: 'All prompts deleted successfully', count: this.changes });
        });
    });
}


function getPromptVersions(idInput) {
  return new Promise(async (resolve, reject) => {
    try {
      const fullId = await _resolvePromptId(idInput);
      db.all(
        'SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number DESC',
        [fullId],
        (err, rows) => {
          if (err) return reject(err);
          const versions = rows.map(row => ({
            ...row,
            tags: row.tags ? row.tags.split(',') : []
          }));
          resolve(versions);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

function getPromptVersion(idInput, versionNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      const fullId = await _resolvePromptId(idInput);
      db.get(
        'SELECT * FROM prompt_versions WHERE prompt_id = ? AND version_number = ?',
        [fullId, versionNumber],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return reject(new Error(`Version ${versionNumber} not found for prompt ${fullId}`));
          const version = {
            ...row,
            tags: row.tags ? row.tags.split(',') : []
          };
          resolve(version);
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

async function restorePromptVersion(idInput, versionNumber, change_reason) {
  const fullId = await _resolvePromptId(idInput);
  
  return new Promise(async (resolve, reject) => {
    try {
      // Get the version to restore
      const versionToRestore = await getPromptVersion(fullId, versionNumber);
      
      // Get current prompt for creating a version before restoration
      const currentPrompt = await getPromptById(fullId);
      
      db.serialize(async () => {
        // Get next version number
        const versionResult = await new Promise((vResolve, vReject) => {
          db.get('SELECT MAX(version_number) as max_version FROM prompt_versions WHERE prompt_id = ?', [fullId], (err, row) => {
            if (err) return vReject(err);
            vResolve(row?.max_version || 0);
          });
        });

        const nextVersion = versionResult + 1;

        // Create version record of current state before restoring
        await new Promise((vResolve, vReject) => {
          const versionId = uuidv4();
          const currentTagsString = Array.isArray(currentPrompt.tags) ? currentPrompt.tags.join(',') : currentPrompt.tags || '';
          
          db.run(
            'INSERT INTO prompt_versions (id, prompt_id, version_number, title, content, category, tags, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [versionId, fullId, nextVersion, currentPrompt.title, currentPrompt.content, currentPrompt.category, currentTagsString, change_reason || `Restored to version ${versionNumber}`],
            function(err) {
              if (err) return vReject(err);
              vResolve();
            }
          );
        });

        // Restore the prompt to the specified version
        const tagsString = Array.isArray(versionToRestore.tags) ? versionToRestore.tags.join(',') : versionToRestore.tags || '';
        
        await new Promise((uResolve, uReject) => {
          db.run(
            'UPDATE prompts SET title = ?, content = ?, category = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [versionToRestore.title, versionToRestore.content, versionToRestore.category, tagsString, fullId],
            function(err) {
              if (err) return uReject(err);
              uResolve();
            }
          );
        });

        // Return the restored prompt
        const restoredPrompt = await getPromptById(fullId);
        resolve(restoredPrompt);
      });
    } catch (err) {
      console.error(`Error restoring prompt ${fullId} to version ${versionNumber}:`, err);
      reject(err);
    }
  });
}

module.exports = {
  setupDatabase,
  closeDb,
  getAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  getAllCategories,
  createCategory,
  exportData,
  importData,
  deleteAllPrompts,
  getPromptVersions,
  getPromptVersion,
  restorePromptVersion,
  getDbInstance: () => db 
}; 