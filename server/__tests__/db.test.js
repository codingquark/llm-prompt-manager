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
});
