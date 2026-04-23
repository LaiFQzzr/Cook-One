import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 全局参数校验管道
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // CORS配置 - 允许uni-app前端跨域访问
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`================================================`);
  console.log(`  AI Chat Server is running!`);
  console.log(`  - Local:   http://localhost:${port}`);
  console.log(`  - Network: http://0.0.0.0:${port}`);
  console.log(`================================================`);
}
bootstrap();
