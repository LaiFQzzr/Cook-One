# Cook One Server 🍳

基于 NestJS 的 AI 对话 + 菜谱数据后端服务。

提供 **AI 智能对话**（接入通义千问）和 **结构化菜谱数据**（解析 [HowToCook](https://github.com/Anduin2017/HowToCook) 项目）两大核心能力，配套完整的 JWT 认证体系，适用于小程序、App 等前端项目。

---

## 功能特性

- 🤖 **AI 对话**：支持非流式和 SSE 流式两种对话模式，接入阿里云通义千问
- 📖 **菜谱数据**：自动解析 HowToCook 开源菜谱，输出结构化 JSON 数据
- ⏰ **定时更新**：每天凌晨自动拉取最新菜谱，支持手动触发更新
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
| [Python](https://www.python.org/) | 3.10+ | 菜谱解析脚本 |
| [通义千问](https://tongyi.aliyun.com/) | - | AI 对话能力 |
| [Jest](https://jestjs.io/) | 30.x | 测试框架 |

---

## 快速开始

### 环境要求

- Node.js >= 20
- Python 3.10+（需加入系统 PATH，命令名为 `python`）
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

---

## 项目结构

```
├── src/
│   ├── auth/              # JWT 认证
│   ├── chat/              # AI 对话（通义千问）
│   ├── recipes/           # 菜谱数据服务
│   ├── common/            # 工具类 & 守卫
│   ├── app.module.ts      # 根模块
│   └── main.ts            # 入口
├── scripts/
│   ├── parse_recipes.py   # Python 菜谱解析脚本
│   ├── HowToCook.zip      # 菜谱源数据
│   └── output/            # 生成的 JSON 数据
├── test/
│   ├── integration/       # 集成测试
│   └── app.e2e-spec.ts    # E2E 测试
├── .env                   # 环境变量
├── jest.config.js         # Jest 配置
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
| 菜谱数据更新 | 每天凌晨 3:00 | 自动运行 `parse_recipes.py` 并重新加载数据 |

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
