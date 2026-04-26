# AGENTS.md - AI 编程助手指南

## 项目概述

**cook-one-server** 是一个 NestJS 后端服务，核心职责：
1. **AI 对话服务**：通过第三方 API（通义千问）提供流式/非流式对话能力
2. **菜谱数据服务**：调用 Python 脚本解析 [HowToCook](https://github.com/Anduin2017/HowToCook) 项目，提供结构化菜谱数据
3. **用户认证**：基于 JWT 的注册/登录体系

> 目标用户：前端（uni-app 小程序/Android App）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Node.js 20+ |
| 框架 | NestJS 11.x |
| 语言 | TypeScript 5.3+ |
| 数据脚本 | Python 3.10+ |
| 认证 | Passport + JWT + bcryptjs |
| 定时任务 | `@nestjs/schedule` (node-cron) |
| 测试 | Jest 30 + ts-jest + supertest |
| 部署 | 直接运行 `node dist/main` |

---

## 项目结构

```
├── src/
│   ├── auth/                    # JWT 认证模块
│   │   ├── auth.controller.ts   # POST /auth/login, /auth/register
│   │   ├── auth.service.ts      # 用户管理（内存 Map，生产应换数据库）
│   │   ├── auth.module.ts
│   │   └── jwt.strategy.ts      # Passport JWT 策略
│   ├── chat/                    # AI 对话模块
│   │   ├── chat.controller.ts   # POST /chat, /chat/stream (SSE)
│   │   ├── chat.service.ts      # 调用通义千问 API
│   │   └── chat.module.ts
│   ├── recipes/                 # 菜谱数据模块
│   │   ├── recipes.controller.ts# 菜谱 CRUD + 手动更新接口
│   │   ├── recipes.service.ts   # 调用 Python、JSON 缓存、定时任务
│   │   └── recipes.module.ts
│   ├── common/
│   │   ├── guards/jwt-auth.guard.ts
│   │   └── utils/python-runner.ts  # child_process.spawn 封装
│   ├── app.module.ts
│   └── main.ts
├── scripts/
│   ├── parse_recipes.py         # Python 脚本：下载/解析 HowToCook
│   ├── HowToCook.zip            # 菜谱源数据 ZIP
│   └── output/                  # 生成的 JSON 数据
│       ├── recipes_full.json
│       ├── recipes_list.json
│       ├── recipes_by_category.json
│       ├── ingredients_index.json
│       └── metadata.json
├── test/
│   ├── app.e2e-spec.ts
│   ├── jest-e2e.json
│   └── integration/             # 集成测试
│       ├── auth-chat.integration-spec.ts
│       └── recipes.integration-spec.ts
├── jest.config.js               # 单元测试配置（rootDir: src）
├── .env                         # 环境变量
└── package.json
```

---

## 核心架构决策

### 1. Node.js ↔ Python 桥接
- **不要**将 Python 逻辑重写为 Node.js
- Python 脚本职责：下载 ZIP → 解析 Markdown → 输出 5 个 JSON 文件
- Node.js 通过 `python-runner.ts` 调用，使用 `child_process.spawn('python', [...])`
- 脚本超时：5 分钟（`timeout: 300000`）

### 2. 数据流
```
[HowToCook GitHub] → ZIP → parse_recipes.py → scripts/output/*.json
                                           ↑
                                    Node.js 定时任务/手动触发
                                           ↓
                                    内存缓存 ←→ REST API
                                           ↓
                              syncToDatabase()
                                           ↓
                              recipes 表 + ingredients 表 + recipe_ingredients 关联表
```
- 食材数据从 JSON `ingredients` 数组中解析，通过 `syncIngredientsToDatabase()` 同步到独立表
- `ingredients` 表保存去重后的标准化食材
- `recipe_ingredients` 关联表保存具体用量 (`amount`, `is_optional`, `note`)

### 3. 认证策略
- JWT Bearer Token，过期时间 7 天
- 受保护端点使用 `@UseGuards(JwtAuthGuard)`
- 当前用户存储在**内存 Map**中（`auth.service.ts`），生产环境必须替换为数据库

### 4. 定时任务
- `@Cron(CronExpression.EVERY_DAY_AT_3AM)` 每天凌晨 3 点自动更新菜谱
- 应用启动时自动加载本地 JSON 缓存到内存

---

## 编码规范

### TypeScript / NestJS
- 使用装饰器模式：`@Controller`, `@Injectable`, `@Cron`
- DTO 必须加 `class-validator` 装饰器（如 `@IsString()`），因为全局 `ValidationPipe` 开启了 `whitelist: true`
- 服务层返回 `Promise`，控制器用 `async/await`
- 错误统一使用 NestJS 内置 `HttpException`

### Python 脚本
- 使用标准库为主（`urllib`, `zipfile`, `re`, `json`）
- 输出目录固定为 `scripts/output/`
- 运行脚本前确保 `python` 命令在 PATH 中

### 新增模块的标准流程
1. `nest g module <name>` 或手动创建 `src/<name>/<name>.module.ts`
2. 创建 `*.service.ts`（业务逻辑）+ `*.controller.ts`（HTTP 接口）
3. 在 `app.module.ts` 的 `imports` 中注册
4. 编写对应的 `*.spec.ts` 单元测试
5. 如有跨模块交互，在 `test/integration/` 补充集成测试

---

## 测试体系

### 运行命令
```bash
npm run test           # 单元测试（src/**/*.spec.ts）
npm run test:cov       # 单元测试 + 覆盖率
npm run test:e2e       # E2E + 集成测试（test/**/*.e2e-spec.ts + **/*.integration-spec.ts）
```

### 测试分层
| 层级 | 位置 | 职责 |
|------|------|------|
| 单元测试 | `src/**/*.spec.ts` | 单个 Service/Controller，全部 Mock 外部依赖 |
| 集成测试 | `test/integration/*.integration-spec.ts` | 模块间真实联调，仍 Mock fs/fetch |
| E2E 测试 | `test/app.e2e-spec.ts` | 完整应用启动，真实 HTTP 请求 |

### Mock 约定
- `fs` → 用 `jest.mock('fs')` 避免真实文件读写
- `python-runner` → Mock 返回值 `{ stdout, stderr, exitCode }`
- `global.fetch` → Mock `Response` 对象（用于 AI API）
- `JwtService` → Mock `sign` 方法返回固定 token

---

## 环境变量（.env）

| 变量 | 必填 | 说明 |
|------|------|------|
| `PORT` | 否 | 默认 3000 |
| `JWT_SECRET` | 是 | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | 否 | 默认 7d |
| `QIANWEN_API_KEY` | 是 | 通义千问 API Key |
| `QIANWEN_MODEL` | 否 | 默认 qwen-turbo |
| `CORS_ORIGIN` | 否 | `*` 或逗号分隔的域名 |

---

## 常见任务速查

### 新增一个 REST 接口
1. 在对应 Controller 中添加 `@Get()/@Post()` 方法
2. 如需认证，加 `@UseGuards(JwtAuthGuard)`
3. 如需参数校验，定义 DTO 类并用 `class-validator` 装饰器
4. 在 Service 中实现业务逻辑
5. 编写 `*.controller.spec.ts` 和 `*.service.spec.ts`

### 修改 Python 脚本输出格式
1. 修改 `scripts/parse_recipes.py` 中的 `save_to_json()` 或 `convert_to_dict()`
2. 同步修改 `recipes.service.ts` 中的 `loadData()` 读取逻辑
3. 运行 `npm run test` 确保 RecipesService 单元测试通过
4. 运行 `npm run test:e2e` 确保集成/E2E 通过

### 更换数据库（生产必需）
- 当前 `auth.service.ts` 使用内存 `Map<string, User>`
- 替换为 TypeORM / Prisma / Mongoose：
  1. 安装 ORM 依赖
  2. 创建 Entity / Schema
  3. 修改 `AuthService` 中的 `users` 操作改为数据库查询
  4. 更新 `auth.service.spec.ts` 中的 Mock

### 调整定时任务频率
- 修改 `recipes.service.ts` 中 `@Cron()` 的参数
- 可用常量：`EVERY_DAY_AT_3AM`, `EVERY_HOUR`, `EVERY_10_MINUTES` 等
- 或用 Cron 字符串：`'0 */6 * * *'`（每 6 小时）

---

## 注意事项 / 陷阱

1. **uuid 包版本锁定在 `^8.3.2`**：更高版本（v12+）是纯 ESM，CommonJS require 会报错
2. **auth.service.ts 的测试用户初始化**：顶层有一个 `(async () => { ... })()` IIFE，测试时需确保 `bcrypt.hash` 已完成。单元测试中通过 `beforeEach` 重新注册新用户更稳定
3. **chat 接口返回 201**：`ChatController.chat()` 未加 `@HttpCode(200)`，默认返回 201
4. **SSE 流式响应**：`chatStream` 直接操作 `res.write()`，不走 NestJS 默认序列化，测试中需验证 `Content-Type: text/event-stream`
5. **Windows 环境**：Python 调用使用 `python` 命令而非 `python3`，确保 Python 在 PATH 中
6. **RecipeIngredient 命名冲突**：`recipe.entity.ts` 中已定义 `RecipeIngredient` 接口（JSON 结构），新增实体使用别名导入 `import { RecipeIngredient as RecipeIngredientEntity }`，避免类型冲突
