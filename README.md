# HowToCook 菜谱 JSON 数据集

本项目将 [GitHub - Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook) 的 Markdown 菜谱解析为结构化 JSON 数据，适用于微信小程序、安卓 APP 等应用开发。

## 统计数据

| 指标 | 数值 |
|------|------|
| 菜谱总数 | **357 道** |
| 食材种类 | **1,092 种** |
| 分类数量 | **10 大类** |
| 平均每道菜食材 | **7.5 种** |
| 平均每道菜步骤 | **8.2 步** |
| 带烹饪提示 | **62.2%** |
| 带成品图片 | **47.9%** |

## 输出文件

```
output/
├── recipes_full.json           # 完整菜谱数据 (1.1 MB)
├── recipes_list.json           # 列表数据 (158 KB)
├── recipes_by_category.json    # 按分类组织 (1.3 MB)
├── ingredients_index.json      # 食材索引 (160 KB)
├── metadata.json               # 元数据 (2 KB)
├── parse_recipes.py            # 解析脚本
├── APP_INTEGRATION_GUIDE.md    # APP 集成指南
└── README.md                   # 本文件
```

### 文件用途

- **recipes_full.json** — 开发主力文件，包含完整的菜谱、食材、步骤、提示
- **recipes_list.json** — 首页/列表页使用，轻量级，无步骤详情
- **recipes_by_category.json** — 分类浏览页面直接使用
- **ingredients_index.json** — 食材搜索、冰箱食材反向查菜功能
- **metadata.json** — APP 配置信息，分类统计等

## 快速开始

### 重新解析数据

```bash
python parse_recipes.py
```

脚本会自动下载 HowToCook ZIP 文件并解析为 JSON。

### 微信小程序使用

```javascript
// app.js
const recipes = require('./data/recipes_full.json');
App({
  globalData: { recipes: recipes.recipes }
});
```

### 安卓/Flutter 使用

将 JSON 文件放入 `assets/` 目录，解析为对应 Model 类即可。

## 数据结构

### 菜谱对象

```json
{
  "id": "meat_dish_水煮肉片",
  "name": "水煮肉片",
  "category": "荤菜",
  "category_en": "meat_dish",
  "difficulty": 5,
  "difficulty_label": "★★★★★",
  "description": "麻辣鲜香，适合干饭...",
  "servings": "一份正好够 2-3 个人吃",
  "image": "./水煮肉片.jpg",
  "ingredients": [
    {
      "name": "猪里脊肉",
      "amount": "300g",
      "is_optional": false,
      "note": ""
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "description": "里脊肉改刀成小块...",
      "time_hint": ""
    }
  ],
  "tips": ["垫底的蔬菜根据自己口味选择"],
  "nutrition": {},
  "tools": [],
  "tags": ["挑战", "荤菜"],
  "references": []
}
```

## 分类说明

| 分类代码 | 中文名 | 菜谱数 |
|----------|--------|--------|
| meat_dish | 荤菜 | 103 |
| vegetable_dish | 素菜 | 60 |
| staple | 主食 | 58 |
| aquatic | 水产 | 27 |
| breakfast | 早餐 | 25 |
| soup | 汤羹 | 23 |
| drink | 饮品 | 23 |
| dessert | 甜品 | 19 |
| semi-finished | 半成品 | 10 |
| condiment | 调料 | 9 |

## APP 功能建议

1. **分类浏览** — 按 10 大分类查看菜谱
2. **难度筛选** — 1-5 星难度筛选
3. **食材搜索** — 根据冰箱里的食材找能做的菜
4. **购物清单** — 选择菜谱后自动生成食材购买清单
5. **步骤计时** — 步骤中内置时间提示，可一键倒计时
6. **收藏功能** — 收藏喜欢的菜谱

详细集成方案请参考 `APP_INTEGRATION_GUIDE.md`。

## 数据来源

- 原始项目：[Anduin2017/HowToCook](https://github.com/Anduin2017/HowToCook)
- 协议：遵循原项目开源协议
