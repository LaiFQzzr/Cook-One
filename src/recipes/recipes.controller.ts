import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RecipesService } from './recipes.service';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  /**
   * POST /recipes/update
   * 手动触发菜谱数据更新（需要JWT认证）
   */
  @Post('update')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateRecipes() {
    return this.recipesService.updateRecipes();
  }

  /**
   * GET /recipes
   * 获取菜谱列表（支持分页和分类筛选）
   */
  @Get()
  async getRecipes(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recipesService.getRecipesList({
      category,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /recipes/categories
   * 获取按分类组织的菜谱
   */
  @Get('categories')
  async getCategories() {
    return this.recipesService.getRecipesByCategory();
  }

  /**
   * GET /recipes/metadata
   * 获取菜谱元数据
   */
  @Get('metadata')
  async getMetadata() {
    return this.recipesService.getMetadata();
  }

  /**
   * GET /recipes/ingredients?search=
   * 搜索食材
   */
  @Get('ingredients')
  async searchIngredients(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.recipesService.searchIngredients(
      search,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  /**
   * GET /recipes/:id
   * 获取单个菜谱详情
   */
  @Get(':id')
  async getRecipeById(@Param('id') id: string) {
    return this.recipesService.getRecipeById(id);
  }

  /**
   * GET /recipes/:id/ingredients
   * 获取某个菜谱所需的所有食材及用量
   */
  @Get(':id/ingredients')
  async getRecipeIngredients(@Param('id') id: string) {
    return this.recipesService.getRecipeIngredients(id);
  }
}
