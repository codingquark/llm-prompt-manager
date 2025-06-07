const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
require('dotenv').config();

const { prompts, promptVersions, categories, promptEmbeddings } = require('./schema');
const { eq, like, desc, sql, count, and } = require('drizzle-orm');

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'prompts.db');
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

async function setupDatabase() {
  // Create tables if they don't exist
  await initializeTables();
  await seedDefaultCategories();
  await setupFTSTable();
  console.log('Database initialized successfully with Drizzle ORM');
}

async function initializeTables() {
  // Create prompts table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create prompt_versions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      change_reason TEXT,
      FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE,
      UNIQUE(prompt_id, version_number)
    )
  `);

  // Create categories table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create prompt_embeddings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS prompt_embeddings (
      prompt_id TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      embedding_model TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prompt_id) REFERENCES prompts (id) ON DELETE CASCADE
    )
  `);
}

async function setupFTSTable() {
  // Create FTS5 virtual table
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
      id UNINDEXED,
      title,
      content,
      category,
      created_at UNINDEXED,
      updated_at UNINDEXED,
      content='prompts',
      content_rowid='rowid'
    )
  `);

  // Create triggers to keep FTS table synchronized
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS prompts_fts_insert AFTER INSERT ON prompts BEGIN
      INSERT INTO prompts_fts(rowid, id, title, content, category, created_at, updated_at)
      VALUES (new.rowid, new.id, new.title, new.content, new.category, new.created_at, new.updated_at);
    END
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS prompts_fts_update AFTER UPDATE ON prompts BEGIN
      UPDATE prompts_fts SET 
        title = new.title,
        content = new.content,
        category = new.category,
        updated_at = new.updated_at
      WHERE rowid = new.rowid;
    END
  `);

  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS prompts_fts_delete AFTER DELETE ON prompts BEGIN
      DELETE FROM prompts_fts WHERE rowid = old.rowid;
    END
  `);

  // Populate FTS table with existing data
  sqlite.exec(`
    INSERT OR REPLACE INTO prompts_fts(rowid, id, title, content, category, created_at, updated_at)
    SELECT rowid, id, title, content, category, created_at, updated_at FROM prompts
  `);
}

async function seedDefaultCategories() {
  const defaultCategories = [
    { name: 'Writing', color: '#10B981' },
    { name: 'Coding', color: '#8B5CF6' },
    { name: 'Analysis', color: '#F59E0B' },
    { name: 'Creative', color: '#EF4444' },
    { name: 'General', color: '#6B7280' }
  ];

  for (const category of defaultCategories) {
    try {
      await db.insert(categories).values({
        id: uuidv4(),
        name: category.name,
        color: category.color
      }).onConflictDoNothing();
    } catch (err) {
      // Ignore duplicate category errors
    }
  }
}

// Internal helper to resolve a prompt ID (full or prefix)
async function _resolvePromptId(idInput) {
  if (!idInput || String(idInput).trim() === '') {
    throw new Error("Prompt ID or prefix cannot be empty.");
  }
  
  const idString = String(idInput);

  // Standard UUID length is 36 characters
  if (idString.length === 36) {
    const result = await db.select({ id: prompts.id })
      .from(prompts)
      .where(eq(prompts.id, idString))
      .limit(1);
    
    if (result.length === 0) {
      throw new Error(`Prompt with ID "${idString}" not found.`);
    }
    return result[0].id;
  } else if (idString.length > 0 && idString.length < 36) {
    const results = await db.select({ id: prompts.id })
      .from(prompts)
      .where(like(prompts.id, `${idString}%`));
    
    if (results.length === 1) {
      return results[0].id;
    } else if (results.length > 1) {
      throw new Error(`Ambiguous ID prefix "${idString}". ${results.length} prompts found. Please be more specific.`);
    } else {
      throw new Error(`No prompt found with ID prefix "${idString}".`);
    }
  } else {
    throw new Error(`Invalid ID or prefix provided: "${idString}".`);
  }
}

function closeDb() {
  sqlite.close();
  console.log('Database connection closed.');
}

module.exports = {
  db,
  sqlite,
  setupDatabase,
  closeDb,
  _resolvePromptId,
  // Export schema tables for use in other modules
  prompts,
  promptVersions,
  categories,
  promptEmbeddings
};