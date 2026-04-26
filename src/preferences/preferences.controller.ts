import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PreferencesService } from './preferences.service';

class UpsertPreferenceDto {
  @IsString()
  key: string;

  @IsString()
  value: string;
}

class BatchUpsertDto {
  items: UpsertPreferenceDto[];
}

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * GET /preferences
   * 获取当前用户所有偏好
   */
  @Get()
  async findAll(@CurrentUser('sub') userId: string) {
    return this.preferencesService.findByUser(userId);
  }

  /**
   * GET /preferences/:key
   * 获取单个偏好值
   */
  @Get(':key')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('key') key: string,
  ) {
    const value = await this.preferencesService.findOne(userId, key);
    return { key, value };
  }

  /**
   * PUT /preferences
   * 新增或更新偏好（单条）
   */
  @Put()
  async upsert(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpsertPreferenceDto,
  ) {
    return this.preferencesService.upsert(userId, dto);
  }

  /**
   * PUT /preferences/batch
   * 批量更新偏好
   */
  @Put('batch')
  async upsertBatch(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchUpsertDto,
  ) {
    return this.preferencesService.upsertMany(userId, dto.items ?? []);
  }

  /**
   * DELETE /preferences/:key
   * 删除指定偏好
   */
  @Delete(':key')
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('key') key: string,
  ) {
    return this.preferencesService.remove(userId, key);
  }

  /**
   * POST /preferences/clear
   * 清空所有偏好
   */
  @Post('clear')
  @HttpCode(HttpStatus.OK)
  async clear(@CurrentUser('sub') userId: string) {
    return this.preferencesService.clear(userId);
  }
}
