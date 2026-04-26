import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { RecipesModule } from './recipes/recipes.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ShoppingModule } from './shopping/shopping.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { PreferencesModule } from './preferences/preferences.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'cook_server'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('DB_SYNC', 'true') === 'true',
        // 生产环境建议关闭 synchronize，改用迁移
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    ChatModule,
    RecipesModule,
    AchievementsModule,
    ShoppingModule,
    MealPlansModule,
    PreferencesModule,
  ],
})
export class AppModule {}
