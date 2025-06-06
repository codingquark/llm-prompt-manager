require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');

// Import database functions
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

// Database setup - Handled by db.js
// const dbPath = path.join(__dirname, 'prompts.db');
// const dbInstance = new sqlite3.Database(dbPath); // Renamed to dbInstance to avoid conflict, then removed

// Initialize database tables - Handled by db.js
// dbInstance.serialize(() => { ... }); // Removed

// API Routes

// Get all prompts
app.get('/api/prompts', async (req, res) => {
  try {
    const prompts = await db.getAllPrompts(req.query);
    res.json(prompts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single prompt
app.get('/api/prompts/:id', async (req, res) => {
  try {
    const prompt = await db.getPromptById(req.params.id);
    if (prompt) {
      res.json(prompt);
    } else {
      res.status(404).json({ error: 'Prompt not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new prompt
app.post('/api/prompts', async (req, res) => {
  try {
    const newPrompt = await db.createPrompt(req.body);
    res.status(201).json(newPrompt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update prompt
app.put('/api/prompts/:id', async (req, res) => {
  try {
    const updatedPrompt = await db.updatePrompt(req.params.id, req.body);
    if (updatedPrompt) {
      res.json(updatedPrompt);
    } else {
      res.status(404).json({ error: 'Prompt not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get prompt versions
app.get('/api/prompts/:id/versions', async (req, res) => {
  try {
    const versions = await db.getPromptVersions(req.params.id);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific prompt version
app.get('/api/prompts/:id/versions/:versionNumber', async (req, res) => {
  try {
    const version = await db.getPromptVersion(req.params.id, parseInt(req.params.versionNumber));
    res.json(version);
  } catch (err) {
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Restore prompt to specific version
app.post('/api/prompts/:id/restore/:versionNumber', async (req, res) => {
  try {
    const { change_reason } = req.body;
    const restoredPrompt = await db.restorePromptVersion(
      req.params.id, 
      parseInt(req.params.versionNumber),
      change_reason
    );
    res.json(restoredPrompt);
  } catch (err) {
    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Delete prompt
app.delete('/api/prompts/:id', async (req, res) => {
  try {
    const success = await db.deletePrompt(req.params.id);
    if (success) {
      res.json({ message: 'Prompt deleted successfully' });
    } else {
      res.status(404).json({ error: 'Prompt not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Semantic search
app.post('/api/search/semantic', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await db.semanticSearch(query, limit);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hybrid search (combines FTS and semantic)
app.post('/api/search/hybrid', async (req, res) => {
  try {
    const { query, category, limit = 10, ftsWeight = 0.6, semanticWeight = 0.4 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await db.hybridSearch(query, { category, limit, ftsWeight, semanticWeight });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FTS-only search
app.post('/api/search/fts', async (req, res) => {
  try {
    const { query, category, limit = 10 } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await db.ftsSearch(query, { category });
    res.json(results.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate embeddings for all prompts
app.post('/api/embeddings/generate-all', async (req, res) => {
  try {
    const result = await db.generateEmbeddingsForAllPrompts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate embedding for specific prompt
app.post('/api/prompts/:id/embedding', async (req, res) => {
  try {
    const result = await db.generateAndSaveEmbedding(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.getAllCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new category
app.post('/api/categories', async (req, res) => {
  try {
    const newCategory = await db.createCategory(req.body);
    res.status(201).json(newCategory);
  } catch (err) {
    if (err.message === 'Category already exists') {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Export prompts
app.get('/api/export', async (req, res) => {
  try {
    const exportData = await db.exportData();
    res.json(exportData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import prompts
app.post('/api/import', async (req, res) => {
  try {
    const result = await db.importData(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all prompts
app.delete('/api/prompts', async (req, res) => {
  try {
    const result = await db.deleteAllPrompts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get LLM suggestions for prompt
app.post('/api/prompts/suggestions', async (req, res) => {
  const { content, category } = req.body;
  
  if (!content || content.trim().length < 10) {
    return res.status(400).json({ error: 'Content must be at least 10 characters long' });
  }

  try {
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Anthropic API key not found, using fallback suggestions');
      return res.json(generateFallbackSuggestions(content, category));
    }

    // Call Anthropic API for suggestions
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', // Updated to Claude 4 Sonnet
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze this prompt and provide suggestions for improvement. Return your response as JSON with the following structure:

{
  "improvements": ["suggestion1", "suggestion2", "suggestion3"],
  "readabilityScore": 85,
  "suggestions": {
    "clarity": "specific clarity suggestion",
    "specificity": "specific specificity suggestion", 
    "constraints": "specific constraints suggestion"
  }
}

Prompt to analyze:
Category: ${category || 'Not specified'}
Content: ${content}

Focus on:
1. How to make the prompt clearer and more specific
2. What examples or constraints could be added
3. A readability score from 1-100
4. Specific actionable improvements`
        }]
      })
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.text();
      console.error('Anthropic API error:', anthropicResponse.status, errorData);
      
      // Return fallback suggestions instead of failing completely
      return res.json(generateFallbackSuggestions(content, category));
    }

    const anthropicData = await anthropicResponse.json();
    
    // Check if response has expected structure
    if (!anthropicData.content || !anthropicData.content[0] || !anthropicData.content[0].text) {
      console.error('Unexpected Anthropic API response structure:', anthropicData);
      return res.json(generateFallbackSuggestions(content, category));
    }

    const aiContent = anthropicData.content[0].text;
    
    // Parse the JSON response from Claude
    let suggestions;
    try {
      // Clean the response by removing markdown formatting
      const cleanedContent = aiContent
        .replace(/```json\n?/g, '')  // Remove opening ```json
        .replace(/```\n?/g, '')      // Remove closing ```
        .trim();                     // Remove any extra whitespace
      
      suggestions = JSON.parse(cleanedContent);
      
      // Validate required fields
      if (!suggestions.improvements || !Array.isArray(suggestions.improvements)) {
        throw new Error('Invalid improvements field');
      }
      if (typeof suggestions.readabilityScore !== 'number') {
        suggestions.readabilityScore = Math.min(100, Math.max(40, 100 - Math.floor(content.length / 20)));
      }
      if (!suggestions.suggestions || typeof suggestions.suggestions !== 'object') {
        suggestions.suggestions = {
          clarity: "Consider breaking down complex instructions into bullet points",
          specificity: "Add more context about the expected output format",
          constraints: "Specify any limitations or requirements for the response"
        };
      }
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent, parseError);
      return res.json(generateFallbackSuggestions(content, category));
    }

    // Add estimated tokens
    suggestions.estimatedTokens = Math.ceil(content.length / 4);

    res.json(suggestions);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    
    // Return fallback suggestions if API fails
    res.json(generateFallbackSuggestions(content, category));
  }
});

// Helper function to generate fallback suggestions
function generateFallbackSuggestions(content, category) {
  const contentLength = content.length;
  const wordCount = content.split(/\s+/).length;
  
  // Generate context-aware suggestions based on content analysis
  const improvements = [
    contentLength < 50 ? "Consider expanding your prompt with more specific details" : "Consider adding specific examples to make the prompt more concrete",
    wordCount < 10 ? "Add more context about what you want to achieve" : "You might want to specify the desired output format",
    "Try adding constraints or limitations to get more focused responses"
  ];

  return {
    improvements,
    estimatedTokens: Math.ceil(contentLength / 4),
    readabilityScore: Math.min(100, Math.max(40, 100 - Math.floor(contentLength / 20))),
    suggestions: {
      clarity: "Consider breaking down complex instructions into bullet points",
      specificity: "Add more context about the expected output format",
      constraints: "Specify any limitations or requirements for the response"
    }
  };
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
async function startServer() {
  try {
    await db.setupDatabase(); // Initialize and connect to DB
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(1);
  }
}

// Catch-all handler: send back React's index.html file for any non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  try {
    await db.closeDb();
    console.log('Database connection closed through app shutdown.');
    process.exit(0);
  } catch (err) {
    console.error('Error closing database connection:', err.message);
    process.exit(1);
  }
}); 