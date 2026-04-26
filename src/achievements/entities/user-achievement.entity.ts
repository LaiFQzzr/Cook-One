import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { AchievementDefinition } from './achievement-definition.entity';

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'int', name: 'achievement_id' })
  achievementId: number;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'datetime', nullable: true, name: 'achieved_at' })
  achievedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.achievements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => AchievementDefinition, (ad) => ad.userAchievements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'achievement_id' })
  achievement: AchievementDefinition;
}
