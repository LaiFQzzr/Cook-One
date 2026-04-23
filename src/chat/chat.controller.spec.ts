import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let service: ChatService;

  const mockChatService = {
    chat: jest.fn().mockResolvedValue('AI回复内容'),
    chatStream: jest.fn().mockImplementation(async function* () {
      yield '你好';
      yield '！';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('chat', () => {
    it('should return chat response', async () => {
      const body = { messages: [{ role: 'user' as const, content: '你好' }] };
      const result = await controller.chat(body);
      expect(service.chat).toHaveBeenCalledWith({
        messages: body.messages,
        model: undefined,
      });
      expect(result).toEqual({ content: 'AI回复内容' });
    });
  });

  describe('chatStream', () => {
    it('should write SSE stream to response', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
      };

      const body = { messages: [{ role: 'user' as const, content: '你好' }] };
      await controller.chatStream(body, mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ token: '你好' })}\n\n`,
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify({ token: '！' })}\n\n`,
      );
      expect(mockRes.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
