import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ChatModule } from '../src/chat/chat.module';
import { RecipesModule } from '../src/recipes/recipes.module';
import * as fs from 'fs';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let existsSyncSpy: jest.SpyInstance;
  let readFileSyncSpy: jest.SpyInstance;

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
      if (p.includes('recipes_list.json'))
        return JSON.stringify({ recipes: [{ id: '1', name: '测试菜' }] });
      if (p.includes('recipes_full.json'))
        return JSON.stringify({ recipes: [{ id: '1', name: '测试菜', ingredients: [], steps: [] }] });
      if (p.includes('recipes_by_category.json'))
        return JSON.stringify({ categories: [{ name: '测试', count: 1, recipes: [] }] });
      if (p.includes('ingredients_index.json'))
        return JSON.stringify({ ingredients: [{ name: '测试食材', frequency: 1 }] });
      if (p.includes('metadata.json'))
        return JSON.stringify({ total_recipes: 1 });
      return '{}';
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          location: ':memory:',
          entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
          synchronize: true,
        }),
        ConfigModule.forRoot({ isGlobal: true }),
        ScheduleModule.forRoot(),
        AuthModule,
        ChatModule,
        RecipesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    existsSyncSpy.mockRestore();
    readFileSyncSpy.mockRestore();
    await app.close();
  });

  describe('Auth Endpoints', () => {
    it('/auth/register (POST) - success', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'e2euser', password: 'password123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('注册成功');
          expect(res.body.userId).toBeDefined();
        });
    });

    it('/auth/register (POST) - duplicate user', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'dupuser', password: 'password123' });

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'dupuser', password: 'password123' })
        .expect(401);
    });

    it('/auth/login (POST) - success', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'loginuser', password: 'password123' });

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'loginuser', password: 'password123' })
        .expect(200)
        .expect((res) => {
          expect(res.body.access_token).toBeDefined();
          expect(res.body.user.username).toBe('loginuser');
        });
    });

    it('/auth/login (POST) - wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'wrongpassuser', password: 'password123' });

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'wrongpassuser', password: 'wrong' })
        .expect(401);
    });
  });

  describe('Recipes Endpoints', () => {
    it('/recipes (GET)', () => {
      return request(app.getHttpServer())
        .get('/recipes')
        .expect(200)
        .expect((res) => {
          expect(res.body.total).toBe(1);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/recipes/categories (GET)', () => {
      return request(app.getHttpServer())
        .get('/recipes/categories')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('/recipes/metadata (GET)', () => {
      return request(app.getHttpServer())
        .get('/recipes/metadata')
        .expect(200)
        .expect((res) => {
          expect(res.body.total_recipes).toBe(1);
        });
    });

    it('/recipes/ingredients (GET)', () => {
      return request(app.getHttpServer())
        .get('/recipes/ingredients?search=测试')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('/recipes/:id (GET) - success', () => {
      return request(app.getHttpServer())
        .get('/recipes/1')
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('测试菜');
        });
    });

    it('/recipes/:id (GET) - not found', () => {
      return request(app.getHttpServer())
        .get('/recipes/not-exist')
        .expect(404);
    });

    it('/recipes/update (POST) - unauthorized without token', () => {
      return request(app.getHttpServer())
        .post('/recipes/update')
        .expect(401);
    });

    it('/recipes/update (POST) - success with token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'updateuser', password: 'password123' });

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'updateuser', password: 'password123' });

      const token = login.body.access_token;

      return request(app.getHttpServer())
        .post('/recipes/update')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('Chat Endpoints', () => {
    it('/chat (POST) - unauthorized without token', () => {
      return request(app.getHttpServer())
        .post('/chat')
        .send({ messages: [{ role: 'user', content: '你好' }] })
        .expect(401);
    });

    it('/chat (POST) - success with token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'chatuser', password: 'password123' });

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'chatuser', password: 'password123' });

      const token = login.body.access_token;

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'AI回复' } }],
        }),
      } as any);

      return request(app.getHttpServer())
        .post('/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ messages: [{ role: 'user', content: '你好' }] })
        .expect(201)
        .expect((res) => {
          expect(res.body.content).toBe('AI回复');
        });
    });
  });

  describe('CORS & App Bootstrap', () => {
    it('should start successfully and respond to health-like requests', () => {
      return request(app.getHttpServer())
        .get('/recipes')
        .expect(200);
    });
  });
});
