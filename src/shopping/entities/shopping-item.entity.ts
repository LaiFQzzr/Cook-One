import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Recipe } from '../../recipes/entities/recipe.entity';

@Entity('shopping_items')
export class ShoppingItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  ingredient_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  amount: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'recipe_id' })
  recipeId: string | null;

  @Column({ type: 'int', nullable: true, name: 'meal_plan_id' })
  mealPlanId: number | null;

  @Column({ type: 'boolean', default: false, name: 'is_checked' })
  isChecked: boolean;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.shoppingItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Recipe, (recipe) => recipe.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe: Recipe | null;
}
