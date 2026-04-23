import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { AuthModule } from '../../src/auth/auth.module';
import { ChatModule } from '../../src/chat/chat.module';

describe('Auth + Chat Integration', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              QIANWEN_API_KEY: 'sk-test-key',
              QIANWEN_MODEL: 'qwen-turbo',
              JWT_SECRET: 'test-secret',
              JWT_EXPIRES_IN: '7d',
            }),
          ],
        }),
        AuthModule,
        ChatModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // 注册
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'chatuser', password: 'test123' });

    // 登录
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'chatuser', password: 'test123' });

    authToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register and login a user', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'newchatuser', password: 'test123' })
      .expect(201);

    expect(registerRes.body.message).toBe('注册成功');
    expect(registerRes.body.userId).toBeDefined();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'newchatuser', password: 'test123' })
      .expect(200);

    expect(loginRes.body.access_token).toBeDefined();
    expect(loginRes.body.user.username).toBe('newchatuser');
  });

  it('should reject chat without auth', async () => {
    await request(app.getHttpServer())
      .post('/chat')
      .send({ messages: [{ role: 'user', content: '你好' }] })
      .expect(401);
  });

  it('should call chat with auth (mocked AI)', async () => {
    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Mocked AI Response' } }],
      }),
    } as any);

    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messages: [{ role: 'user', content: '你好' }] })
      .expect(201);

    expect(res.body.content).toBe('Mocked AI Response');
    expect(mockFetch).toHaveBeenCalled();

    mockFetch.mockRestore();
  });

  it('should call chat stream with auth', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    let index = 0;

    const mockReader = {
      read: jest.fn().mockImplementation(() => {
        if (index >= chunks.length) {
          return Promise.resolve({ done: true, value: undefined });
        }
        const value = encoder.encode(chunks[index++]);
        return Promise.resolve({ done: false, value });
      }),
    };

    const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const res = await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ messages: [{ role: 'user', content: 'test' }] })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(res.text).toContain('Hello');
    expect(res.text).toContain('[DONE]');

    mockFetch.mockRestore();
  });
});
