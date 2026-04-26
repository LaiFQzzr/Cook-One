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
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ShoppingService } from './shopping.service';

class AddItemDto {
  @IsString()
  ingredient_name: string;

  @IsString()
  @IsOptional()
  amount?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  recipeId?: string;
}

class BatchFromRecipeDto {
  @IsString()
  recipeId: string;

  @IsNumber()
  @IsOptional()
  servingsAdjust?: number;
}

class UpdateItemDto {
  @IsString()
  @IsOptional()
  ingredient_name?: string;

  @IsString()
  @IsOptional()
  amount?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

@Controller('shopping')
@UseGuards(JwtAuthGuard)
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  /**
   * GET /shopping?includeChecked=true
   * 获取当前用户的采购清单
   */
  @Get()
  async getList(
    @CurrentUser('sub') userId: string,
    @Query('includeChecked') includeChecked?: string,
  ) {
    return this.shoppingService.findByUser(
      userId,
      includeChecked !== 'false',
    );
  }

  /**
   * POST /shopping
   * 手动添加采购项
   */
  @Post()
  async addItem(@CurrentUser('sub') userId: string, @Body() dto: AddItemDto) {
    return this.shoppingService.addItem(userId, dto);
  }

  /**
   * POST /shopping/from-recipe
   * 从菜谱批量添加食材
   */
  @Post('from-recipe')
  async addFromRecipe(
    @CurrentUser('sub') userId: string,
    @Body() dto: BatchFromRecipeDto,
  ) {
    return this.shoppingService.batchAddFromRecipe(userId, {
      recipeId: dto.recipeId,
      servingsAdjust: dto.servingsAdjust,
    });
  }

  /**
   * PATCH /shopping/:id
   * 修改采购项
   */
  @Patch(':id')
  async updateItem(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.shoppingService.updateItem(userId, id, dto);
  }

  /**
   * POST /shopping/:id/toggle
   * 勾选/取消勾选
   */
  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleCheck(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.shoppingService.toggleCheck(userId, id);
  }

  /**
   * DELETE /shopping/:id
   * 删除采购项
   */
  @Delete(':id')
  async removeItem(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.shoppingService.removeItem(userId, id);
  }

  /**
   * POST /shopping/clear-checked
   * 清空已勾选
   */
  @Post('clear-checked')
  @HttpCode(HttpStatus.OK)
  async clearChecked(@CurrentUser('sub') userId: string) {
    return this.shoppingService.clearChecked(userId);
  }

  /**
   * POST /shopping/clear-all
   * 清空全部
   */
  @Post('clear-all')
  @HttpCode(HttpStatus.OK)
  async clearAll(@CurrentUser('sub') userId: string) {
    return this.shoppingService.clearAll(userId);
  }
}
