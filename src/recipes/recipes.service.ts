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
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
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
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepo: Repository<RecipeIngredient>,
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

    // 同步食材数据到独立表
    await this.syncIngredientsToDatabase(recipes);

    this.logger.log(`Synced ${synced} recipes to database`);
    return { synced };
  }

  /**
   * 同步食材及食谱-食材关联到独立表
   */
  private async syncIngredientsToDatabase(recipes: any[]): Promise<void> {
    // 1. 收集所有唯一食材名称（拆分复合食材）
    const ingredientNameSet = new Set<string>();
    for (const r of recipes) {
      const ingredients: any[] = r.ingredients ?? [];
      for (const ing of ingredients) {
        if (ing.name) {
          const subNames = this.splitIngredientName(ing.name.trim());
          for (const n of subNames) {
            ingredientNameSet.add(n);
          }
        }
      }
    }

    if (ingredientNameSet.size === 0) {
      return;
    }

    // 2. 批量 upsert 食材主表
    const ingredientNames = Array.from(ingredientNameSet);
    const ingredientEntities = ingredientNames.map((name) =>
      this.ingredientRepo.create({ name }),
    );

    await this.ingredientRepo.upsert(ingredientEntities, ['name']);

    // 3. 查询所有食材建立 name -> id 映射
    const allIngredients = await this.ingredientRepo.find();
    const ingredientMap = new Map<string, number>();
    for (const ing of allIngredients) {
      ingredientMap.set(ing.name, ing.id);
    }

    // 4. 构建并 upsert 食谱-食材关联表（拆分复合食材）
    const recipeIngredientEntities: RecipeIngredient[] = [];
    for (const r of recipes) {
      const ingredients: any[] = r.ingredients ?? [];
      for (const ing of ingredients) {
        const rawName = ing.name?.trim();
        if (!rawName) continue;

        const subNames = this.splitIngredientName(rawName);
        for (const name of subNames) {
          const ingredientId = ingredientMap.get(name);
          if (!ingredientId) continue;

          recipeIngredientEntities.push(
            this.recipeIngredientRepo.create({
              recipe_id: r.id,
              ingredient_id: ingredientId,
              amount: ing.amount ?? null,
              is_optional: ing.is_optional ?? false,
              note: ing.note ?? null,
            }),
          );
        }
      }
    }

    if (recipeIngredientEntities.length > 0) {
      await this.recipeIngredientRepo.upsert(recipeIngredientEntities, [
        'recipe_id',
        'ingredient_id',
      ]);
    }

    this.logger.log(
      `Synced ${ingredientNames.length} ingredients and ${recipeIngredientEntities.length} recipe-ingredient relations`,
    );
  }

  /**
   * 拆分复合食材名称
   *
   * 例如：
   * - "油、盐、生抽、老抽" -> ["油", "盐", "生抽", "老抽"]
   * - "白醋/米醋" -> ["白醋", "米醋"]
   * - "黑虎虾 or 明虾" -> ["黑虎虾", "明虾"]
   * - "肉蟹 1 只  份数" -> ["肉蟹"]
   * - "葱 = 一根大葱" -> ["葱"]
   */
  private splitIngredientName(rawName: string): string[] {
    if (!rawName) return [];

    // 替换替代分隔符为顿号
    let text = rawName
      .replace(/\s+or\s+/gi, '、')
      .replace(/\s*\/\s*/g, '、')
      .replace(/\s*\+\s*/g, '、');

    // 按分隔符拆分
    const parts = text.split(/[、，,]/);

    const results: string[] = [];
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      // 去掉前缀标记
      part = part.replace(/^(主料|辅料|必备|可选|必选|工具)[：:]?\s*/i, '');

      // 去掉括号及内容
      part = part.replace(/[（(][^）)]*[）)]/g, '');

      // 去掉 = 或 : 后面的内容（保留前面）
      const colonIndex = part.search(/[:=：＝]/);
      if (colonIndex > 0) {
        part = part.substring(0, colonIndex).trim();
      }

      // 过滤注释行
      if (/^注[：:]?/.test(part)) continue;

      // 过滤纯数字
      if (/^\d+(\.\d+)?$/.test(part)) continue;

      // 过滤纯操作/状态词
      const skipPatterns = [
        /小火/, /中火/, /大火/, /文火/, /武火/,
        /三成热/, /五成热/, /七成热/, /八成热/,
        /油温/, /少许/, /适量/, /若干/, /备用/, /待用/,
        /根据口味/, /根据喜好/, /^等等$/, /^约$/, /^左右$/,
      ];
      if (skipPatterns.some((p) => p.test(part))) continue;

      // 去掉尾部阿拉伯数字+单位/量词
      part = part.replace(
        /\s+\d[\d\s\.\-/~×xX\+\=]*[gmlkL个只份勺瓶包袋盒罐条根片块头尾把株颗粒碗盘杯张件套双打捆扎斤两钱吨磅cm毫米微米纳米]?$/i,
        '',
      );
      // 去掉尾部中文数字+常见量词
      part = part.replace(
        /\s+[一二两三四五六七八九十百千万亿]+[个只份勺瓶包袋盒罐条根片块头尾把株颗粒碗盘杯张件套双]+$/,
        '',
      );
      // 去掉尾部常见量词/描述
      part = part.replace(/\s+(份数|适量|少许|若干|备用|待用|约|左右)$/i, '');

      part = part.trim();
      if (part && part.length >= 1) {
        results.push(part);
      }
    }

    return results;
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
   * 搜索食材（基于内存索引）
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
   * 获取某个菜谱所需的所有食材及用量（从独立表查询）
   */
  async getRecipeIngredients(recipeId: string): Promise<{
    recipeId: string;
    ingredients: Array<{
      id: number;
      name: string;
      amount: string | null;
      is_optional: boolean;
      note: string | null;
    }>;
  }> {
    const recipe = await this.recipeRepo.findOne({
      where: { id: recipeId },
    });
    if (!recipe) {
      throw new HttpException('菜谱不存在', HttpStatus.NOT_FOUND);
    }

    const relations = await this.recipeIngredientRepo.find({
      where: { recipe_id: recipeId },
      relations: ['ingredient'],
      order: { id: 'ASC' },
    });

    return {
      recipeId,
      ingredients: relations.map((ri) => ({
        id: ri.ingredient.id,
        name: ri.ingredient.name,
        amount: ri.amount,
        is_optional: ri.is_optional,
        note: ri.note,
      })),
    };
  }

  /**
   * 获取食材列表（从独立表查询）
   */
  async getIngredients(options?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    total: number;
    page: number;
    limit: number;
    data: Ingredient[];
  }> {
    const limit = Math.min(options?.limit ?? 20, 100);
    const page = options?.page ?? 1;

    const qb = this.ingredientRepo.createQueryBuilder('i');

    if (options?.search) {
      qb.where('i.name LIKE :search', { search: `%${options.search}%` });
    }

    if (options?.category) {
      if (options.search) {
        qb.andWhere('i.category = :category', { category: options.category });
      } else {
        qb.where('i.category = :category', { category: options.category });
      }
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('i.name', 'ASC')
      .getMany();

    return { total, page, limit, data };
  }

  /**
   * 获取使用某食材的所有菜谱
   */
  async getRecipesByIngredient(
    ingredientId: number,
    options?: { page?: number; limit?: number },
  ): Promise<{
    ingredientId: number;
    ingredientName: string;
    total: number;
    page: number;
    limit: number;
    recipes: Array<{
      id: string;
      name: string;
      category: string;
      amount: string | null;
      is_optional: boolean;
      note: string | null;
    }>;
  }> {
    const ingredient = await this.ingredientRepo.findOne({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      throw new HttpException('食材不存在', HttpStatus.NOT_FOUND);
    }

    const limit = Math.min(options?.limit ?? 20, 100);
    const page = options?.page ?? 1;

    const qb = this.recipeIngredientRepo
      .createQueryBuilder('ri')
      .leftJoinAndSelect('ri.recipe', 'recipe')
      .where('ri.ingredient_id = :ingredientId', { ingredientId })
      .orderBy('recipe.name', 'ASC');

    const total = await qb.getCount();
    const relations = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      ingredientId,
      ingredientName: ingredient.name,
      total,
      page,
      limit,
      recipes: relations.map((ri) => ({
        id: ri.recipe.id,
        name: ri.recipe.name,
        category: ri.recipe.category,
        amount: ri.amount,
        is_optional: ri.is_optional,
        note: ri.note,
      })),
    };
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
