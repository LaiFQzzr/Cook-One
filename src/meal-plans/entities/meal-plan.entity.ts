import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { MealPlanRecipe } from './meal-plan-recipe.entity';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealPlanStatus = 'planned' | 'completed' | 'cancelled';

@Entity('meal_plans')
export class MealPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'date', name: 'plan_date' })
  planDate: Date;

  @Column({
    type: 'enum',
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    default: 'lunch',
    name: 'meal_type',
  })
  mealType: MealType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string;

  @Column({
    type: 'enum',
    enum: ['planned', 'completed', 'cancelled'],
    default: 'planned',
  })
  status: MealPlanStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.mealPlans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => MealPlanRecipe, (mpr) => mpr.mealPlan, { cascade: true })
  mealPlanRecipes: MealPlanRecipe[];
}
