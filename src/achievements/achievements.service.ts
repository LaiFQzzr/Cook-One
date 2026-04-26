import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AchievementDefinition } from './entities/achievement-definition.entity';
import { UserAchievement } from './entities/user-achievement.entity';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(AchievementDefinition)
    private readonly achievementDefRepo: Repository<AchievementDefinition>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,
  ) {}

  /**
   * 获取所有成就定义
   */
  async findAllDefinitions() {
    return this.achievementDefRepo.find({ order: { sortOrder: 'ASC' } });
  }

  /**
   * 获取用户的所有成就（包含进度）
   */
  async findUserAchievements(userId: string) {
    const list = await this.userAchievementRepo.find({
      where: { userId },
      relations: ['achievement'],
      order: { createdAt: 'DESC' },
    });

    return list.map((ua) => ({
      id: ua.id,
      progress: ua.progress,
      achievedAt: ua.achievedAt,
      achievement: ua.achievement,
      isCompleted: !!ua.achievedAt,
    }));
  }

  /**
   * 获取用户已达成成就
   */
  async findCompletedAchievements(userId: string) {
    return this.userAchievementRepo.find({
      where: { userId, achievedAt: null },
      relations: ['achievement'],
      order: { achievedAt: 'DESC' },
    });
  }

  /**
   * 更新成就进度（内部调用）
   */
  async updateProgress(
    userId: string,
    achievementCode: string,
    progress: number,
  ) {
    const def = await this.achievementDefRepo.findOne({
      where: { code: achievementCode },
    });

    if (!def) {
      throw new NotFoundException('成就定义不存在');
    }

    let ua = await this.userAchievementRepo.findOne({
      where: { userId, achievementId: def.id },
    });

    if (!ua) {
      ua = this.userAchievementRepo.create({
        userId,
        achievementId: def.id,
        progress: 0,
      });
    }

    ua.progress = Math.max(ua.progress, progress);

    if (ua.progress >= def.conditionValue && !ua.achievedAt) {
      ua.achievedAt = new Date();
    }

    return this.userAchievementRepo.save(ua);
  }

  /**
   * 初始化用户成就记录（注册时调用）
   */
  async initUserAchievements(userId: string) {
    const defs = await this.achievementDefRepo.find();
    const entities = defs.map((def) =>
      this.userAchievementRepo.create({
        userId,
        achievementId: def.id,
        progress: 0,
      }),
    );
    return this.userAchievementRepo.save(entities);
  }

  /**
   * 检查并更新与菜谱相关的成就
   */
  async checkRecipeAchievements(userId: string) {
    // 实际场景中可由 meal-plans 服务在完成后调用
    // 此处仅提供入口
    return { checked: true, userId };
  }
}
