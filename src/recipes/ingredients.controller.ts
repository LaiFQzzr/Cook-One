import {
  Controller,
  Get,
  Query,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly recipesService: RecipesService) {}

  /**
   * GET /ingredients
   * 获取食材列表（支持分页和名称搜索）
   */
  @Get()
  async getIngredients(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recipesService.getIngredients({
      search,
      category,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /ingredients/:id/recipes
   * 获取使用某食材的所有菜谱
   */
  @Get(':id/recipes')
  async getRecipesByIngredient(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const ingredientId = parseInt(id, 10);
    if (isNaN(ingredientId)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: '食材ID必须是数字',
      };
    }
    return this.recipesService.getRecipesByIngredient(ingredientId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
