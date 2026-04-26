import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealPlan, MealPlanStatus } from './entities/meal-plan.entity';
import { MealPlanRecipe } from './entities/meal-plan-recipe.entity';
import { Recipe } from '../recipes/entities/recipe.entity';


export interface CreateMealPlanDto {
  planDate: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  note?: string;
  recipeIds: string[];
}

export interface UpdateMealPlanDto {
  planDate?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  note?: string;
  status?: MealPlanStatus;
  recipeIds?: string[];
}

@Injectable()
export class MealPlansService {
  constructor(
    @InjectRepository(MealPlan)
    private readonly mealPlanRepo: Repository<MealPlan>,
    @InjectRepository(MealPlanRecipe)
    private readonly mealPlanRecipeRepo: Repository<MealPlanRecipe>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
  ) {}

  /**
   * 创建备餐计划（自动将食材加入采购单）
   */
  async create(userId: string, dto: CreateMealPlanDto) {
    const plan = this.mealPlanRepo.create({
      userId,
      planDate: new Date(dto.planDate),
      mealType: dto.mealType ?? 'lunch',
      note: dto.note ?? '',
      status: 'planned',
    });

    const saved = await this.mealPlanRepo.save(plan);

    // 关联菜谱
    if (dto.recipeIds?.length) {
      const recipes = await this.recipeRepo.findByIds(dto.recipeIds);
      const mprs = recipes.map((r) =>
        this.mealPlanRecipeRepo.create({
          mealPlanId: saved.id,
          recipeId: r.id,
        }),
      );
      saved.mealPlanRecipes = await this.mealPlanRecipeRepo.save(mprs);
    }

    return this.findOne(userId, saved.id);
  }

  /**
   * 获取用户的备餐计划列表
   */
  async findByUser(userId: string, options?: { status?: MealPlanStatus; fromDate?: string; toDate?: string }) {
    const query = this.mealPlanRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.mealPlanRecipes', 'mpr')
      .leftJoinAndSelect('mpr.recipe', 'recipe')
      .where('plan.userId = :userId', { userId })
      .orderBy('plan.planDate', 'DESC')
      .addOrderBy('plan.mealType', 'ASC');

    if (options?.status) {
      query.andWhere('plan.status = :status', { status: options.status });
    }
    if (options?.fromDate) {
      query.andWhere('plan.planDate >= :fromDate', { fromDate: options.fromDate });
    }
    if (options?.toDate) {
      query.andWhere('plan.planDate <= :toDate', { toDate: options.toDate });
    }

    return query.getMany();
  }

  /**
   * 获取单个备餐计划详情
   */
  async findOne(userId: string, planId: number) {
    const plan = await this.mealPlanRepo.findOne({
      where: { id: planId, userId },
      relations: ['mealPlanRecipes', 'mealPlanRecipes.recipe'],
    });

    if (!plan) {
      throw new NotFoundException('备餐计划不存在');
    }

    return plan;
  }

  /**
   * 更新备餐计划
   */
  async update(userId: string, planId: number, dto: UpdateMealPlanDto) {
    const plan = await this.findOne(userId, planId);

    if (dto.planDate) plan.planDate = new Date(dto.planDate);
    if (dto.mealType) plan.mealType = dto.mealType;
    if (dto.note !== undefined) plan.note = dto.note;
    if (dto.status) plan.status = dto.status;

    const saved = await this.mealPlanRepo.save(plan);

    // 更新关联菜谱
    if (dto.recipeIds) {
      await this.mealPlanRecipeRepo.delete({ mealPlanId: planId });
      const recipes = await this.recipeRepo.findByIds(dto.recipeIds);
      const mprs = recipes.map((r) =>
        this.mealPlanRecipeRepo.create({
          mealPlanId: saved.id,
          recipeId: r.id,
        }),
      );
      await this.mealPlanRecipeRepo.save(mprs);
    }

    return this.findOne(userId, saved.id);
  }

  /**
   * 删除备餐计划
   */
  async remove(userId: string, planId: number) {
    const plan = await this.findOne(userId, planId);
    await this.mealPlanRepo.remove(plan);
    return { deleted: true };
  }

  /**
   * 获取某计划下所有菜谱的食材列表（用于采购单）
   */
  async getPlanIngredients(userId: string, planId: number) {
    const plan = await this.findOne(userId, planId);
    const ingredients: Array<{
      name: string;
      amount: string;
      note: string;
      recipeId: string;
      recipeName: string;
    }> = [];

    for (const mpr of plan.mealPlanRecipes ?? []) {
      const recipe = mpr.recipe;
      if (!recipe || !recipe.ingredients) continue;
      for (const ing of recipe.ingredients) {
        ingredients.push({
          name: ing.name,
          amount: ing.amount,
          note: ing.note ?? '',
          recipeId: recipe.id,
          recipeName: recipe.name,
        });
      }
    }

    return { planId, ingredients };
  }
}
