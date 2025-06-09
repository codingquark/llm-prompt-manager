process.env.DB_PATH=':memory:';
const request = require('supertest');
const { app } = require('../index');
const db = require('../db');

beforeAll(async () => {
  await db.setupDatabase();
});

afterAll(async () => {
  await db.closeDb();
});

describe('Prompts CRUD endpoints', () => {
  let promptId;

  test('create prompt', async () => {
    const res = await request(app)
      .post('/api/prompts')
      .send({ title: 'Test', content: 'Initial content for prompt', category: 'General' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    promptId = res.body.id;
  });

  test('get created prompt', async () => {
    const res = await request(app).get(`/api/prompts/${promptId}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test');
  });

  test('update prompt', async () => {
    const res = await request(app)
      .put(`/api/prompts/${promptId}`)
      .send({ title: 'Test', content: 'Updated content', category: 'General' });
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Updated content');
  });

  test('list prompts', async () => {
    const res = await request(app).get('/api/prompts');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('delete prompt', async () => {
    const res = await request(app).delete(`/api/prompts/${promptId}`);
    expect(res.status).toBe(200);
    const check = await request(app).get(`/api/prompts/${promptId}`);
    expect(check.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Category endpoints', () => {
  test('get categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('create category', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: 'TestCat', color: '#ffffff' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('TestCat');
  });
});

describe('Export and import', () => {
  test('export then import prompts', async () => {
    // create one prompt to export
    const createRes = await request(app)
      .post('/api/prompts')
      .send({ title: 'Exported', content: 'to be exported', category: 'General' });
    expect(createRes.status).toBe(201);

    const exportRes = await request(app).get('/api/export');
    expect(exportRes.status).toBe(200);
    const data = exportRes.body;
    expect(data.prompts.length).toBeGreaterThan(0);

    await request(app).delete('/api/prompts');
    const emptyRes = await request(app).get('/api/prompts');
    expect(emptyRes.body.length).toBe(0);

    const importRes = await request(app).post('/api/import').send(data);
    expect(importRes.status).toBe(200);

    const listRes = await request(app).get('/api/prompts');
    expect(listRes.body.length).toBeGreaterThan(0);
  });
});

describe('Suggestion endpoint', () => {
  test('returns suggestions', async () => {
    const res = await request(app)
      .post('/api/prompts/suggestions')
      .send({ content: 'This is a prompt that definitely has more than ten characters.', category: 'General' });
    expect(res.status).toBe(200);
    expect(res.body.improvements).toBeDefined();
    expect(res.body.readabilityScore).toBeDefined();
  });
});
