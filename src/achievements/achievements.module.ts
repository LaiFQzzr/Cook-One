import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { AchievementDefinition } from './entities/achievement-definition.entity';
import { UserAchievement } from './entities/user-achievement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AchievementDefinition, UserAchievement])],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
