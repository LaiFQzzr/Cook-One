import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingItem } from './entities/shopping-item.entity';
import { Recipe } from '../recipes/entities/recipe.entity';

export interface AddShoppingItemDto {
  ingredient_name: string;
  amount?: string;
  unit?: string;
  note?: string;
  recipeId?: string;
  mealPlanId?: number;
}

export interface BatchAddFromRecipeDto {
  recipeId: string;
  servingsAdjust?: number;
  mealPlanId?: number;
}

@Injectable()
export class ShoppingService {
  constructor(
    @InjectRepository(ShoppingItem)
    private readonly shoppingItemRepo: Repository<ShoppingItem>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
  ) {}

  /**
   * 获取用户的采购清单
   */
  async findByUser(userId: string, includeChecked = true) {
    const query = this.shoppingItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.recipe', 'recipe')
      .where('item.userId = :userId', { userId })
      .orderBy('item.isChecked', 'ASC')
      .addOrderBy('item.sort_order', 'ASC')
      .addOrderBy('item.createdAt', 'DESC');

    if (!includeChecked) {
      query.andWhere('item.isChecked = :checked', { checked: false });
    }

    return query.getMany();
  }

  /**
   * 添加单个采购项
   */
  async addItem(userId: string, dto: AddShoppingItemDto) {
    const item = this.shoppingItemRepo.create({
      userId,
      ingredient_name: dto.ingredient_name,
      amount: dto.amount ?? '',
      unit: dto.unit ?? '',
      note: dto.note ?? '',
      recipeId: dto.recipeId ?? null,
      mealPlanId: dto.mealPlanId ?? null,
    });
    return this.shoppingItemRepo.save(item);
  }

  /**
   * 从菜谱批量添加食材到采购单
   */
  async batchAddFromRecipe(userId: string, dto: BatchAddFromRecipeDto) {
    const recipe = await this.recipeRepo.findOne({
      where: { id: dto.recipeId },
    });

    if (!recipe) {
      throw new NotFoundException('菜谱不存在');
    }

    const ingredients = recipe.ingredients ?? [];
    const adjust = dto.servingsAdjust ?? 1;
    const items: ShoppingItem[] = [];

    for (const ing of ingredients) {
      const item = this.shoppingItemRepo.create({
        userId,
        ingredient_name: ing.name,
        amount: adjust > 1 ? `${ing.amount} ×${adjust}` : ing.amount,
        note: ing.note ?? '',
        recipeId: dto.recipeId,
        mealPlanId: dto.mealPlanId ?? null,
      });
      items.push(item);
    }

    return this.shoppingItemRepo.save(items);
  }

  /**
   * 更新采购项
   */
  async updateItem(
    userId: string,
    itemId: number,
    dto: Partial<AddShoppingItemDto>,
  ) {
    const item = await this.shoppingItemRepo.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('采购项不存在');
    }

    Object.assign(item, dto);
    return this.shoppingItemRepo.save(item);
  }

  /**
   * 勾选/取消勾选
   */
  async toggleCheck(userId: string, itemId: number) {
    const item = await this.shoppingItemRepo.findOne({
      where: { id: itemId, userId },
    });

    if (!item) {
      throw new NotFoundException('采购项不存在');
    }

    item.isChecked = !item.isChecked;
    return this.shoppingItemRepo.save(item);
  }

  /**
   * 删除采购项
   */
  async removeItem(userId: string, itemId: number) {
    const result = await this.shoppingItemRepo.delete({ id: itemId, userId });
    if (result.affected === 0) {
      throw new NotFoundException('采购项不存在');
    }
    return { deleted: true };
  }

  /**
   * 清空已勾选项
   */
  async clearChecked(userId: string) {
    await this.shoppingItemRepo.delete({ userId, isChecked: true });
    return { cleared: true };
  }

  /**
   * 清空所有
   */
  async clearAll(userId: string) {
    await this.shoppingItemRepo.delete({ userId });
    return { cleared: true };
  }
}
