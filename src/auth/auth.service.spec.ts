import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_EXPIRES_IN') return '7d';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);

    // 清理 mock 调用记录
    mockJwtService.sign.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await service.register('newuser', 'password123');
      expect(result).toHaveProperty('message', '注册成功');
      expect(result).toHaveProperty('userId');
    });

    it('should throw UnauthorizedException if username already exists', async () => {
      await service.register('duplicate', 'password123');
      await expect(service.register('duplicate', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      await service.register('logintest', 'password123');
      const result = await service.login('logintest', 'password123');
      expect(result).toHaveProperty('access_token', 'test-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('username', 'logintest');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      await expect(service.login('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      await service.register('wrongpass', 'password123');
      await expect(service.login('wrongpass', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user info for valid userId', async () => {
      const reg = await service.register('validuser', 'password123');
      const user = await service.validateUser(reg.userId);
      expect(user).toHaveProperty('username', 'validuser');
    });

    it('should return null for invalid userId', async () => {
      const user = await service.validateUser('invalid-id');
      expect(user).toBeNull();
    });
  });
});
