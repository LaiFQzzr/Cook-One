# HowToCook 菜谱数据 APP 集成指南

## 数据概览

从 HowToCook 项目成功解析出 **357 道菜谱**，涵盖 10 大分类，1092 种独特食材。

### 生成的数据文件

| 文件 | 大小 | 用途 |
|------|------|------|
| `recipes_full.json` | ~1.1 MB | 完整菜谱数据（含步骤、食材详情） |
| `recipes_list.json` | ~158 KB | 菜谱列表（仅基础信息，用于列表页） |
| `recipes_by_category.json` | ~1.3 MB | 按分类组织的菜谱（分类页面用） |
| `ingredients_index.json` | ~160 KB | 食材索引（搜索/购物车功能用） |
| `metadata.json` | ~2 KB | 元数据（APP配置信息） |

---

## JSON 数据结构

### 菜谱对象 (Recipe)

```json
{
  "id": "meat_dish_水煮肉片",
  "name": "水煮肉片",
  "category": "荤菜",
  "category_en": "meat_dish",
  "difficulty": 5,
  "difficulty_label": "★★★★★",
  "description": "水煮肉片麻辣鲜香，适合干饭...",
  "servings": "一份正好够 2-3 个人吃",
  "image": "./水煮肉片.jpg",
  "ingredients": [
    {
      "name": "猪里脊肉",
      "amount": "300g",
      "is_optional": false,
      "note": ""
    },
    {
      "name": "小米辣",
      "amount": "15g",
      "is_optional": true,
      "note": "根据受辣程度选择 0-40g"
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "description": "里脊肉改刀成小块，再切成 2 毫米薄片...",
      "time_hint": ""
    },
    {
      "step_number": 5,
      "description": "大火煮至水沸腾，盖上锅盖转小火",
      "time_hint": "15-20 分钟"
    }
  ],
  "tips": [
    "垫底的蔬菜根据自己口味选择",
    "特别注意肉的腌制方向"
  ],
  "nutrition": {
    "热量": "254 千卡",
    "蛋白质": "12.3 克"
  },
  "tools": ["高压锅"],
  "tags": ["挑战", "荤菜"],
  "references": [
    {
      "title": "美食作家王刚R",
      "url": "https://www.bilibili.com/video/..."
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识，格式: `{分类}_{菜名}` |
| `name` | string | 菜名 |
| `category` | string | 分类名称（中文） |
| `category_en` | string | 分类代码（英文） |
| `difficulty` | number | 难度 1-5，数字越大越难 |
| `difficulty_label` | string | 星级可视化表示 |
| `description` | string | 菜谱简介 |
| `servings` | string | 份量说明 |
| `image` | string | 图片相对路径（如需要可后续补充） |
| `ingredients` | array | 食材列表，含名称、用量、是否可选、备注 |
| `steps` | array | 步骤列表，含序号、描述、时间提示 |
| `tips` | array | 附加提示/注意事项 |
| `nutrition` | object | 营养成分表（如有） |
| `tools` | array | 所需特殊工具 |
| `tags` | array | 标签（简单/挑战 + 分类） |
| `references` | array | 参考资料链接 |

---

## 微信小程序集成方案

### 1. 数据存储策略

**方案 A：本地JSON（推荐用于小程序）**
- 将 `recipes_list.json` 和 `recipes_by_category.json` 放入小程序 `data/` 目录
- 菜谱详情按需加载或分页加载
- 优点：无需服务器，加载速度快
- 缺点：数据更新需重新发布小程序

```javascript
// app.js 加载数据
App({
  globalData: {
    recipes: [],
    categories: [],
    ingredients: []
  },
  onLaunch() {
    const list = require('./data/recipes_list.json');
    const byCat = require('./data/recipes_by_category.json');
    const ingIndex = require('./data/ingredients_index.json');
    
    this.globalData.recipes = list.recipes;
    this.globalData.categories = byCat.categories;
    this.globalData.ingredients = ingIndex.ingredients;
  }
});
```

**方案 B：云开发（推荐）**
- 将数据导入微信云开发数据库
- 使用云函数进行搜索和筛选
- 可动态更新数据

```javascript
// 云函数示例：搜索菜谱
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { keyword, category, difficulty } = event;
  let where = {};
  
  if (keyword) {
    where.name = db.RegExp({
      regexp: keyword,
      options: 'i'
    });
  }
  if (category) where.category = category;
  if (difficulty) where.difficulty = difficulty;
  
  return db.collection('recipes').where(where).get();
};
```

### 2. 页面结构设计

```
pages/
├── index/              # 首页（分类入口 + 推荐）
├── category/           # 分类列表页
├── recipe-list/        # 菜谱列表页
├── recipe-detail/      # 菜谱详情页
├── search/             # 搜索页
├── ingredients/        # 食材大全
├── shopping-list/      # 购物清单（我的食材）
└── favorites/          # 收藏夹
```

### 3. 关键功能实现

**分类浏览**
```javascript
// pages/category/category.js
Page({
  data: {
    categories: getApp().globalData.categories
  },
  onSelectCategory(e) {
    const { name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/recipe-list/recipe-list?category=${name}`
    });
  }
});
```

**食材搜索与反向查菜**
```javascript
// 根据冰箱里的食材找能做的菜
function findRecipesByIngredients(userIngredients) {
  const recipes = getApp().globalData.recipes;
  return recipes.filter(recipe => {
    const recipeIngredients = recipe.ingredients.map(i => i.name);
    // 匹配度：用户拥有的食材覆盖菜谱食材的比例
    const matched = recipeIngredients.filter(ri => 
      userIngredients.some(ui => ri.includes(ui) || ui.includes(ri))
    );
    return matched.length >= recipeIngredients.length * 0.7; // 70%匹配
  });
}
```

**购物清单生成**
```javascript
// 选择菜谱后自动生成购物清单
function generateShoppingList(selectedRecipes) {
  const list = {};
  selectedRecipes.forEach(recipe => {
    recipe.ingredients.forEach(ing => {
      if (!ing.is_optional) { // 跳过可选食材
        if (list[ing.name]) {
          list[ing.name].recipes.push(recipe.name);
        } else {
          list[ing.name] = {
            name: ing.name,
            amount: ing.amount,
            recipes: [recipe.name],
            checked: false
          };
        }
      }
    });
  });
  return Object.values(list);
}
```

---

## 安卓 APP 集成方案

### 1. 技术选型

| 方案 | 技术栈 | 适用场景 |
|------|--------|----------|
| 原生 Android | Kotlin + Room 数据库 | 性能要求高 |
| 跨平台 | Flutter + SQLite | 快速开发，iOS复用 |
| 跨平台 | React Native + AsyncStorage | JS技术栈团队 |

### 2. Kotlin + Room 实现示例

```kotlin
// Entity 定义
@Entity(tableName = "recipes")
data class Recipe(
    @PrimaryKey val id: String,
    val name: String,
    val category: String,
    val categoryEn: String,
    val difficulty: Int,
    val description: String,
    val servings: String,
    val image: String,
    val tags: List<String>,
    val tips: List<String>
)

@Entity(tableName = "ingredients")
data class Ingredient(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val recipeId: String,
    val name: String,
    val amount: String,
    val isOptional: Boolean,
    val note: String
)

@Entity(tableName = "steps")
data class Step(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val recipeId: String,
    val stepNumber: Int,
    val description: String,
    val timeHint: String
)

// DAO
@Dao
interface RecipeDao {
    @Query("SELECT * FROM recipes")
    fun getAll(): Flow<List<Recipe>>
    
    @Query("SELECT * FROM recipes WHERE category = :category")
    fun getByCategory(category: String): Flow<List<Recipe>>
    
    @Query("""
        SELECT DISTINCT r.* FROM recipes r
        INNER JOIN ingredients i ON r.id = i.recipeId
        WHERE i.name LIKE '%' || :ingredient || '%'
    """)
    fun findByIngredient(ingredient: String): Flow<List<Recipe>>
    
    @Query("SELECT * FROM recipes WHERE difficulty <= :maxDifficulty")
    fun getByDifficulty(maxDifficulty: Int): Flow<List<Recipe>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(recipes: List<Recipe>)
}

// 数据导入
class RecipeImporter @Inject constructor(
    private val recipeDao: RecipeDao,
    private val context: Context
) {
    suspend fun importFromJson() {
        val json = context.assets.open("recipes_full.json")
            .bufferedReader().use { it.readText() }
        
        val response = Json.decodeFromString<RecipeResponse>(json)
        recipeDao.insertAll(response.recipes)
    }
}
```

### 3. Flutter 实现示例

```dart
// Model
class Recipe {
  final String id;
  final String name;
  final String category;
  final int difficulty;
  final List<Ingredient> ingredients;
  final List<RecipeStep> steps;
  
  factory Recipe.fromJson(Map<String, dynamic> json) => Recipe(
    id: json['id'],
    name: json['name'],
    category: json['category'],
    difficulty: json['difficulty'],
    ingredients: (json['ingredients'] as List)
      .map((i) => Ingredient.fromJson(i)).toList(),
    steps: (json['steps'] as List)
      .map((s) => RecipeStep.fromJson(s)).toList(),
  );
}

// Provider 状态管理
class RecipeProvider extends ChangeNotifier {
  List<Recipe> _recipes = [];
  List<Recipe> _filtered = [];
  String _selectedCategory = '全部';
  
  List<Recipe> get recipes => _filtered;
  
  Future<void> loadRecipes() async {
    final data = await rootBundle.loadString('assets/recipes_full.json');
    final json = jsonDecode(data);
    _recipes = (json['recipes'] as List)
      .map((r) => Recipe.fromJson(r)).toList();
    _filtered = _recipes;
    notifyListeners();
  }
  
  void filterByCategory(String category) {
    _selectedCategory = category;
    _filtered = category == '全部' 
      ? _recipes 
      : _recipes.where((r) => r.category == category).toList();
    notifyListeners();
  }
  
  void search(String query) {
    _filtered = _recipes.where((r) => 
      r.name.contains(query) ||
      r.ingredients.any((i) => i.name.contains(query))
    ).toList();
    notifyListeners();
  }
}
```

---

## 推荐 APP 功能架构

```
┌─────────────────────────────────────────┐
│              用户界面层                   │
├──────────┬──────────┬───────────────────┤
│ 首页      │ 发现      │ 我的               │
│ • 分类入口 │ • 搜索    │ • 收藏夹           │
│ • 推荐菜  │ • 热门食材 │ • 购物清单          │
│ • 今日菜谱 │ • 食材大全 │ • 浏览历史          │
└──────────┴──────────┴───────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│              业务逻辑层                   │
│  • 菜谱检索    • 食材匹配    • 收藏管理   │
│  • 难度筛选    • 分类浏览    • 清单生成   │
└─────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│              数据层                       │
│  recipes_full.json                      │
│  recipes_list.json       [内存缓存]      │
│  recipes_by_category.json               │
│  ingredients_index.json  [SQLite/IndexedDB]
└─────────────────────────────────────────┘
```

---

## 数据更新流程

当 HowToCook 项目更新时：

1. 重新下载 ZIP 文件
2. 运行 `parse_recipes.py` 脚本
3. 替换 APP 中的 JSON 文件
4. 微信小程序：重新提交审核
5. 安卓 APP：通过热更新或应用商店更新

```bash
# 一键更新数据
cd /mnt/agents/output
python parse_recipes.py
# 将生成的 JSON 文件复制到项目中
```

---

## 扩展建议

1. **图片资源**：当前 JSON 中 `image` 字段多为空或相对路径，建议：
   - 为每道菜拍摄/收集成品图
   - 使用 AI 生成统一风格的菜品插画
   - 存储到 CDN 或小程序云存储

2. **用户系统**：
   - 收藏功能需用户登录
   - 上传自己的菜谱评分
   - 收藏夹云端同步

3. **智能推荐**：
   - 基于冰箱剩余食材推荐菜谱
   - 根据季节推荐时令菜
   - 基于难度推荐适合新手的菜

4. **语音助手**：
   - 做饭时语音播报步骤
   - "下一步"/"重复"/"倒计时" 语音控制

5. **社区功能**：
   - 用户上传成品照片
   - 菜谱评论和改良建议
   - 打卡功能（做了哪些菜）
