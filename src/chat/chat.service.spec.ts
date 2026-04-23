import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      const map: Record<string, any> = {
        QIANWEN_API_KEY: 'sk-test-key',
        QIANWEN_MODEL: 'qwen-turbo',
      };
      return map[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chat', () => {
    it('should return content on successful API call', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '你好，我是AI助手' } }],
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const result = await service.chat({
        messages: [{ role: 'user', content: '你好' }],
      });

      expect(result).toBe('你好，我是AI助手');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-key',
          }),
        }),
      );
    });

    it('should throw HttpException on API error', async () => {
      const mockResponse = {
        ok: false,
        text: jest.fn().mockResolvedValue('Bad Request'),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      await expect(
        service.chat({ messages: [{ role: 'user', content: 'test' }] }),
      ).rejects.toThrow(HttpException);
    });

    it('should throw HttpException on network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network Error'));

      await expect(
        service.chat({ messages: [{ role: 'user', content: 'test' }] }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('chatStream', () => {
    it('should yield tokens from SSE stream', async () => {
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"！"}}]}\n\n',
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

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const generator = service.chatStream({
        messages: [{ role: 'user', content: 'test' }],
      });

      const tokens: string[] = [];
      for await (const token of generator) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['你好', '！']);
    });

    it('should throw HttpException on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        text: jest.fn().mockResolvedValue('Error'),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);

      const generator = service.chatStream({
        messages: [{ role: 'user', content: 'test' }],
      });

      await expect(generator.next()).rejects.toThrow(HttpException);
    });
  });
});
