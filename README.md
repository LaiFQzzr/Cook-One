# Cook One Server 🍳

基于 NestJS 的 AI 对话 + 菜谱数据后端服务。

提供 **AI 智能对话**（接入通义千问）、**结构化菜谱数据**（解析 [HowToCook](https://github.com/Anduin2017/HowToCook) 项目）、**用户成就体系**、**食材采购管理**、**备餐计划** 等能力，配套完整的 JWT 认证与 MySQL 持久化，适用于小程序、App 等前端项目。

---

## 功能特性

- 🤖 **AI 对话**：支持非流式和 SSE 流式两种对话模式，接入阿里云通义千问
- 📖 **菜谱数据**：自动解析 HowToCook 开源菜谱，输出结构化 JSON 数据并持久化到 MySQL
- ⏰ **定时更新**：每天凌晨自动拉取最新菜谱，同步到数据库，支持手动触发更新
- 🏆 **成就系统**：内置多维度成就定义，用户注册自动初始化，支持进度追踪与达成判定
- 🛒 **食材采购单**：类似购物车的食材管理，支持手动添加/菜谱批量导入/勾选状态
- 📅 **备餐计划**：按日期与餐别（早/午/晚/加餐）规划待做菜品，可一键汇总食材到采购单
- ⚙️ **用户偏好**：键值对形式存储用户饮食偏好（忌口、口味、菜系等）
- 🔐 **JWT 认证**：完整的注册/登录/Token 校验体系
- 📦 **内存缓存**：启动时自动加载菜谱数据，接口响应极速
- 🧪 **完整测试**：单元测试 + 集成测试 + E2E 测试，覆盖 66 个用例

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [NestJS](https://nestjs.com/) | 11.x | 后端框架 |
| [TypeScript](https://www.typescriptlang.org/) | 5.3+ | 开发语言 |
| [Node.js](https://nodejs.org/) | 20+ | 运行时 |
| [MySQL](https://www.mysql.com/) | 8.0 | 业务数据持久化 |
| [TypeORM](https://typeorm.io/) | 0.3.x | ORM 框架 |
| [Python](https://www.python.org/) | 3.10+ | 菜谱解析脚本 |
| [通义千问](https://tongyi.aliyun.com/) | - | AI 对话能力 |
| [Jest](https://jestjs.io/) | 30.x | 测试框架 |

---

## 快速开始

### 环境要求

- Node.js >= 20
- Python 3.10+（需加入系统 PATH，命令名为 `python`）
- MySQL 8.0+
- npm >= 10

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 或创建 `.env`：

```env
# 服务器端口
PORT=3000

# JWT 配置
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# 通义千问 API Key（必填）
# 获取地址：https://bailian.console.aliyun.com/
QIANWEN_API_KEY=sk-your-key-here
QIANWEN_MODEL=qwen-turbo

# CORS 配置
CORS_ORIGIN=*

# MySQL 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your-password
DB_DATABASE=cook_one_server
DB_SYNC=true           # 开发环境自动同步实体；生产环境建议 false，使用迁移
```

### 初始化数据库

1. 创建数据库（如不存在）：
```sql
CREATE DATABASE IF NOT EXISTS cook_one_server
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

2. 执行项目根目录下的建表脚本：
```bash
# 使用 MySQL 客户端执行
mysql -u root -p cook_one_server < database-schema.sql
```

### 运行

```bash
# 开发模式（热重载）
npm run start:dev

# 生产构建
npm run build
npm run start:prod
```

服务启动后访问：
- API 服务：`http://localhost:3000`

---

## API 文档

### 认证接口

#### 注册
```http
POST /auth/register
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```

**响应**：
```json
{
  "message": "注册成功",
  "userId": "xxx"
}
```
> 注册成功后会自动为该用户初始化所有成就记录。

#### 登录
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```

**响应**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "xxx",
    "username": "admin"
  }
}
```

---

### AI 对话接口（需 JWT）

#### 普通对话
```http
POST /chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "你好" }
  ],
  "model": "qwen-turbo"
}
```

**响应**：
```json
{
  "content": "你好！有什么可以帮你的吗？"
}
```

#### 流式对话（SSE）
```http
POST /chat/stream
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "讲个笑话" }
  ]
}
```

**响应**：`Content-Type: text/event-stream`
```
data: {"token": "从前"}

data: {"token": "有座山"}

data: [DONE]

```

---

### 菜谱接口

#### 获取菜谱列表
```http
GET /recipes?page=1&limit=20&category=荤菜
```

**响应**：
```json
{
  "total": 357,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "meat_dish_红烧肉",
      "name": "红烧肉",
      "category": "荤菜",
      "difficulty": 3,
      "difficulty_label": "★★★☆☆",
      "description": "...",
      "tags": ["荤菜"],
      "ingredient_count": 8,
      "step_count": 12
    }
  ]
}
```

#### 获取菜谱详情
```http
GET /recipes/meat_dish_红烧肉
```

#### 按分类获取
```http
GET /recipes/categories
```

#### 搜索食材
```http
GET /recipes/ingredients?search=猪肉&limit=10
```

#### 获取元数据
```http
GET /recipes/metadata
```

#### 手动触发更新（需 JWT）
```http
POST /recipes/update
Authorization: Bearer <token>
```

**响应**：
```json
{
  "success": true,
  "message": "菜谱数据更新成功",
  "total": 357
}
```
> 更新成功后会自动将菜谱全量同步到 MySQL `recipes` 表。

---

### 成就接口（需 JWT）

#### 获取所有成就定义
```http
GET /achievements/definitions
Authorization: Bearer <token>
```

#### 获取我的成就
```http
GET /achievements/my
Authorization: Bearer <token>
```

**响应**：
```json
[
  {
    "id": 1,
    "progress": 3,
    "achievedAt": null,
    "achievement": {
      "code": "cook_10",
      "name": "熟练厨师",
      "description": "累计完成 10 次备餐计划",
      "conditionValue": 10
    },
    "isCompleted": false
  }
]
```

#### 更新成就进度（管理/测试用，通常由业务自动触发）
```http
POST /achievements/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "cook_10",
  "progress": 10
}
```

---

### 食材采购单接口（需 JWT）

#### 获取采购清单
```http
GET /shopping?includeChecked=true
Authorization: Bearer <token>
```

#### 手动添加采购项
```http
POST /shopping
Authorization: Bearer <token>
Content-Type: application/json

{
  "ingredient_name": "五花肉",
  "amount": "500g",
  "unit": "克",
  "note": "要肥瘦相间",
  "recipeId": "meat_dish_红烧肉"
}
```

#### 从菜谱批量导入食材
```http
POST /shopping/from-recipe
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipeId": "meat_dish_红烧肉",
  "servingsAdjust": 2
}
```

#### 修改采购项
```http
PATCH /shopping/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": "600g",
  "note": "改为600克"
}
```

#### 勾选/取消勾选
```http
POST /shopping/1/toggle
Authorization: Bearer <token>
```

#### 删除采购项
```http
DELETE /shopping/1
Authorization: Bearer <token>
```

#### 清空已勾选
```http
POST /shopping/clear-checked
Authorization: Bearer <token>
```

#### 清空全部
```http
POST /shopping/clear-all
Authorization: Bearer <token>
```

---

### 备餐计划接口（需 JWT）

#### 创建备餐计划
```http
POST /meal-plans
Authorization: Bearer <token>
Content-Type: application/json

{
  "planDate": "2025-06-01",
  "mealType": "dinner",
  "note": "周末聚餐",
  "recipeIds": ["meat_dish_红烧肉", "aquatic_清蒸鲈鱼"]
}
```
> `mealType` 可选：`breakfast` / `lunch` / `dinner` / `snack`

#### 查询备餐计划
```http
GET /meal-plans?status=planned&fromDate=2025-06-01&toDate=2025-06-07
Authorization: Bearer <token>
```

#### 获取详情
```http
GET /meal-plans/1
Authorization: Bearer <token>
```

#### 更新备餐计划
```http
PATCH /meal-plans/1
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "completed",
  "recipeIds": ["meat_dish_红烧肉"]
}
```

#### 删除备餐计划
```http
DELETE /meal-plans/1
Authorization: Bearer <token>
```

#### 汇总食材（用于一键加入采购单）
```http
GET /meal-plans/1/ingredients
Authorization: Bearer <token>
```

**响应**：
```json
{
  "planId": 1,
  "ingredients": [
    { "name": "五花肉", "amount": "500g", "recipeId": "meat_dish_红烧肉", "recipeName": "红烧肉" },
    { "name": "鲈鱼", "amount": "1条", "recipeId": "aquatic_清蒸鲈鱼", "recipeName": "清蒸鲈鱼" }
  ]
}
```

---

### 用户偏好接口（需 JWT）

#### 获取所有偏好
```http
GET /preferences
Authorization: Bearer <token>
```

**响应**：
```json
{
  "spicy_level": "中辣",
  "dietary": "少油",
  "avoid_ingredients": "香菜,芹菜"
}
```

#### 获取单个偏好
```http
GET /preferences/spicy_level
Authorization: Bearer <token>
```

#### 新增/更新偏好
```http
PUT /preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "key": "spicy_level",
  "value": "微辣"
}
```

#### 批量更新
```http
PUT /preferences/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "key": "spicy_level", "value": "微辣" },
    { "key": "cuisine", "value": "川菜" }
  ]
}
```

#### 删除偏好
```http
DELETE /preferences/spicy_level
Authorization: Bearer <token>
```

#### 清空全部偏好
```http
POST /preferences/clear
Authorization: Bearer <token>
```

---

## 数据库表结构

业务数据使用 **MySQL 8.0** 持久化，详见项目根目录 `database-schema.sql`。

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户表 | `username`, `password`, `nickname`, `avatar` |
| `recipes` | 菜谱表 | `id`, `name`, `category`, `ingredients`(JSON), `steps`(JSON) |
| `achievement_definitions` | 成就定义 | `code`, `name`, `condition_type`, `condition_value` |
| `user_achievements` | 用户成就 | `user_id`, `achievement_id`, `progress`, `achieved_at` |
| `shopping_items` | 食材采购单 | `user_id`, `ingredient_name`, `amount`, `is_checked` |
| `meal_plans` | 备餐计划 | `user_id`, `plan_date`, `meal_type`, `status` |
| `meal_plan_recipes` | 备餐菜谱关联 | `meal_plan_id`, `recipe_id`, `servings_adjust` |
| `user_preferences` | 用户偏好 | `user_id`, `preference_key`, `preference_value` |

---

## 项目结构

```
├── src/
│   ├── auth/                  # JWT 认证
│   ├── chat/                  # AI 对话（通义千问）
│   ├── recipes/               # 菜谱数据服务（JSON + MySQL 双存储）
│   ├── achievements/          # 成就系统
│   ├── shopping/              # 食材采购单
│   ├── meal-plans/            # 备餐计划
│   ├── preferences/           # 用户偏好
│   ├── common/                # 工具类、守卫、装饰器
│   ├── app.module.ts          # 根模块
│   └── main.ts                # 入口
├── scripts/
│   ├── parse_recipes.py       # Python 菜谱解析脚本
│   ├── HowToCook.zip          # 菜谱源数据
│   └── output/                # 生成的 JSON 数据
├── test/
│   ├── integration/           # 集成测试
│   └── app.e2e-spec.ts        # E2E 测试
├── database-schema.sql        # MySQL 建表脚本
├── .env                       # 环境变量
├── jest.config.js             # Jest 配置
└── package.json
```

---

## 测试

```bash
# 单元测试
npm run test

# 单元测试 + 覆盖率
npm run test:cov

# 集成测试 + E2E 测试
npm run test:e2e

# 监听模式（开发）
npm run test:watch
```

### 测试覆盖

| 类型 | 数量 | 说明 |
|------|------|------|
| 单元测试 | 42 个 | Service / Controller / 工具函数 |
| 集成测试 | 9 个 | 模块间联调（Auth+Chat、Recipes） |
| E2E 测试 | 15 个 | 完整应用端到端 |

---

## 定时任务

系统内置自动定时更新：

| 任务 | 频率 | 说明 |
|------|------|------|
| 菜谱数据更新 | 每天凌晨 3:00 | 自动运行 `parse_recipes.py` 并重新加载数据，同步到 MySQL |

也可通过接口 `POST /recipes/update` 随时手动触发。

---

## 部署

### 构建

```bash
npm run build
```

### 运行

```bash
# 直接运行
node dist/main

# 或使用 PM2
pm2 start dist/main --name cook-server
```

### Docker（可选）

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]
```

> 注意：容器内需要同时安装 Python 3 环境，因为服务依赖 `scripts/parse_recipes.py`。

---

## 数据源

菜谱数据来自开源项目 [Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)，遵循原项目许可证。

---

## License

MIT
