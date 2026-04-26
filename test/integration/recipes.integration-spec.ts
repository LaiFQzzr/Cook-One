import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { RecipesModule } from '../../src/recipes/recipes.module';
import { AuthModule } from '../../src/auth/auth.module';
import * as fs from 'fs';

describe('Recipes Integration', () => {
  let app: INestApplication;
  let authToken: string;
  let existsSyncSpy: jest.SpyInstance;
  let readFileSyncSpy: jest.SpyInstance;

  const mockRecipesList = {
    recipes: Array.from({ length: 5 }, (_, i) => ({
      id: `cat_${i}`,
      name: `菜谱${i}`,
      category: '荤菜',
      category_en: 'meat_dish',
      difficulty: 2,
      description: `描述${i}`,
      image: '',
      tags: ['荤菜'],
      ingredient_count: 3,
      step_count: 4,
    })),
  };

  const mockRecipesFull = {
    recipes: mockRecipesList.recipes.map((r: any) => ({
      ...r,
      ingredients: [{ name: '肉', amount: '100g' }],
      steps: [{ step_number: 1, description: '步骤1' }],
    })),
  };

  const mockByCategory = {
    categories: [
      { name: '荤菜', count: 5, recipes: mockRecipesFull.recipes },
    ],
  };

  const mockIngredients = {
    ingredients: [{ name: '猪肉', frequency: 10, categories: ['荤菜'] }],
  };

  const mockMetadata = { total_recipes: 5, version: '1.0' };

  beforeAll(async () => {
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      const p = path.toString();
      if (p.includes('sql.js') || p.endsWith('.wasm')) return originalExistsSync(path);
      return true;
    });
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((path: any, options?: any) => {
      const p = path.toString();
      if (p.includes('sql.js') || p.endsWith('.wasm')) return originalReadFileSync(path, options);
      if (p.includes('recipes_list.json')) return JSON.stringify(mockRecipesList);
      if (p.includes('recipes_full.json')) return JSON.stringify(mockRecipesFull);
      if (p.includes('recipes_by_category.json')) return JSON.stringify(mockByCategory);
      if (p.includes('ingredients_index.json')) return JSON.stringify(mockIngredients);
      if (p.includes('metadata.json')) return JSON.stringify(mockMetadata);
      return '{}';
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          location: ':memory:',
          entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
          synchronize: true,
        }),
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        AuthModule,
        RecipesModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 注册并登录获取 token
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'integration', password: 'test123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'integration', password: 'test123' });

    authToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    await app.close();
  });

  it('GET /recipes should return paginated list', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes?page=1&limit=2')
      .expect(200);

    expect(res.body.total).toBe(5);
    expect(res.body.data.length).toBe(2);
    expect(res.body.page).toBe(1);
  });

  it('GET /recipes/categories should return categories', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes/categories')
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('荤菜');
  });

  it('GET /recipes/metadata should return metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes/metadata')
      .expect(200);

    expect(res.body.total_recipes).toBe(5);
  });

  it('GET /recipes/ingredients should search ingredients', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes/ingredients?search=猪肉')
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('猪肉');
  });

  it('GET /recipes/:id should return recipe detail', async () => {
    const res = await request(app.getHttpServer())
      .get('/recipes/cat_0')
      .expect(200);

    expect(res.body.name).toBe('菜谱0');
    expect(res.body.ingredients).toBeDefined();
  });

  it('GET /recipes/:id should return 404 for non-existent id', async () => {
    await request(app.getHttpServer())
      .get('/recipes/not_exist')
      .expect(404);
  });

  it('POST /recipes/update should trigger update (requires auth)', async () => {
    await request(app.getHttpServer())
      .post('/recipes/update')
      .expect(401);

    const res = await request(app.getHttpServer())
      .post('/recipes/update')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
