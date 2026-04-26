import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { RecipeIngredient } from './recipe-ingredient.entity';

/**
 * 食材主表
 * 保存去重后的标准化食材名称
 */
@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn()
  id: number;

  /** 食材名称（唯一） */
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /** 食材分类（如：肉类、蔬菜、调料等） */
  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => RecipeIngredient, (ri) => ri.ingredient)
  recipeIngredients: RecipeIngredient[];
}
