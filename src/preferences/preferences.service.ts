import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './entities/user-preference.entity';

export interface UpsertPreferenceDto {
  key: string;
  value: string;
}

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly prefRepo: Repository<UserPreference>,
  ) {}

  /**
   * 获取用户的所有偏好设置
   */
  async findByUser(userId: string): Promise<Record<string, string>> {
    const list = await this.prefRepo.find({ where: { userId } });
    const result: Record<string, string> = {};
    for (const item of list) {
      result[item.preferenceKey] = item.preferenceValue;
    }
    return result;
  }

  /**
   * 获取指定偏好
   */
  async findOne(userId: string, key: string): Promise<string | undefined> {
    const item = await this.prefRepo.findOne({
      where: { userId, preferenceKey: key },
    });
    return item?.preferenceValue;
  }

  /**
   * 新增或更新偏好
   */
  async upsert(userId: string, dto: UpsertPreferenceDto) {
    let item = await this.prefRepo.findOne({
      where: { userId, preferenceKey: dto.key },
    });

    if (item) {
      item.preferenceValue = dto.value;
    } else {
      item = this.prefRepo.create({
        userId,
        preferenceKey: dto.key,
        preferenceValue: dto.value,
      });
    }

    return this.prefRepo.save(item);
  }

  /**
   * 批量更新偏好
   */
  async upsertMany(userId: string, items: UpsertPreferenceDto[]) {
    const results: UserPreference[] = [];
    for (const dto of items) {
      const saved = await this.upsert(userId, dto);
      results.push(saved);
    }
    return results;
  }

  /**
   * 删除指定偏好
   */
  async remove(userId: string, key: string) {
    await this.prefRepo.delete({ userId, preferenceKey: key });
    return { deleted: true };
  }

  /**
   * 清空用户所有偏好
   */
  async clear(userId: string) {
    await this.prefRepo.delete({ userId });
    return { cleared: true };
  }
}
