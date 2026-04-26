import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MealPlan } from './meal-plan.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';

@Entity('meal_plan_recipes')
export class MealPlanRecipe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'meal_plan_id' })
  mealPlanId: number;

  @Column({ type: 'varchar', length: 100, name: 'recipe_id' })
  recipeId: string;

  @Column({ type: 'int', default: 1, name: 'servings_adjust' })
  servingsAdjust: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => MealPlan, (mp) => mp.mealPlanRecipes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'meal_plan_id' })
  mealPlan: MealPlan;

  @ManyToOne(() => Recipe, (recipe) => recipe.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe;
}
