process.env.DB_PATH = ':memory:';
const db = require('../db');

beforeAll(async () => {
  await db.setupDatabase();
});

afterAll(async () => {
  await db.closeDb();
});

describe('database module', () => {
  test('create and fetch prompt', async () => {
    const prompt = await db.createPrompt({
      title: 'Test',
      content: 'Hello world',
      category: 'General',
      tags: ['tag1', 'tag2']
    });

    const fetched = await db.getPromptById(prompt.id);
    expect(fetched.title).toBe('Test');
    expect(fetched.content).toBe('Hello world');
    expect(fetched.tags).toEqual(['tag1', 'tag2']);
  });

  test('updatePrompt stores previous version', async () => {
    const prompt = await db.createPrompt({
      title: 'VersionTest',
      content: 'Original',
      category: null,
      tags: []
    });

    await db.updatePrompt(prompt.id, {
      title: 'VersionTest',
      content: 'Updated',
      category: 'Test',
      tags: ['a'],
      change_reason: 'update'
    });

    const versions = await db.getPromptVersions(prompt.id);
    expect(versions.length).toBe(1);
    expect(versions[0].content).toBe('Original');
  });

  test('deletePrompt removes prompt', async () => {
    const prompt = await db.createPrompt({
      title: 'Delete',
      content: 'To be removed',
      category: null,
      tags: []
    });

    const deleted = await db.deletePrompt(prompt.id);
    expect(deleted).toBe(true);
    await expect(db.getPromptById(prompt.id)).rejects.toThrow();
  });

  describe('FTS search functionality', () => {
    beforeEach(async () => {
      // Clean up any existing prompts first
      await db.deleteAllPrompts();
      
      // Create test prompts for search tests
      await db.createPrompt({
        title: 'JavaScript Coding Helper',
        content: 'Help me write JavaScript code for React components',
        category: 'Coding',
        tags: ['javascript', 'react', 'frontend']
      });
      
      await db.createPrompt({
        title: 'Python Data Analysis',
        content: 'Analyze data using Python pandas and matplotlib',
        category: 'Coding',
        tags: ['python', 'data', 'analysis']
      });
      
      await db.createPrompt({
        title: 'Creative Writing Assistant',
        content: 'Help me write creative stories and narratives',
        category: 'Writing',
        tags: ['creative', 'stories', 'fiction']
      });
    });

    test('search by title returns weighted results', async () => {
      const results = await db.getAllPrompts({ search: 'JavaScript' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('JavaScript Coding Helper');
      expect(results[0].search_rank).toBeDefined();
    });

    test('search by content finds matches', async () => {
      const results = await db.getAllPrompts({ search: 'React' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('JavaScript Coding Helper');
    });

    test('search by tags works correctly', async () => {
      const results = await db.getAllPrompts({ search: 'python' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Python Data Analysis');
    });

    test('general search finds multiple matches', async () => {
      const results = await db.getAllPrompts({ search: 'code' });
      expect(results.length).toBeGreaterThan(0);
      // Should find JavaScript prompt due to "code" in content
      expect(results.some(r => r.title === 'JavaScript Coding Helper')).toBe(true);
    });

    test('search with category filter works', async () => {
      const results = await db.getAllPrompts({ search: 'data', category: 'Coding' });
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Python Data Analysis');
    });

    test('no search term returns all prompts without ranking', async () => {
      const results = await db.getAllPrompts();
      expect(results.length).toBeGreaterThanOrEqual(3);
      // Should not have search_rank when no search
      expect(results[0].search_rank).toBeUndefined();
    });

    test('search ranking prioritizes title matches', async () => {
      // Create two prompts: one with term in title, one with term only in content
      await db.createPrompt({
        title: 'Machine Learning Guide',
        content: 'Basic introduction to AI concepts',
        category: 'Education',
        tags: ['ai', 'education']
      });
      
      await db.createPrompt({
        title: 'Programming Tutorial',
        content: 'Learn machine learning with Python',
        category: 'Education', 
        tags: ['programming', 'tutorial']
      });

      const results = await db.getAllPrompts({ search: 'machine learning' });
      expect(results.length).toBe(2);
      // Title match should rank higher than content match
      expect(results[0].title).toBe('Machine Learning Guide');
      expect(results[0].search_rank).toBeGreaterThan(results[1].search_rank);
    });
  });
});
