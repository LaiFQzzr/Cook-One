import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AchievementsService } from './achievements.service';

class UpdateProgressDto {
  @IsString()
  code: string;

  @IsNumber()
  progress: number;
}

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  /**
   * GET /achievements/definitions
   * 获取所有成就定义
   */
  @Get('definitions')
  async getDefinitions() {
    return this.achievementsService.findAllDefinitions();
  }

  /**
   * GET /achievements/my
   * 获取当前用户的成就列表
   */
  @Get('my')
  async getMyAchievements(@CurrentUser('sub') userId: string) {
    return this.achievementsService.findUserAchievements(userId);
  }

  /**
   * POST /achievements/progress
   * 更新指定成就进度（测试/管理用，通常由业务自动触发）
   */
  @Post('progress')
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.achievementsService.updateProgress(
      userId,
      dto.code,
      dto.progress,
    );
  }
}
