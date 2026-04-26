import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { AchievementsService } from '../achievements/achievements.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let userRepository: any;

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

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAchievementsService = {
    initUserAchievements: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: AchievementsService,
          useValue: mockAchievementsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    userRepository = module.get(getRepositoryToken(User));

    // 清理 mock
    mockJwtService.sign.mockClear();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        id: 'user-uuid',
        username: 'newuser',
        password: 'hashed',
      });
      mockUserRepository.save.mockResolvedValue({
        id: 'user-uuid',
        username: 'newuser',
      });

      const result = await service.register('newuser', 'password123');
      expect(result).toHaveProperty('message', '注册成功');
      expect(result).toHaveProperty('userId', 'user-uuid');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if username already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'existing-id',
        username: 'duplicate',
      });

      await expect(
        service.register('duplicate', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should login with correct credentials', async () => {
      const hashedPassword =
        '$2a$10$abcdefghijklmnopqrstuuxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // bcrypt hash of 'password123'
      // 使用真实的 bcrypt hash 来测试 compare
      const bcrypt = require('bcryptjs');
      const realHash = await bcrypt.hash('password123', 10);

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        username: 'logintest',
        password: realHash,
      });

      const result = await service.login('logintest', 'password123');
      expect(result).toHaveProperty('access_token', 'test-token');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('username', 'logintest');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login('nonexistent', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      const bcrypt = require('bcryptjs');
      const realHash = await bcrypt.hash('correctpassword', 10);

      mockUserRepository.findOne.mockResolvedValue({
        id: 'user-id',
        username: 'wrongpass',
        password: realHash,
      });

      await expect(
        service.login('wrongpass', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('should return user info for valid userId', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 'valid-id',
        username: 'validuser',
      });

      const user = await service.validateUser('valid-id');
      expect(user).toHaveProperty('username', 'validuser');
    });

    it('should return null for invalid userId', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const user = await service.validateUser('invalid-id');
      expect(user).toBeNull();
    });
  });
});
