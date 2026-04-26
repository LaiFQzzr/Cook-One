-- ============================================================
-- cook-one-server MySQL 8.0 数据库表结构
-- ============================================================
-- 创建数据库（如不存在）
-- CREATE DATABASE IF NOT EXISTS cook_one_server
--   DEFAULT CHARACTER SET utf8mb4
--   DEFAULT COLLATE utf8mb4_unicode_ci;
-- USE cook_one_server;

-- ------------------------------------------------------------
-- 1. 用户表 (users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  avatar VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. 菜谱表 (recipes)
--    从 HowToCook 解析的 JSON 数据同步至此
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  category_en VARCHAR(50),
  difficulty INT DEFAULT 0 COMMENT '难度 1-5',
  difficulty_label VARCHAR(20) COMMENT '难度中文标签',
  description TEXT,
  servings VARCHAR(50) COMMENT '份量',
  image VARCHAR(500),
  ingredients JSON COMMENT '食材数组',
  steps JSON COMMENT '步骤数组',
  tips JSON COMMENT '小贴士数组',
  nutrition JSON COMMENT '营养信息',
  tools JSON COMMENT '工具数组',
  tags JSON COMMENT '标签数组',
  ref_links JSON COMMENT '参考链接数组',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_category_en (category_en),
  INDEX idx_name (name),
  FULLTEXT INDEX ft_name_desc (name, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. 成就定义表 (achievement_definitions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '成就唯一编码',
  name VARCHAR(100) NOT NULL COMMENT '成就名称',
  description VARCHAR(255) COMMENT '成就描述',
  icon VARCHAR(255) COMMENT '图标URL或标识',
  condition_type VARCHAR(50) NOT NULL COMMENT '条件类型: recipe_count, category_explorer, streak_days, difficulty_master 等',
  condition_value INT DEFAULT 0 COMMENT '条件阈值',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. 用户成就表 (user_achievements)
--    关联用户与已达成成就
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  achievement_id INT NOT NULL,
  progress INT DEFAULT 0 COMMENT '当前进度',
  achieved_at DATETIME COMMENT '达成时间（NULL表示进行中）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_achievement (user_id, achievement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. 食材采购单表 (shopping_items)
--    类似购物车，保存用户待采购食材
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shopping_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  ingredient_name VARCHAR(100) NOT NULL COMMENT '食材名称',
  amount VARCHAR(50) COMMENT '数量/用量',
  unit VARCHAR(20) COMMENT '单位',
  note VARCHAR(255) COMMENT '备注',
  recipe_id VARCHAR(100) COMMENT '来源菜谱ID',
  meal_plan_id INT COMMENT '来源备餐计划ID',
  is_checked TINYINT(1) DEFAULT 0 COMMENT '是否已采购(0-未采购,1-已采购)',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
  INDEX idx_user_checked (user_id, is_checked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. 备餐计划表 (meal_plans)
--    保存用户下一餐/某日打算制作的菜品计划
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  plan_date DATE NOT NULL COMMENT '计划日期',
  meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack') DEFAULT 'lunch' COMMENT '餐别',
  note VARCHAR(255) COMMENT '备注',
  status ENUM('planned', 'completed', 'cancelled') DEFAULT 'planned' COMMENT '计划状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, plan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. 备餐计划菜谱关联表 (meal_plan_recipes)
--    一个备餐计划可包含多道菜
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_plan_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meal_plan_id INT NOT NULL,
  recipe_id VARCHAR(100) NOT NULL,
  servings_adjust INT DEFAULT 1 COMMENT '份量调整倍数',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  UNIQUE KEY uk_meal_recipe (meal_plan_id, recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 8. 用户偏好表 (user_preferences)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  preference_key VARCHAR(50) NOT NULL COMMENT '偏好键: dietary, cuisine, spicy_level, avoid_ingredients 等',
  preference_value VARCHAR(255) NOT NULL COMMENT '偏好值',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_pref (user_id, preference_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 9. 食材表 (ingredients)
--    保存去重后的标准化食材
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE COMMENT '食材名称',
  category VARCHAR(50) COMMENT '食材分类',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 10. 食谱-食材关联表 (recipe_ingredients)
--     记录每个食谱所需的具体食材及用量
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id VARCHAR(100) NOT NULL COMMENT '菜谱ID',
  ingredient_id INT NOT NULL COMMENT '食材ID',
  amount VARCHAR(100) COMMENT '用量/数量',
  is_optional TINYINT(1) DEFAULT 0 COMMENT '是否可选(0-必需,1-可选)',
  note TEXT COMMENT '备注',
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  UNIQUE KEY uk_recipe_ingredient (recipe_id, ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 初始数据
-- ============================================================

-- 成就定义初始数据
INSERT INTO achievement_definitions (code, name, description, icon, condition_type, condition_value, sort_order) VALUES
('first_cook', '初次下厨', '完成第一次备餐计划', '🔰', 'meal_plan_count', 1, 1),
('cook_10', '熟练厨师', '累计完成 10 次备餐计划', '👨‍🍳', 'meal_plan_count', 10, 2),
('cook_50', '料理达人', '累计完成 50 次备餐计划', '⭐', 'meal_plan_count', 50, 3),
('cook_100', '百餐大师', '累计完成 100 次备餐计划', '👑', 'meal_plan_count', 100, 4),
('category_explorer', '品类探索者', '尝试 5 个不同分类的菜谱', '🍱', 'category_count', 5, 5),
('streak_7', '七日连厨', '连续 7 天完成备餐计划', '🔥', 'streak_days', 7, 6),
('streak_30', '月度坚持', '连续 30 天完成备餐计划', '💪', 'streak_days', 30, 7),
('hard_mode', '挑战高难度', '完成一道难度 5 星的菜品', '🌶️', 'difficulty_max', 5, 8)
ON DUPLICATE KEY UPDATE name = VALUES(name);