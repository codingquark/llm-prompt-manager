const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
require('dotenv').config();

// Allow overriding the database path for tests or custom setups
const dbPath = process.env.DB_PATH || path.join(__dirname, 'prompts.db');
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

      // Create embeddings table for semantic search
      db.run(`CREATE TABLE IF NOT EXISTS prompt_embeddings (
        prompt_id TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        embedding_model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE
      )`, (err) => {
        if (err) return reject(err);
      });

      // Create FTS5 virtual table for enhanced search
      db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        category,
        created_at UNINDEXED,
        updated_at UNINDEXED,
        content='prompts',
        content_rowid='rowid'
      )`, (err) => {
        if (err) return reject(err);
      });

      // Create triggers to keep FTS table synchronized
      db.run(`CREATE TRIGGER IF NOT EXISTS prompts_fts_insert AFTER INSERT ON prompts BEGIN
        INSERT INTO prompts_fts(rowid, id, title, content, category, created_at, updated_at)
        VALUES (new.rowid, new.id, new.title, new.content, new.category, new.created_at, new.updated_at);
      END`, (err) => {
        if (err) return reject(err);
      });

      db.run(`CREATE TRIGGER IF NOT EXISTS prompts_fts_update AFTER UPDATE ON prompts BEGIN
        UPDATE prompts_fts SET 
          title = new.title,
          content = new.content,
          category = new.category,
          updated_at = new.updated_at
        WHERE rowid = new.rowid;
      END`, (err) => {
        if (err) return reject(err);
      });

      db.run(`CREATE TRIGGER IF NOT EXISTS prompts_fts_delete AFTER DELETE ON prompts BEGIN
        DELETE FROM prompts_fts WHERE rowid = old.rowid;
      END`, (err) => {
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
      stmt.finalize(async (err) => {
        if (err) {
          console.error('Error finalizing default categories insertion:', err.message);
          return reject(err);
        }
        
        // Populate FTS table with existing data
        try {
          await populateFTSTable();
          console.log('Database initialized successfully.');
          resolve();
        } catch (ftsErr) {
          console.error('Error populating FTS table:', ftsErr.message);
          reject(ftsErr);
        }
      });
    });
  });
}

function populateFTSTable() {
  return new Promise((resolve, reject) => {
    // First, clear existing FTS data
    db.run('DELETE FROM prompts_fts', (err) => {
      if (err) return reject(err);
      
      // Then populate with current prompts data
      db.all('SELECT rowid, * FROM prompts', (err, rows) => {
        if (err) return reject(err);
        
        if (rows.length === 0) {
          return resolve(); // No data to populate
        }
        
        const stmt = db.prepare(`
          INSERT INTO prompts_fts(rowid, id, title, content, category, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        let processed = 0;
        const total = rows.length;
        
        rows.forEach(row => {
          stmt.run(
            row.rowid, row.id, row.title, row.content, 
            row.category, row.created_at, row.updated_at,
            (err) => {
              if (err) {
                console.error('Error inserting FTS row:', err.message);
              }
              processed++;
              if (processed === total) {
                stmt.finalize((finalizeErr) => {
                  if (finalizeErr) return reject(finalizeErr);
                  console.log(`Populated FTS table with ${total} prompts`);
                  resolve();
                });
              }
            }
          );
        });
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
  return new Promise(async (resolve, reject) => {
    try {
      // If no search term, use simple query
      if (!search) {
        let query = 'SELECT * FROM prompts';
        let params = [];

        if (category) {
          query += ' WHERE category = ?';
          params.push(category);
        }
        query += ' ORDER BY updated_at DESC';

        db.all(query, params, (err, rows) => {
          if (err) return reject(err);
          const prompts = rows;
          resolve(prompts);
        });
        return;
      }

      // Check if embeddings are available for hybrid search
      const embeddingCount = await new Promise((countResolve, countReject) => {
        db.get('SELECT COUNT(*) as count FROM prompt_embeddings', [], (err, row) => {
          if (err) return countReject(err);
          countResolve(row.count);
        });
      });

      // Use hybrid search if embeddings are available, otherwise fall back to FTS
      if (embeddingCount > 0) {
        console.log(`Using hybrid search (${embeddingCount} embeddings available)`);
        const results = await hybridSearch(search, { category });
        resolve(results);
      } else {
        console.log('No embeddings available, using FTS search');
        const results = await ftsSearch(search, { category });
        resolve(results);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function getPromptById(idInput) {
  const fullId = await _resolvePromptId(idInput);
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM prompts WHERE id = ?', [fullId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error(`Prompt ${fullId} was not found after ID resolution. This should not happen.`));
      resolve(row);
    });
  });
}

function createPrompt({ title, content, category }) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.run(
      `INSERT INTO prompts (id, title, content, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, title, content, category, now, now],
      function(err) {
        if (err) {
          return reject(err);
        }
        
        // Create initial version
        db.run(
          `INSERT INTO prompt_versions (id, prompt_id, version_number, title, content, category, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, 1, title, content, category, now],
          (versionErr) => {
            if (versionErr) {
              console.error('Error creating initial version:', versionErr);
            }
            
            // Return the created prompt
            db.get('SELECT * FROM prompts WHERE id = ?', [id], (err, prompt) => {
              if (err) return reject(err);
              resolve(prompt);
            });
          }
        );
      }
    );
  });
}

async function updatePrompt(idInput, dataToUpdate) {
  const fullId = await _resolvePromptId(idInput);
  const { title, content, category, change_reason } = dataToUpdate;
  
  // Get current prompt data for versioning
  const currentPrompt = await getPromptById(fullId);
  
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
          
          db.run(
            'INSERT INTO prompt_versions (id, prompt_id, version_number, title, content, category, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [versionId, fullId, nextVersion, currentPrompt.title, currentPrompt.content, currentPrompt.category, change_reason || 'Updated prompt'],
            function(err) {
              if (err) return vReject(err);
              vResolve();
            }
          );
        });

        // Update the main prompt
        await new Promise((uResolve, uReject) => {
          db.run(
            'UPDATE prompts SET title = ?, content = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, category, fullId],
            function(err) {
              if (err) return uReject(err);
              uResolve();
            }
          );
        });

        // Fetch the updated prompt to return its latest state
        const updatedPromptData = await getPromptById(fullId);

      // Generate embedding in the background (don't wait for it)
      generateAndSaveEmbedding(fullId).catch(err => {
        console.error(`Failed to generate embedding for updated prompt ${fullId}:`, err);
      });
        
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
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM prompts', (err, prompts) => {
      if (err) return reject(err);
      
      db.all('SELECT * FROM categories', (err, categories) => {
        if (err) return reject(err);
        
        resolve({
          prompts: prompts.map(row => ({
            id: row.id,
            title: row.title,
            content: row.content,
            category: row.category,
            created_at: row.created_at
          })),
          categories
        });
      });
    });
  });
}

function importData({ prompts, categories }) {
  return new Promise(async (resolve, reject) => {
    try {
      // Import categories first
      const stmtCategory = db.prepare('INSERT OR REPLACE INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)');
      for (const category of categories) {
        await new Promise((res, rej) => stmtCategory.run(category.id || uuidv4(), category.name, category.color, category.created_at || new Date().toISOString(), err => err ? rej(err) : res()));
      }
      stmtCategory.finalize();

      // Then import prompts
      const stmtPrompt = db.prepare('INSERT OR REPLACE INTO prompts (id, title, content, category, created_at) VALUES (?, ?, ?, ?, ?)');
      for (const prompt of prompts) {
        await new Promise((res, rej) => stmtPrompt.run(prompt.id || uuidv4(), prompt.title, prompt.content, prompt.category, prompt.created_at || new Date().toISOString(), err => err ? rej(err) : res()));
      }
      stmtPrompt.finalize();

      resolve({ success: true, message: 'Data imported successfully' });
    } catch (err) {
      reject(err);
    }
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
        `SELECT * FROM prompt_versions 
         WHERE prompt_id = ? 
         ORDER BY version_number DESC`,
        [fullId],
        (err, rows) => {
          if (err) return reject(err);
          
          resolve(rows.map(row => ({
            id: row.id,
            prompt_id: row.prompt_id,
            version_number: row.version_number,
            title: row.title,
            content: row.content,
            category: row.category,
            created_at: row.created_at,
            change_reason: row.change_reason
          })));
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
  
  // Get the version to restore
  const versionToRestore = await getPromptVersion(fullId, versionNumber);
  if (!versionToRestore) {
    throw new Error(`Version ${versionNumber} not found for prompt ${fullId}`);
  }
  
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Create new version with current state
        const currentPrompt = await getPromptById(fullId);
        
        await new Promise((vResolve, vReject) => {
          const versionId = uuidv4();
          
          db.run(
            `INSERT INTO prompt_versions (
              id, prompt_id, version_number, title, content, category, created_at, change_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              versionId,
              fullId,
              versionToRestore.version_number + 1,
              currentPrompt.title,
              currentPrompt.content,
              currentPrompt.category,
              new Date().toISOString(),
              change_reason
            ],
            (err) => {
              if (err) return vReject(err);
              vResolve();
            }
          );
        });
        
        // Update prompt with restored version
        await new Promise((uResolve, uReject) => {
          db.run(
            `UPDATE prompts 
             SET title = ?, content = ?, category = ?, updated_at = ?
             WHERE id = ?`,
            [
              versionToRestore.title,
              versionToRestore.content,
              versionToRestore.category,
              new Date().toISOString(),
              fullId
            ],
            (err) => {
              if (err) return uReject(err);
              uResolve();
            }
          );
        });
        
        // Return the restored prompt
        const restoredPrompt = await getPromptById(fullId);
        resolve(restoredPrompt);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Embedding functions for semantic search
async function generateEmbedding(text) {
  // Try OpenAI first if available
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000) // OpenAI has 8,192 token limit
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      return new Float32Array(data.data[0].embedding);
    } catch (error) {
      console.error('Error with OpenAI embedding:', error);
      // Fall through to simple embedding
    }
  }

  // Fallback to simple text-based embedding (for development/testing)
  console.log('Using simple text-based embedding fallback');
  return generateSimpleEmbedding(text);
}

function generateSimpleEmbedding(text) {
  // Create a simple 384-dimensional embedding based on text features
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Float32Array(384);
  
  // Initialize with small random values
  for (let i = 0; i < 384; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.1;
  }
  
  // Add features based on text characteristics
  words.forEach((word, index) => {
    const wordHash = hashString(word);
    const pos = Math.abs(wordHash) % 384;
    
    // Word frequency and position influence
    embedding[pos] += 1.0 / (index + 1); // Earlier words get more weight
    
    // Length feature
    embedding[(pos + 1) % 384] += word.length * 0.1;
    
    // Character diversity
    embedding[(pos + 2) % 384] += new Set(word).size * 0.2;
  });
  
  // Text-level features
  embedding[0] += text.length * 0.001; // Text length
  embedding[1] += words.length * 0.01;  // Word count
  embedding[2] += (text.match(/[.!?]/g) || []).length * 0.1; // Sentence count
  
  // Normalize the embedding
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }
  
  return embedding;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

function saveEmbedding(promptId, embedding, model = 'text-embedding-3-small') {
  return new Promise((resolve, reject) => {
    const embeddingBuffer = Buffer.from(embedding.buffer);
    
    db.run(
      `INSERT OR REPLACE INTO prompt_embeddings 
       (prompt_id, embedding, embedding_model, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [promptId, embeddingBuffer, model],
      function(err) {
        if (err) return reject(err);
        resolve({ promptId, model });
      }
    );
  });
}

function getEmbedding(promptId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT embedding, embedding_model FROM prompt_embeddings WHERE prompt_id = ?',
      [promptId],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        
        const embedding = new Float32Array(row.embedding.buffer);
        resolve({ embedding, model: row.embedding_model });
      }
    );
  });
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function semanticSearch(query, limit = 10) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Get all embeddings
    const embeddings = await new Promise((resolve, reject) => {
      db.all(
        `SELECT pe.prompt_id, pe.embedding, p.title, p.content, p.category
         FROM prompt_embeddings pe
         JOIN prompts p ON pe.prompt_id = p.id`,
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
    
    // Calculate similarities and rank
    const results = embeddings.map(row => {
      const embedding = new Float32Array(row.embedding.buffer);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      
      return {
        id: row.prompt_id,
        title: row.title,
        content: row.content,
        category: row.category,
        similarity,
        search_type: 'semantic'
      };
    });
    
    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error in semantic search:', error);
    throw error;
  }
}

async function generateAndSaveEmbedding(promptId) {
  try {
    const prompt = await getPromptById(promptId);
    const text = `${prompt.title} ${prompt.content}`;
    const embedding = await generateEmbedding(text);
    await saveEmbedding(promptId, embedding);
    return { success: true, promptId };
  } catch (error) {
    console.error(`Error generating embedding for prompt ${promptId}:`, error);
    return { success: false, promptId, error: error.message };
  }
}

async function generateEmbeddingsForAllPrompts() {
  try {
    const prompts = await getAllPrompts();
    const results = [];
    
    console.log(`Generating embeddings for ${prompts.length} prompts...`);
    
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`Processing ${i + 1}/${prompts.length}: ${prompt.title}`);
      
      const result = await generateAndSaveEmbedding(prompt.id);
      results.push(result);
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Embedding generation complete: ${successful} successful, ${failed} failed`);
    return { successful, failed, results };
    
  } catch (error) {
    console.error('Error generating embeddings for all prompts:', error);
    throw error;
  }
}

async function ftsSearch(query, { category } = {}) {
  return new Promise((resolve, reject) => {
    // Use FTS5 for search with custom ranking
    let sqlQuery = `
      SELECT 
        p.*,
        (
          -- Title matches get highest weight (4x)
          CASE WHEN p.title LIKE ? THEN 4.0 ELSE 0.0 END +
          -- Content matches get medium weight (2x)  
          CASE WHEN p.content LIKE ? THEN 2.0 ELSE 0.0 END +
          -- Category matches get low weight (1x)
          CASE WHEN p.category LIKE ? THEN 1.0 ELSE 0.0 END +
          -- Recency boost (newer prompts get slight boost)
          (julianday('now') - julianday(p.updated_at)) * -0.1 +
          -- Base FTS rank (higher = better match)
          rank * 10
        ) as search_rank
      FROM prompts p
      JOIN prompts_fts fts ON p.rowid = fts.rowid
      WHERE prompts_fts MATCH ?
    `;
    
    let searchParam = `%${query}%`;
    let ftsQuery = query.endsWith('*') ? query : query + '*';
    let params = [searchParam, searchParam, searchParam, ftsQuery];

    if (category) {
      sqlQuery += ' AND p.category = ?';
      params.push(category);
    }

    sqlQuery += ' ORDER BY search_rank DESC, p.updated_at DESC';

    db.all(sqlQuery, params, (err, rows) => {
      if (err) {
        console.error('Error in FTS search:', err);
        return reject(err);
      }
      resolve(rows);
    });
  });
}

async function hybridSearch(query, { category, limit = 10, ftsWeight = 0.6, semanticWeight = 0.4 } = {}) {
  try {
    console.log(`Hybrid search for: "${query}"`);

    // Run both searches in parallel
    const [ftsResults, semanticResults] = await Promise.all([
      ftsSearch(query, { category }),
      semanticSearch(query, limit * 2) // Get more semantic results for better selection
    ]);

    console.log(`FTS results: ${ftsResults.length}, Semantic results: ${semanticResults.length}`);
    
    // Create a map to track results and avoid duplicates
    const resultMap = new Map();

    // Add FTS results with search type indicator
    ftsResults.forEach((result, index) => {
      const normalizedScore = 1 - (index / Math.max(ftsResults.length, 1)); // Normalize rank to 0-1
      resultMap.set(result.id, {
        ...result,
        fts_score: normalizedScore,
        semantic_score: 0,
        search_types: ['fts'],
        hybrid_score: normalizedScore * ftsWeight
      });
    });

    // Add or merge semantic results
    semanticResults.forEach((result) => {
      const normalizedScore = result.similarity; // Already 0-1 from cosine similarity
      
      if (resultMap.has(result.id)) {
        // Merge with existing FTS result
        const existing = resultMap.get(result.id);
        existing.semantic_score = normalizedScore;
        existing.search_types.push('semantic');
        existing.hybrid_score = (existing.fts_score * ftsWeight) + (normalizedScore * semanticWeight);
      } else {
        // Add as semantic-only result
        resultMap.set(result.id, {
          ...result,
          fts_score: 0,
          semantic_score: normalizedScore,
          search_types: ['semantic'],
          hybrid_score: normalizedScore * semanticWeight
        });
      }
    });

    // Convert to array and sort by hybrid score
    const hybridResults = Array.from(resultMap.values())
      .sort((a, b) => b.hybrid_score - a.hybrid_score)
      .slice(0, limit)
      .map(result => ({
        ...result,
        search_type: result.search_types.length > 1 ? 'hybrid' : result.search_types[0],
        scores: {
          fts: result.fts_score,
          semantic: result.semantic_score,
          hybrid: result.hybrid_score
        }
      }));
    
    console.log(`Hybrid results: ${hybridResults.length}`);
    return hybridResults;
    
  } catch (error) {
    console.error('Error in hybrid search:', error);
    throw error;
  }
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
  generateEmbedding,
  saveEmbedding,
  getEmbedding,
  semanticSearch,
  generateAndSaveEmbedding,
  generateEmbeddingsForAllPrompts,
  hybridSearch,
  ftsSearch,
  getDbInstance: () => db 
}; 