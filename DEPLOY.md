# 部署指南

针对 **Ubuntu 22.04/24.04 LTS** 服务器的完整部署流程。

> 测试环境：`Linux VM-0-4-ubuntu 6.8.0-101-generic #101-Ubuntu SMP PREEMPT_DYNAMIC x86_64`

---

## 一、服务器环境准备

### 1.1 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 安装 Node.js 20

```bash
# 安装 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# 安装 Node.js
sudo apt install -y nodejs

# 验证
node -v   # v20.x.x
npm -v    # 10.x.x
```

### 1.3 安装 Python 3

Ubuntu 通常已预装，确认版本：

```bash
python3 --version   # >= 3.10
which python3       # /usr/bin/python3
```

**关键步骤**：创建 `python` 命令软链接（项目调用的是 `python` 而非 `python3`）：

```bash
sudo ln -sf /usr/bin/python3 /usr/bin/python
python --version
```

### 1.4 安装 Git（用于拉取代码）

```bash
sudo apt install -y git
```

### 1.5 安装 PM2（进程管理）

```bash
sudo npm install -g pm2
pm2 --version
```

### 1.6 安装 Nginx（反向代理，可选但强烈推荐）

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 二、上传代码到服务器

### 方式 A：Git 克隆（推荐，方便后续更新）

```bash
cd ~
git clone <你的仓库地址> cook-server
cd cook-server
```

### 方式 B：本地打包上传

本地执行：

```bash
# 排除 node_modules 和 .git，打包项目
cd cook-server
tar czvf ../cook-server.tar.gz --exclude=node_modules --exclude=.git --exclude=dist .
```

上传到服务器：

```bash
# 本地终端执行
scp cook-server.tar.gz ubuntu@<服务器IP>:~/
```

服务器解压：

```bash
ssh ubuntu@<服务器IP>
tar xzvf cook-server.tar.gz
cd cook-server
```

---

## 三、安装依赖与构建

```bash
cd ~/cook-server

# 安装依赖（生产环境）
npm ci --omit=dev

# 构建 TypeScript → JavaScript
npm run build
```

> 如果 `npm ci` 报错，检查 `package-lock.json` 是否存在。如果不存在，用 `npm install` 代替。

---

## 四、配置环境变量

```bash
cd ~/cook-server
cp .env .env.local   # 备份原始配置
nano .env
```

最小可运行配置：

```env
# 服务端口（Nginx 反向代理时保持 3000 即可）
PORT=3000

# JWT 密钥（生产环境务必使用强随机字符串）
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_32_CHARS_MIN
JWT_EXPIRES_IN=7d

# 通义千问 API Key（必填）
QIANWEN_API_KEY=sk-your-real-api-key
QIANWEN_MODEL=qwen-turbo

# CORS（生产环境请限制为前端域名）
CORS_ORIGIN=*
```

生成强随机密钥：

```bash
openssl rand -base64 48
# 将输出复制到 JWT_SECRET
```

---

## 五、启动服务（PM2）

### 5.1 首次启动

```bash
cd ~/cook-server
pm2 start dist/main.js --name cook-server
```

### 5.2 设置开机自启

```bash
pm2 startup systemd
# 执行输出的命令，例如：
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

pm2 save
```

### 5.3 常用 PM2 命令

```bash
pm2 status                 # 查看运行状态
pm2 logs cook-server       # 查看实时日志
pm2 logs cook-server --lines 100   # 查看最近 100 行日志
pm2 restart cook-server    # 重启服务
pm2 stop cook-server       # 停止服务
pm2 delete cook-server     # 删除进程
pm2 monit                  # 监控面板
```

---

## 六、Nginx 反向代理（推荐）

Nginx 可以提供：
- 域名访问（替代 IP:3000）
- HTTPS（SSL 证书）
- 负载均衡
- 静态资源缓存

### 6.1 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/cook-server
```

填写以下内容（HTTP 版本）：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;   # 替换为你的域名或服务器 IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE 流式响应需要禁用缓冲
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

### 6.2 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/cook-server /etc/nginx/sites-enabled/
sudo nginx -t               # 测试配置是否正确
sudo systemctl reload nginx # 重新加载
```

### 6.3 配置 HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com

# 自动续期测试
sudo certbot renew --dry-run
```

Certbot 会自动修改 Nginx 配置添加 SSL。

---

## 七、防火墙配置

```bash
# 查看防火墙状态
sudo ufw status

# 允许 SSH（必须！）
sudo ufw allow OpenSSH

# 允许 HTTP/HTTPS
sudo ufw allow 'Nginx Full'

# 如果不用 Nginx，直接暴露 3000 端口（不推荐）
# sudo ufw allow 3000/tcp

# 启用防火墙
sudo ufw enable
```

---

## 八、验证部署

### 8.1 服务健康检查

```bash
# 本地直接测试
curl http://localhost:3000/recipes/metadata

# 通过 Nginx 测试（服务器上）
curl http://localhost/recipes/metadata

# 公网测试（替换为你的域名或IP）
curl http://<你的域名或IP>/recipes/metadata
```

### 8.2 测试认证流程

```bash
# 1. 注册
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'

# 2. 登录
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'

# 3. 使用返回的 token 访问受保护接口
curl http://localhost:3000/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

### 8.3 测试 Python 脚本调用

```bash
# 手动触发菜谱更新
curl -X POST http://localhost:3000/recipes/update \
  -H "Authorization: Bearer <token>"
```

---

## 九、后续更新部署

### 9.1 Git 方式更新

```bash
cd ~/cook-server
git pull origin main

# 如果有新依赖
npm ci --omit=dev

# 重新构建
npm run build

# PM2 重启（零停机）
pm2 reload cook-server
```

### 9.2 本地打包方式更新

本地：

```bash
tar czvf cook-server.tar.gz --exclude=node_modules --exclude=.git --exclude=dist .
scp cook-server.tar.gz ubuntu@<服务器IP>:~/
```

服务器：

```bash
cd ~
# 备份旧版本（可选）
cp -r cook-server cook-server-backup-$(date +%Y%m%d)

# 解压覆盖
rm -rf cook-server
tar xzvf cook-server.tar.gz
cd cook-server

# 安装依赖、构建、重启
npm ci --omit=dev
npm run build
pm2 reload cook-server
```

---

## 十、常见问题排查

### Q1: PM2 启动失败，日志显示 `Error: Cannot find module 'xxx'`

```bash
# 依赖未安装完整
npm ci --omit=dev
npm run build
pm2 restart cook-server
```

### Q2: Python 脚本执行失败，`python: command not found`

```bash
# 检查 python 命令
which python

# 如果不存在，创建软链接
sudo ln -sf /usr/bin/python3 /usr/bin/python
```

### Q3: `recipes/update` 接口报错超时

```bash
# 检查 Python 环境
python scripts/parse_recipes.py

# 检查网络（脚本需要下载 HowToCook ZIP）
curl -I https://github.com/Anduin2017/HowToCook/archive/refs/heads/master.zip

# 检查 scripts/output/ 目录权限
ls -la scripts/output/
```

### Q4: Nginx 502 Bad Gateway

```bash
# 检查 NestJS 服务是否运行
pm2 status

# 检查端口监听
ss -tlnp | grep 3000

# 检查 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### Q5: SSE 流式对话不流畅/中断

确保 Nginx 配置中包含：

```nginx
proxy_buffering off;
proxy_read_timeout 86400;
```

### Q6: 内存占用过高

NestJS 服务会将菜谱 JSON 加载到内存缓存（约 50-100MB，取决于数据量）。这是预期行为，如需降低内存，可修改 `recipes.service.ts` 移除缓存机制，改为每次请求读文件。

---

## 十一、目录速查

| 路径 | 说明 |
|------|------|
| `~/cook-server` | 项目根目录 |
| `~/cook-server/dist` | 构建输出 |
| `~/cook-server/scripts/output` | Python 生成的 JSON 数据 |
| `/var/log/nginx/error.log` | Nginx 错误日志 |
| `~/.pm2/logs/cook-server-out.log` | PM2 标准输出 |
| `~/.pm2/logs/cook-server-error.log` | PM2 错误日志 |
| `/etc/nginx/sites-available/cook-server` | Nginx 站点配置 |

---

## 十二、安全建议（生产必做）

- [ ] `JWT_SECRET` 使用 `openssl rand -base64 48` 生成强密钥
- [ ] `CORS_ORIGIN` 从 `*` 改为前端实际域名
- [ ] 使用 HTTPS（Let's Encrypt 免费证书）
- [ ] 配置 UFW 防火墙，只开放 22/80/443
- [ ] 禁用 root 登录，使用普通用户 + sudo
- [ ] 配置 fail2ban 防止暴力破解
- [ ] 定期执行 `sudo apt update && sudo apt upgrade`
- [ ] 用户数据存储：当前使用内存 Map，生产环境务必替换为数据库（PostgreSQL/MySQL/MongoDB）
