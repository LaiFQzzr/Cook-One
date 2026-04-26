import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { AchievementsService } from '../achievements/achievements.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly achievementsService: AchievementsService,
  ) {}

  /**
   * 用户注册
   */
  async register(username: string, password: string) {
    const existing = await this.userRepository.findOne({
      where: { username },
    });

    if (existing) {
      throw new UnauthorizedException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
    });

    await this.userRepository.save(user);

    // 初始化用户成就记录
    try {
      await this.achievementsService.initUserAchievements(user.id);
    } catch (e) {
      // 成就初始化失败不影响注册主流程
    }

    return { message: '注册成功', userId: user.id };
  }

  /**
   * 用户登录，返回JWT Token
   */
  async login(username: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = { sub: user.id, username: user.username };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  /**
   * 验证JWT Token
   */
  async validateUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return { id: user.id, username: user.username };
  }
}
