import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MealPlansService } from './meal-plans.service';
import { MealPlanStatus } from './entities/meal-plan.entity';

class CreateMealPlanDto {
  @IsDateString()
  planDate: string;

  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack'])
  @IsOptional()
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsString({ each: true })
  recipeIds: string[];
}

class UpdateMealPlanDto {
  @IsDateString()
  @IsOptional()
  planDate?: string;

  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack'])
  @IsOptional()
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';

  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(['planned', 'completed', 'cancelled'])
  @IsOptional()
  status?: MealPlanStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  recipeIds?: string[];
}

@Controller('meal-plans')
@UseGuards(JwtAuthGuard)
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  /**
   * POST /meal-plans
   * 创建备餐计划
   */
  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateMealPlanDto,
  ) {
    return this.mealPlansService.create(userId, dto);
  }

  /**
   * GET /meal-plans
   * 查询备餐计划列表
   */
  @Get()
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query('status') status?: MealPlanStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.mealPlansService.findByUser(userId, { status, fromDate, toDate });
  }

  /**
   * GET /meal-plans/:id
   * 获取单个备餐计划
   */
  @Get(':id')
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mealPlansService.findOne(userId, id);
  }

  /**
   * PATCH /meal-plans/:id
   * 更新备餐计划
   */
  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMealPlanDto,
  ) {
    return this.mealPlansService.update(userId, id, dto);
  }

  /**
   * DELETE /meal-plans/:id
   * 删除备餐计划
   */
  @Delete(':id')
  async remove(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mealPlansService.remove(userId, id);
  }

  /**
   * GET /meal-plans/:id/ingredients
   * 获取该计划下所有菜谱的食材汇总
   */
  @Get(':id/ingredients')
  async getIngredients(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.mealPlansService.getPlanIngredients(userId, id);
  }
}
