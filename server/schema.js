const { sqliteTable, text, integer, blob } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

// Main prompts table
const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Prompt versions table for history tracking
const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey(),
  prompt_id: text('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  version_number: integer('version_number').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  change_reason: text('change_reason')
});

// Categories table
const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  color: text('color').default('#3B82F6'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// Embeddings table for semantic search
const promptEmbeddings = sqliteTable('prompt_embeddings', {
  prompt_id: text('prompt_id').primaryKey().references(() => prompts.id, { onDelete: 'cascade' }),
  embedding: blob('embedding').notNull(),
  embedding_model: text('embedding_model').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

module.exports = {
  prompts,
  promptVersions,
  categories,
  promptEmbeddings
};