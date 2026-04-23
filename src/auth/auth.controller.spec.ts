import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({
      access_token: 'test-token',
      user: { id: 'user-1', username: 'test' },
    }),
    register: jest.fn().mockResolvedValue({
      message: '注册成功',
      userId: 'user-1',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login and return token', async () => {
      const dto = { username: 'test', password: '123456' };
      const result = await controller.login(dto);
      expect(service.login).toHaveBeenCalledWith('test', '123456');
      expect(result).toEqual({
        access_token: 'test-token',
        user: { id: 'user-1', username: 'test' },
      });
    });
  });

  describe('register', () => {
    it('should call authService.register and return success', async () => {
      const dto = { username: 'newuser', password: 'password123' };
      const result = await controller.register(dto);
      expect(service.register).toHaveBeenCalledWith('newuser', 'password123');
      expect(result).toEqual({ message: '注册成功', userId: 'user-1' });
    });
  });
});
