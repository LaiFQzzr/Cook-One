import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Recipe } from './recipe.entity';
import { Ingredient } from './ingredient.entity';

/**
 * 食谱-食材关联表
 * 记录每个食谱所需的具体食材及用量
 */
@Entity('recipe_ingredients')
export class RecipeIngredient {
  @PrimaryGeneratedColumn()
  id: number;

  /** 关联的菜谱ID */
  @Column({ type: 'varchar', length: 100 })
  recipe_id: string;

  /** 关联的食材ID */
  @Column({ type: 'int' })
  ingredient_id: number;

  /** 用量/数量 */
  @Column({ type: 'varchar', length: 100, nullable: true })
  amount: string;

  /** 是否可选 */
  @Column({ type: 'boolean', default: false })
  is_optional: boolean;

  /** 备注（如：切小块、去骨等） */
  @Column({ type: 'text', nullable: true })
  note: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.recipeIngredients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.recipeIngredients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ingredient_id' })
  ingredient: Ingredient;
}
