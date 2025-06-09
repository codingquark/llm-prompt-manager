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
      category: 'General'
    });

    const fetched = await db.getPromptById(prompt.id);
    expect(fetched.title).toBe('Test');
    expect(fetched.content).toBe('Hello world');
    expect(fetched.category).toBe('General');
  });

  test('updatePrompt stores previous version', async () => {
    const prompt = await db.createPrompt({
      title: 'VersionTest',
      content: 'Original',
      category: null
    });

    await db.updatePrompt(prompt.id, {
      title: 'VersionTest',
      content: 'Updated',
      category: 'Test',
      change_reason: 'update'
    });

    const versions = await db.getPromptVersions(prompt.id);
    expect(versions.length).toBe(2); // Initial version + update version
    expect(versions[0].content).toBe('Original'); // Most recent version first (descending order)
  });

  test('deletePrompt removes prompt', async () => {
    const prompt = await db.createPrompt({
      title: 'Delete',
      content: 'To be removed',
      category: null
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
        category: 'Coding'
      });
      
      await db.createPrompt({
        title: 'Python Data Analysis',
        content: 'Analyze data using Python pandas and matplotlib',
        category: 'Coding'
      });
      
      await db.createPrompt({
        title: 'Creative Writing Assistant',
        content: 'Help me write creative stories and narratives',
        category: 'Writing'
      });
    });

    test('search by title returns weighted results', async () => {
      const results = await db.getAllPrompts({ search: 'JavaScript' });
      expect(results.some(r => r.title === 'JavaScript Coding Helper')).toBe(true);
      const match = results.find(r => r.title === 'JavaScript Coding Helper');
      expect(match.search_rank).toBeDefined();
    });

    test('search by content finds matches', async () => {
      const results = await db.getAllPrompts({ search: 'React' });
      expect(results.some(r => r.title === 'JavaScript Coding Helper')).toBe(true);
    });

    test('search in content works correctly', async () => {
      const results = await db.getAllPrompts({ search: 'python' });
      expect(results.some(r => r.title === 'Python Data Analysis')).toBe(true);
    });

    test('general search finds multiple matches', async () => {
      const results = await db.getAllPrompts({ search: 'code' });
      expect(results.length).toBeGreaterThan(0);
      // Should find JavaScript prompt due to "code" in content
      expect(results.some(r => r.title === 'JavaScript Coding Helper')).toBe(true);
    });

    test('search with category filter works', async () => {
      const results = await db.getAllPrompts({ search: 'data', category: 'Coding' });
      expect(results.some(r => r.title === 'Python Data Analysis')).toBe(true);
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
        category: 'Education'
      });
      
      await db.createPrompt({
        title: 'Programming Tutorial',
        content: 'Learn machine learning with Python',
        category: 'Education'
      });

      const results = await db.getAllPrompts({ search: 'machine learning' });
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Title match should rank higher than content match
      const first = results[0];
      const second = results[1];
      expect(first.title).toBe('Machine Learning Guide');
      expect(first.search_rank).toBeGreaterThan(second.search_rank);
    });
  });
});
