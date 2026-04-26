import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserAchievement } from '../../achievements/entities/user-achievement.entity';
import { ShoppingItem } from '../../shopping/entities/shopping-item.entity';
import { MealPlan } from '../../meal-plans/entities/meal-plan.entity';
import { UserPreference } from '../../preferences/entities/user-preference.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nickname: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserAchievement, (ua) => ua.user)
  achievements: UserAchievement[];

  @OneToMany(() => ShoppingItem, (si) => si.user)
  shoppingItems: ShoppingItem[];

  @OneToMany(() => MealPlan, (mp) => mp.user)
  mealPlans: MealPlan[];

  @OneToMany(() => UserPreference, (up) => up.user)
  preferences: UserPreference[];
}
