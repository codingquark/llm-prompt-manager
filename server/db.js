const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const { eq, like, desc, sql, count, and, asc } = require('drizzle-orm');

const { 
  db, 
  sqlite, 
  setupDatabase, 
  closeDb, 
  _resolvePromptId,
  prompts,
  promptVersions,
  categories,
  promptEmbeddings
} = require('./database');

// CRUD Operations
async function getAllPrompts({ category, search } = {}) {
  try {
    // If no search term, use simple query
    if (!search) {
      let query = db.select().from(prompts);
      
      if (category) {
        query = query.where(eq(prompts.category, category));
      }
      
      return await query.orderBy(desc(prompts.updated_at));
    }

    // Check if embeddings are available for hybrid search
    const embeddingResult = await db.select({ count: count() }).from(promptEmbeddings);
    const embeddingCount = embeddingResult[0].count;

    // Use hybrid search if embeddings are available, otherwise fall back to FTS
    if (embeddingCount > 0) {
      console.log(`Using hybrid search (${embeddingCount} embeddings available)`);
      return await hybridSearch(search, { category });
    } else {
      console.log('No embeddings available, using FTS search');
      return await ftsSearch(search, { category });
    }
  } catch (error) {
    throw error;
  }
}

async function getPromptById(idInput) {
  const fullId = await _resolvePromptId(idInput);
  const result = await db.select().from(prompts).where(eq(prompts.id, fullId)).limit(1);
  
  if (result.length === 0) {
    throw new Error(`Prompt ${fullId} was not found after ID resolution. This should not happen.`);
  }
  
  return result[0];
}

async function createPrompt({ title, content, category }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  // Insert the main prompt
  await db.insert(prompts).values({
    id,
    title,
    content,
    category,
    created_at: now,
    updated_at: now
  });
  
  // Create initial version
  await db.insert(promptVersions).values({
    id: uuidv4(),
    prompt_id: id,
    version_number: 1,
    title,
    content,
    category,
    created_at: now
  });
  
  // Generate embedding in the background
  generateAndSaveEmbedding(id).catch(err => {
    console.error(`Failed to generate embedding for new prompt ${id}:`, err);
  });
  
  // Return the created prompt
  const result = await db.select().from(prompts).where(eq(prompts.id, id)).limit(1);
  return result[0];
}

async function updatePrompt(idInput, dataToUpdate) {
  const fullId = await _resolvePromptId(idInput);
  const { title, content, category, change_reason } = dataToUpdate;
  
  // Get current prompt data for versioning
  const currentPrompt = await getPromptById(fullId);
  
  // Get the current version number for this prompt
  const versionResult = await db.select({ max_version: sql`MAX(${promptVersions.version_number})` })
    .from(promptVersions)
    .where(eq(promptVersions.prompt_id, fullId));
  
  const nextVersion = (versionResult[0]?.max_version || 0) + 1;
  
  // Create version record of current state before updating
  await db.insert(promptVersions).values({
    id: uuidv4(),
    prompt_id: fullId,
    version_number: nextVersion,
    title: currentPrompt.title,
    content: currentPrompt.content,
    category: currentPrompt.category,
    change_reason: change_reason || 'Updated prompt',
    created_at: new Date().toISOString()
  });
  
  // Update the main prompt
  await db.update(prompts)
    .set({
      title,
      content,
      category,
      updated_at: new Date().toISOString()
    })
    .where(eq(prompts.id, fullId));
  
  // Generate embedding in the background
  generateAndSaveEmbedding(fullId).catch(err => {
    console.error(`Failed to generate embedding for updated prompt ${fullId}:`, err);
  });
  
  // Return the updated prompt
  return await getPromptById(fullId);
}

async function deletePrompt(idInput) {
  const fullId = await _resolvePromptId(idInput);
  const result = await db.delete(prompts).where(eq(prompts.id, fullId));
  return result.changes > 0;
}

// Category operations
async function getAllCategories() {
  return await db.select().from(categories).orderBy(asc(categories.name));
}

async function createCategory({ name, color }) {
  const id = uuidv4();
  
  try {
    await db.insert(categories).values({
      id,
      name,
      color: color || '#3B82F6'
    });
    
    return { id, name, color: color || '#3B82F6' };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      throw new Error('Category already exists');
    }
    throw err;
  }
}

// Export/Import operations
async function exportData() {
  const promptsData = await db.select().from(prompts);
  const categoriesData = await db.select().from(categories);
  
  return {
    prompts: promptsData.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      created_at: row.created_at
    })),
    categories: categoriesData
  };
}

async function importData({ prompts: promptsData, categories: categoriesData }) {
  // Import categories first
  for (const category of categoriesData) {
    await db.insert(categories).values({
      id: category.id || uuidv4(),
      name: category.name,
      color: category.color,
      created_at: category.created_at || new Date().toISOString()
    }).onConflictDoUpdate({
      target: categories.id,
      set: {
        name: category.name,
        color: category.color,
        created_at: category.created_at || new Date().toISOString()
      }
    });
  }
  
  // Then import prompts
  for (const prompt of promptsData) {
    await db.insert(prompts).values({
      id: prompt.id || uuidv4(),
      title: prompt.title,
      content: prompt.content,
      category: prompt.category,
      created_at: prompt.created_at || new Date().toISOString()
    }).onConflictDoUpdate({
      target: prompts.id,
      set: {
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
        created_at: prompt.created_at || new Date().toISOString()
      }
    });
  }
  
  return { success: true, message: 'Data imported successfully' };
}

async function deleteAllPrompts() {
  const result = await db.delete(prompts);
  return { message: 'All prompts deleted successfully', count: result.changes };
}

// Version history operations
async function getPromptVersions(idInput) {
  const fullId = await _resolvePromptId(idInput);
  
  return await db.select()
    .from(promptVersions)
    .where(eq(promptVersions.prompt_id, fullId))
    .orderBy(desc(promptVersions.version_number));
}

async function getPromptVersion(idInput, versionNumber) {
  const fullId = await _resolvePromptId(idInput);
  
  const result = await db.select()
    .from(promptVersions)
    .where(and(
      eq(promptVersions.prompt_id, fullId),
      eq(promptVersions.version_number, versionNumber)
    ))
    .limit(1);
  
  if (result.length === 0) {
    throw new Error(`Version ${versionNumber} not found for prompt ${fullId}`);
  }
  
  return result[0];
}

async function restorePromptVersion(idInput, versionNumber, change_reason) {
  const fullId = await _resolvePromptId(idInput);
  
  // Get the version to restore
  const versionToRestore = await getPromptVersion(fullId, versionNumber);
  if (!versionToRestore) {
    throw new Error(`Version ${versionNumber} not found for prompt ${fullId}`);
  }
  
  // Create new version with current state
  const currentPrompt = await getPromptById(fullId);
  
  await db.insert(promptVersions).values({
    id: uuidv4(),
    prompt_id: fullId,
    version_number: versionToRestore.version_number + 1,
    title: currentPrompt.title,
    content: currentPrompt.content,
    category: currentPrompt.category,
    created_at: new Date().toISOString(),
    change_reason
  });
  
  // Update prompt with restored version
  await db.update(prompts)
    .set({
      title: versionToRestore.title,
      content: versionToRestore.content,
      category: versionToRestore.category,
      updated_at: new Date().toISOString()
    })
    .where(eq(prompts.id, fullId));
  
  // Return the restored prompt
  return await getPromptById(fullId);
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

async function saveEmbedding(promptId, embedding, model = 'text-embedding-3-small') {
  const embeddingBuffer = Buffer.from(embedding.buffer);
  
  await db.insert(promptEmbeddings).values({
    prompt_id: promptId,
    embedding: embeddingBuffer,
    embedding_model: model,
    updated_at: new Date().toISOString()
  }).onConflictDoUpdate({
    target: promptEmbeddings.prompt_id,
    set: {
      embedding: embeddingBuffer,
      embedding_model: model,
      updated_at: new Date().toISOString()
    }
  });
  
  return { promptId, model };
}

async function getEmbedding(promptId) {
  const result = await db.select()
    .from(promptEmbeddings)
    .where(eq(promptEmbeddings.prompt_id, promptId))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  const row = result[0];
  const embedding = new Float32Array(row.embedding.buffer);
  return { embedding, model: row.embedding_model };
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
    
    // Get all embeddings with prompt data
    const results = sqlite.prepare(`
      SELECT pe.prompt_id, pe.embedding, p.title, p.content, p.category
      FROM prompt_embeddings pe
      JOIN prompts p ON pe.prompt_id = p.id
    `).all();
    
    // Calculate similarities and rank
    const scoredResults = results.map(row => {
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
    return scoredResults
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
    const allPrompts = await getAllPrompts();
    const results = [];
    
    console.log(`Generating embeddings for ${allPrompts.length} prompts...`);
    
    for (let i = 0; i < allPrompts.length; i++) {
      const prompt = allPrompts[i];
      console.log(`Processing ${i + 1}/${allPrompts.length}: ${prompt.title}`);
      
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

  return sqlite.prepare(sqlQuery).all(...params);
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