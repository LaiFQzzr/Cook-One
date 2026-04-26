import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { runPythonScript } from '../common/utils/python-runner';
import { Recipe } from './entities/recipe.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecipesService implements OnModuleInit {
  private readonly logger = new Logger(RecipesService.name);
  private readonly outputDir = path.resolve(process.cwd(), 'scripts', 'output');
  private readonly scriptPath = path.join('scripts', 'parse_recipes.py');

  // 缓存数据，减少文件读取
  private cache: {
    list?: any[];
    full?: any[];
    byCategory?: any[];
    ingredients?: any[];
    metadata?: any;
    lastUpdate?: Date;
  } = {};

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
  ) {}

  /**
   * 应用启动时自动更新一次菜谱数据
   */
  async onModuleInit() {
    this.logger.log('RecipesService initialized, checking for data...');
    try {
      await this.loadData();
      await this.syncToDatabase();
      this.logger.log(`Loaded ${this.cache.list?.length ?? 0} recipes from cache`);
    } catch (error) {
      this.logger.warn(
        `Failed to load cached data: ${error.message}, will try to update...`,
      );
      try {
        await this.updateRecipes();
      } catch (updateError) {
        this.logger.error(
          `Initial update failed: ${updateError.message}`,
        );
      }
    }
  }

  /**
   * 定时任务：每天凌晨 3 点自动更新菜谱数据
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledUpdate() {
    this.logger.log('Running scheduled recipe update...');
    try {
      await this.updateRecipes();
      this.logger.log('Scheduled update completed successfully');
    } catch (error) {
      this.logger.error(`Scheduled update failed: ${error.message}`);
    }
  }

  /**
   * 手动触发更新菜谱数据（并同步到数据库）
   */
  async updateRecipes(): Promise<{
    success: boolean;
    message: string;
    total?: number;
  }> {
    try {
      this.logger.log('Starting recipe update...');

      await runPythonScript(this.scriptPath, [], {
        cwd: process.cwd(),
        timeout: 300000, // 5 分钟超时
      });

      await this.loadData();
      await this.syncToDatabase();

      return {
        success: true,
        message: '菜谱数据更新成功',
        total: this.cache.list?.length ?? 0,
      };
    } catch (error) {
      this.logger.error(`Update failed: ${error.message}`);
      throw new HttpException(
        `更新失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 将 JSON 缓存同步到数据库（UPSERT）
   */
  async syncToDatabase(): Promise<{ synced: number }> {
    const recipes = this.cache.full ?? [];
    if (recipes.length === 0) {
      return { synced: 0 };
    }

    let synced = 0;
    for (const r of recipes) {
      const exists = await this.recipeRepo.findOne({ where: { id: r.id } });
      const entity = this.recipeRepo.create({
        id: r.id,
        name: r.name,
        category: r.category,
        category_en: r.category_en,
        difficulty: r.difficulty ?? 0,
        difficulty_label: r.difficulty_label,
        description: r.description,
        servings: r.servings,
        image: r.image,
        ingredients: r.ingredients,
        steps: r.steps,
        tips: r.tips,
        nutrition: r.nutrition,
        tools: r.tools,
        tags: r.tags,
        references: r.references,
      });

      if (exists) {
        await this.recipeRepo.update({ id: r.id }, entity);
      } else {
        await this.recipeRepo.save(entity);
      }
      synced++;
    }

    this.logger.log(`Synced ${synced} recipes to database`);
    return { synced };
  }

  /**
   * 获取菜谱列表（轻量数据）
   */
  async getRecipesList(options?: {
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    total: number;
    page: number;
    limit: number;
    data: any[];
  }> {
    await this.ensureDataLoaded();

    let data = [...(this.cache.list ?? [])];

    if (options?.category) {
      data = data.filter(
        (r) =>
          r.category === options.category ||
          r.category_en === options.category,
      );
    }

    const total = data.length;
    const limit = Math.min(options?.limit ?? 20, 100);
    const page = options?.page ?? 1;
    const start = (page - 1) * limit;
    const paginated = data.slice(start, start + limit);

    return { total, page, limit, data: paginated };
  }

  /**
   * 获取单个菜谱详情（优先内存缓存）
   */
  async getRecipeById(id: string): Promise<any> {
    await this.ensureDataLoaded();

    const recipe = (this.cache.full ?? []).find((r) => r.id === id);
    if (!recipe) {
      throw new HttpException('菜谱不存在', HttpStatus.NOT_FOUND);
    }
    return recipe;
  }

  /**
   * 从数据库获取菜谱详情（供其他模块关联查询使用）
   */
  async getRecipeByIdFromDb(id: string): Promise<Recipe | null> {
    return this.recipeRepo.findOne({ where: { id } });
  }

  /**
   * 按分类获取菜谱
   */
  async getRecipesByCategory(): Promise<any[]> {
    await this.ensureDataLoaded();
    return this.cache.byCategory ?? [];
  }

  /**
   * 搜索食材
   */
  async searchIngredients(query?: string, limit = 20): Promise<any[]> {
    await this.ensureDataLoaded();

    let data = [...(this.cache.ingredients ?? [])];
    if (query) {
      const q = query.toLowerCase();
      data = data.filter((i) => i.name?.toLowerCase().includes(q));
    }
    return data.slice(0, limit);
  }

  /**
   * 获取元数据
   */
  async getMetadata(): Promise<any> {
    await this.ensureDataLoaded();
    return (
      this.cache.metadata ?? {
        total_recipes: this.cache.list?.length ?? 0,
        last_update: this.cache.lastUpdate,
      }
    );
  }

  /**
   * 确保数据已加载
   */
  private async ensureDataLoaded() {
    if (!this.cache.list) {
      await this.loadData();
    }
  }

  /**
   * 从 JSON 文件加载数据到内存缓存
   */
  private async loadData() {
    this.cache.list = this.readJsonFile('recipes_list.json')?.recipes ?? [];
    this.cache.full = this.readJsonFile('recipes_full.json')?.recipes ?? [];
    this.cache.byCategory =
      this.readJsonFile('recipes_by_category.json')?.categories ?? [];
    this.cache.ingredients =
      this.readJsonFile('ingredients_index.json')?.ingredients ?? [];
    this.cache.metadata = this.readJsonFile('metadata.json');
    this.cache.lastUpdate = new Date();
    this.logger.log('Recipe data loaded into memory cache');
  }

  private readJsonFile(filename: string): any {
    const filePath = path.join(this.outputDir, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.warn(`Failed to read ${filename}: ${error.message}`);
      return null;
    }
  }
}
