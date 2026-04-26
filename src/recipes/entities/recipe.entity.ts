import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface RecipeIngredient {
  name: string;
  amount: string;
  is_optional: boolean;
  note: string;
}

export interface RecipeStep {
  step_number: number;
  description: string;
  time_hint: string;
}

@Entity('recipes')
export class Recipe {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category_en: string;

  @Column({ type: 'int', default: 0 })
  difficulty: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  difficulty_label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  servings: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string;

  @Column({ type: 'json', nullable: true })
  ingredients: RecipeIngredient[];

  @Column({ type: 'json', nullable: true })
  steps: RecipeStep[];

  @Column({ type: 'json', nullable: true })
  tips: string[];

  @Column({ type: 'json', nullable: true })
  nutrition: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  tools: string[];

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ type: 'json', nullable: true })
  references: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
