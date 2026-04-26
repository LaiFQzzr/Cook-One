#!/usr/bin/env python3
"""
HowToCook 菜谱解析脚本
将 HowToCook 项目的 Markdown 菜谱解析为结构化的 JSON 格式
适用于微信小程序和安卓 APP 的数据源
"""

import os
import re
import json
import zipfile
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
import urllib.request


@dataclass
class Ingredient:
    """食材信息"""
    name: str                    # 食材名称
    amount: str = ""             # 用量（保留原始描述）
    is_optional: bool = False    # 是否可选
    note: str = ""               # 备注（如推荐品牌等）


@dataclass
class RecipeStep:
    """烹饪步骤"""
    step_number: int             # 步骤序号
    description: str             # 步骤描述
    time_hint: str = ""          # 时间提示
    tips: str = ""               # 步骤提示


@dataclass
class Recipe:
    """菜谱信息"""
    id: str                      # 唯一标识
    name: str                    # 菜名
    category: str                # 分类（中文）
    category_en: str             # 分类（英文/代码）
    difficulty: int              # 难度 1-5
    description: str = ""        # 简介/描述
    ingredients: List[Ingredient] = field(default_factory=list)
    steps: List[RecipeStep] = field(default_factory=list)
    tips: List[str] = field(default_factory=list)        # 附加提示
    nutrition: Dict[str, str] = field(default_factory=dict)  # 营养成分
    references: List[str] = field(default_factory=list)  # 参考资料
    image: str = ""              # 图片路径
    servings: str = ""           # 份量说明
    tools: List[str] = field(default_factory=list)       # 所需工具
    tags: List[str] = field(default_factory=list)        # 标签


# 分类映射
CATEGORY_MAP = {
    'aquatic': '水产',
    'breakfast': '早餐',
    'condiment': '调料',
    'dessert': '甜品',
    'drink': '饮品',
    'meat_dish': '荤菜',
    'semi-finished': '半成品',
    'soup': '汤羹',
    'staple': '主食',
    'vegetable_dish': '素菜'
}

# 工具黑名单（通用厨房工具，不需要列出）
TOOLS_BLACKLIST = {
    '燃气灶', '饮用水', '锅', '食用油', '碗与盘子', '筷子', '炒勺',
    '洗涤剂', '抹布', '钢丝球', '菜刀', '砧板', '厨房纸巾',
    '平底锅', '保鲜膜', '微波炉', '空气炸锅', '冰箱', '电饭煲',
    '高压锅', '砂锅', '炖锅', '煮锅', '炒锅', '烤箱',
    '耐热碗', '微波炉专用盖', '汤锅', '蒸锅', '铲子', '勺子',
    '盘子', '碗', '筷子', '叉子', '刀', '剪刀',
    '厨房纸', '漏勺', '计时器', '温度计'
}


def extract_difficulty(text: str) -> int:
    """提取难度星级"""
    match = re.search(r'[★★★★★]', text)
    if match:
        return match.group(0).count('★')
    return 0


def clean_text(text: str) -> str:
    """清理文本"""
    # 移除 Markdown 注释
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    # 移除 HTML 标签
    text = re.sub(r'<[^>]+>', '', text)
    # 移除图片引用
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    # 清理多余空白
    text = ' '.join(text.split())
    return text.strip()


def split_composite_ingredient(name: str) -> List[str]:
    """
    拆分复合食材名称。

    支持的分隔符：顿号、逗号、斜杠、英文 or、加号
    例如：
    - "油、盐、生抽" -> ["油", "盐", "生抽"]
    - "白醋/米醋" -> ["白醋", "米醋"]
    - "黑虎虾 or 明虾" -> ["黑虎虾", "明虾"]
    - "肉蟹 1 只  份数" -> ["肉蟹"]
    - "葱 = 一根大葱" -> ["葱"]
    """
    if not name or not isinstance(name, str):
        return []

    # 替换替代分隔符为顿号
    text = re.sub(r'\s+or\s+', '、', name, flags=re.IGNORECASE)
    text = re.sub(r'\s*/\s*', '、', text)
    text = re.sub(r'\s*\+\s*', '、', text)

    # 按分隔符拆分
    parts = re.split(r'[、，,]', text)

    results = []
    for part in parts:
        part = part.strip()
        if not part:
            continue

        # 去掉前缀标记（主料、辅料、必备、可选等）
        part = re.sub(r'^(主料|辅料|必备|可选|必选|工具)[：:]?\s*', '', part, flags=re.IGNORECASE)

        # 去掉括号及内容
        part = re.sub(r'[（(][^)）]*[)）]', '', part)

        # 去掉 = 或 : 后面的内容（保留前面作为食材名）
        m = re.search(r'[:=：＝]', part)
        if m and m.start() > 0:
            part = part[:m.start()].strip()

        # 过滤注释行
        if re.match(r'^注[：:]?', part):
            continue

        # 过滤纯数字
        if re.match(r'^\d+(\.\d+)?$', part):
            continue

        # 过滤纯操作/状态词
        skip_patterns = [
            r'小火', r'中火', r'大火', r'文火', r'武火',
            r'三成热', r'五成热', r'七成热', r'八成热',
            r'油温', r'少许', r'适量', r'若干', r'备用', r'待用',
            r'根据口味', r'根据喜好', r'^等等$', r'^约$', r'^左右$',
        ]
        if any(re.search(p, part) for p in skip_patterns):
            continue

        # 去掉尾部阿拉伯数字+单位/量词
        part = re.sub(
            r'\s+\d[\d\s\.\-/~×xX\+\=]*[gmlkL个只份勺瓶包袋盒罐条根片块头尾把株颗粒碗盘杯张件套双打捆扎斤两钱吨磅cm毫米微米纳米]?$',
            '', part, flags=re.IGNORECASE
        )
        # 去掉尾部中文数字+常见量词
        part = re.sub(
            r'\s+[一二两三四五六七八九十百千万亿]+[个只份勺瓶包袋盒罐条根片块头尾把株颗粒碗盘杯张件套双]+$',
            '', part
        )
        # 去掉尾部常见量词/描述
        part = re.sub(r'\s+(份数|适量|少许|若干|备用|待用|约|左右)$', '', part)

        part = part.strip()
        if part and len(part) >= 1:
            results.append(part)

    return results


def parse_ingredient_line(line: str) -> List[Ingredient]:
    """解析食材行，复合食材会被拆分为多个 Ingredient"""
    line = line.strip().lstrip('- ').lstrip('* ')
    if not line:
        return []

    # 检测是否可选
    is_optional = '可选' in line or '推荐' in line

    # 提取备注（括号内的内容）
    note = ""
    note_match = re.search(r'[（(]([^)）]+)[)）]', line)
    if note_match:
        note = note_match.group(1)
        line = line[:note_match.start()] + line[note_match.end():]

    # 解析食材名和用量
    # 尝试匹配 "食材名 数量单位" 的格式
    amount_patterns = [
        r'^(.+?)\s+(\d+[\d\s\-~—]*(?:\.\d+)?\s*(?:g|克|kg|千克|ml|毫升|L|升|个|只|根|片|瓣|勺|汤匙|茶匙|杯|碗|滴|粒|块|条|包|把|罐|瓶|根|头|朵|束|盒|袋|根|颗|节|斤|两|斤|盎司|磅|cup|tbsp|tsp|oz|lb|ml|g|kg|个|cm|毫米|斤))$',
        r'^(.+?)\s+([\d\-~—]+\s*(?:g|克|kg|ml|毫升|L|个|只|根|片|瓣|勺|杯|碗|滴|粒|块|条|包|把|罐|瓶|头|朵|束|盒|袋|颗|节|斤|两))$',
    ]

    raw_name = line.strip()
    amount = ""

    for pattern in amount_patterns:
        match = re.match(pattern, line, re.IGNORECASE)
        if match:
            raw_name = match.group(1).strip()
            amount = match.group(2).strip()
            break

    # 清理名称中的特殊标记
    raw_name = re.sub(r'[*\[\]`]', '', raw_name).strip()

    # 拆分复合食材
    names = split_composite_ingredient(raw_name)

    results = []
    for name in names:
        # 跳过纯工具项
        if name in TOOLS_BLACKLIST or len(name) < 1:
            continue

        results.append(Ingredient(
            name=name,
            amount=amount,
            is_optional=is_optional,
            note=note
        ))

    return results


def parse_recipe_file(filepath: str, category_en: str) -> Optional[Recipe]:
    """解析单个菜谱文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"  错误: 无法读取文件 {filepath}: {e}")
        return None
    
    # 跳过模板文件
    if '示例菜' in content and '模板' in filepath:
        return None
    
    lines = content.split('\n')
    
    # 提取菜名（从标题或文件名）
    recipe_name = ""
    title_match = re.search(r'^#\s+(.+?)的做法', content, re.MULTILINE)
    if title_match:
        recipe_name = title_match.group(1).strip()
    else:
        # 从文件名提取
        filename = os.path.basename(filepath).replace('.md', '')
        # 解码 Unicode 转义序列
        try:
            filename = filename.encode('utf-8').decode('unicode_escape')
        except:
            pass
        recipe_name = filename
    
    if not recipe_name:
        return None
    
    # 生成唯一ID
    recipe_id = f"{category_en}_{recipe_name}"
    
    # 提取难度
    difficulty = 0
    diff_match = re.search(r'预估烹饪难度：([★]+)', content)
    if diff_match:
        difficulty = diff_match.group(1).count('★')
    
    # 提取描述（标题后的第一段文字）
    description = ""
    desc_match = re.search(r'^#\s+.+?的做法\s*\n+([^#\n].*?)(?:\n\n|\n##)', content, re.MULTILINE | re.DOTALL)
    if desc_match:
        description = clean_text(desc_match.group(1))
    
    # 提取图片
    image = ""
    img_match = re.search(r'!\[([^]]*)\]\(([^)]+)\)', content)
    if img_match:
        image = img_match.group(2)
    
    # 解析各个部分
    ingredients = []
    tools = []
    steps = []
    tips = []
    nutrition = {}
    references = []
    servings = ""
    
    current_section = None
    step_number = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # 识别章节
        if stripped.startswith('## '):
            section_name = stripped[3:].strip()
            if '原料' in section_name or '食材' in section_name or '材料' in section_name:
                current_section = 'ingredients'
            elif '计算' in section_name:
                current_section = 'calculation'
            elif '操作' in section_name or '步骤' in section_name or '做法' in section_name:
                current_section = 'steps'
                step_number = 0
            elif '附加' in section_name or '注意' in section_name or '提示' in section_name:
                current_section = 'tips'
            elif '营养' in section_name:
                current_section = 'nutrition'
            elif '参考' in section_name:
                current_section = 'references'
            else:
                current_section = section_name.lower()
            continue
        
        # 跳空行和注释
        if not stripped or stripped.startswith('<!--') or stripped.startswith('-->'):
            continue
        
        # 处理子标题（###）作为步骤分组
        if stripped.startswith('### '):
            if current_section == 'steps':
                step_number += 1
                step_title = stripped[4:].strip()
                steps.append(RecipeStep(
                    step_number=step_number,
                    description=step_title,
                    time_hint="",
                    tips=""
                ))
            continue
        
        # 解析食材（必备原料和工具部分）
        if current_section == 'ingredients' and stripped.startswith('- '):
            item = stripped[2:].strip()
            # 区分工具和食材
            is_tool = item in TOOLS_BLACKLIST or any(t in item for t in ['锅', '刀', '碗', '盘', '微波炉', '烤箱', '冰箱'])
            if is_tool and len(item) < 10:
                tools.append(item)
            else:
                for ing in parse_ingredient_line(stripped):
                    if ing.name not in [i.name for i in ingredients]:
                        ingredients.append(ing)
        
        # 解析计算部分（更精确的用量）
        elif current_section == 'calculation' and stripped.startswith('- '):
            for ing in parse_ingredient_line(stripped):
                # 更新已有食材的用量或添加新食材
                existing = next((i for i in ingredients if i.name == ing.name or ing.name in i.name or i.name in ing.name), None)
                if existing:
                    existing.amount = ing.amount
                    if ing.note:
                        existing.note = ing.note
                else:
                    # 避免添加纯数字或单位行
                    if ing.name and not re.match(r'^\d+$', ing.name):
                        ingredients.append(ing)
            
            # 检测份量说明
            if '份' in stripped and ('人' in stripped or '吃' in stripped):
                servings = stripped[2:].strip()
        
        # 解析步骤
        elif current_section == 'steps' and stripped.startswith('- '):
            step_number += 1
            step_desc = stripped[2:].strip()
            
            # 提取时间提示（加粗或斜体的时间信息）
            time_hint = ""
            time_match = re.search(r'\*\*等待\s+(.+?)\*\*', step_desc) or \
                         re.search(r'\*\*(.+?分钟.*?)\*\*', step_desc) or \
                         re.search(r'\*\*(.+?小时.*?)\*\*', step_desc) or \
                         re.search(r'\*\*(.+?秒.*?)\*\*', step_desc)
            if time_match:
                time_hint = time_match.group(1)
            
            # 清理步骤描述
            clean_desc = re.sub(r'\*\*(.+?)\*\*', r'\1', step_desc)
            clean_desc = re.sub(r'\*(.+?)\*', r'\1', clean_desc)
            
            # 检测步骤内提示（以<!-- -->包裹的内容已在clean_text中处理）
            step_tips = ""
            
            steps.append(RecipeStep(
                step_number=step_number,
                description=clean_desc,
                time_hint=time_hint,
                tips=step_tips
            ))
        
        # 解析提示/附加内容
        elif current_section == 'tips':
            if stripped.startswith('- '):
                tip = stripped[2:].strip()
                # 清理Markdown格式
                tip = clean_text(tip)
                if tip and len(tip) > 3:
                    tips.append(tip)
            elif stripped.startswith('> '):
                tip = stripped[2:].strip()
                tip = clean_text(tip)
                if tip and len(tip) > 3:
                    tips.append(tip)
        
        # 解析营养成分
        elif current_section == 'nutrition':
            if stripped.startswith('- ') or stripped.startswith('* '):
                item = stripped[2:].strip()
                nut_match = re.match(r'(.+?)\s+(\d+\.?\d*\s*[\w克千卡]+)', item)
                if nut_match:
                    nutrition[nut_match.group(1).strip()] = nut_match.group(2)
        
        # 解析参考资料
        elif current_section == 'references':
            ref_match = re.search(r'\[([^]]+)\]\(([^)]+)\)', stripped)
            if ref_match:
                references.append({
                    'title': ref_match.group(1),
                    'url': ref_match.group(2)
                })
    
    # 生成标签
    tags = []
    if difficulty <= 1:
        tags.append('简单')
    elif difficulty >= 4:
        tags.append('挑战')
    if category_en in CATEGORY_MAP:
        tags.append(CATEGORY_MAP[category_en])
    
    return Recipe(
        id=recipe_id,
        name=recipe_name,
        category=CATEGORY_MAP.get(category_en, category_en),
        category_en=category_en,
        difficulty=difficulty,
        description=description,
        ingredients=ingredients,
        steps=steps,
        tips=tips,
        nutrition=nutrition,
        references=references,
        image=image,
        servings=servings,
        tools=tools,
        tags=tags
    )


def extract_zip_and_parse(zip_path: str, extract_to: str = "/tmp/howtocook_extracted") -> List[Recipe]:
    """
    从 ZIP 文件提取并解析所有菜谱
    
    Args:
        zip_path: ZIP 文件路径
        extract_to: 解压目标目录
    
    Returns:
        List[Recipe]: 解析后的菜谱列表
    """
    # 清理并解压
    if os.path.exists(extract_to):
        shutil.rmtree(extract_to)
    
    print(f"正在解压 {zip_path} ...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(extract_to)
    
    # 找到 dishes 目录
    dishes_dir = None
    for root, dirs, files in os.walk(extract_to):
        if 'dishes' in dirs:
            dishes_dir = os.path.join(root, 'dishes')
            break
    
    if not dishes_dir:
        raise ValueError("无法在 ZIP 中找到 dishes 目录")
    
    print(f"找到菜谱目录: {dishes_dir}")
    
    # 解析所有菜谱
    recipes = []
    category_stats = {}
    
    for category_en in os.listdir(dishes_dir):
        category_path = os.path.join(dishes_dir, category_en)
        
        # 跳过非目录项和模板
        if not os.path.isdir(category_path) or category_en == 'template':
            continue
        
        category_name = CATEGORY_MAP.get(category_en, category_en)
        category_count = 0
        
        print(f"\n正在解析分类: {category_name} ({category_en})")
        
        # 递归遍历该分类下的所有 .md 文件
        for root, _, files in os.walk(category_path):
            for filename in files:
                if not filename.endswith('.md'):
                    continue
                
                filepath = os.path.join(root, filename)
                recipe = parse_recipe_file(filepath, category_en)
                
                if recipe:
                    recipes.append(recipe)
                    category_count += 1
        
        category_stats[category_name] = category_count
        print(f"  解析完成: {category_count} 个菜谱")
    
    print(f"\n{'='*50}")
    print(f"解析完成！总计: {len(recipes)} 个菜谱")
    print(f"分类统计:")
    for cat, count in sorted(category_stats.items()):
        print(f"  - {cat}: {count} 个")
    
    return recipes


def convert_to_dict(recipe: Recipe) -> dict:
    """将 Recipe 对象转换为字典"""
    return {
        'id': recipe.id,
        'name': recipe.name,
        'category': recipe.category,
        'category_en': recipe.category_en,
        'difficulty': recipe.difficulty,
        'difficulty_label': '★' * recipe.difficulty + '☆' * (5 - recipe.difficulty),
        'description': recipe.description,
        'servings': recipe.servings,
        'image': recipe.image,
        'ingredients': [
            {
                'name': ing.name,
                'amount': ing.amount,
                'is_optional': ing.is_optional,
                'note': ing.note
            }
            for ing in recipe.ingredients
        ],
        'steps': [
            {
                'step_number': step.step_number,
                'description': step.description,
                'time_hint': step.time_hint
            }
            for step in recipe.steps
        ],
        'tips': recipe.tips,
        'nutrition': recipe.nutrition,
        'tools': recipe.tools,
        'tags': recipe.tags,
        'references': recipe.references
    }


def save_to_json(recipes: List[Recipe], output_dir=None):
    """
    保存解析结果到 JSON 文件
    
    生成多个 JSON 文件以适应不同使用场景：
    1. recipes_full.json - 完整数据
    2. recipes_list.json - 菜谱列表（无步骤详情，用于列表页）
    3. recipes_by_category.json - 按分类组织的菜谱
    4. ingredients_index.json - 食材索引（可用于食材搜索功能）
    """
    if output_dir is None:
        output_dir = Path(__file__).resolve().parent / "output"
    else:
        output_dir = Path(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. 保存完整数据
    recipes_data = [convert_to_dict(r) for r in recipes]
    
    full_path = os.path.join(output_dir, "recipes_full.json")
    with open(full_path, 'w', encoding='utf-8') as f:
        json.dump({
            'version': '1.0',
            'total': len(recipes),
            'generated_at': '2026-04-19',
            'recipes': recipes_data
        }, f, ensure_ascii=False, indent=2)
    print(f"\n已保存完整数据: {full_path} ({len(recipes)} 个菜谱)")
    
    # 2. 保存菜谱列表（轻量级，用于列表展示）
    list_data = []
    for r in recipes:
        list_data.append({
            'id': r.id,
            'name': r.name,
            'category': r.category,
            'category_en': r.category_en,
            'difficulty': r.difficulty,
            'difficulty_label': '★' * r.difficulty + '☆' * (5 - r.difficulty),
            'description': r.description[:100] + '...' if len(r.description) > 100 else r.description,
            'image': r.image,
            'tags': r.tags,
            'ingredient_count': len(r.ingredients),
            'step_count': len(r.steps)
        })
    
    list_path = os.path.join(output_dir, "recipes_list.json")
    with open(list_path, 'w', encoding='utf-8') as f:
        json.dump({
            'version': '1.0',
            'total': len(list_data),
            'recipes': list_data
        }, f, ensure_ascii=False, indent=2)
    print(f"已保存列表数据: {list_path}")
    
    # 3. 按分类组织的菜谱
    by_category = {}
    for r in recipes:
        cat = r.category
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(convert_to_dict(r))
    
    cat_path = os.path.join(output_dir, "recipes_by_category.json")
    with open(cat_path, 'w', encoding='utf-8') as f:
        json.dump({
            'version': '1.0',
            'categories': [
                {
                    'name': cat,
                    'name_en': CATEGORY_MAP.get(cat, cat),
                    'count': len(items),
                    'recipes': items
                }
                for cat, items in by_category.items()
            ]
        }, f, ensure_ascii=False, indent=2)
    print(f"已保存分类数据: {cat_path}")
    
    # 4. 食材索引（用于搜索和购物车功能）
    ingredient_index = {}
    for r in recipes:
        for ing in r.ingredients:
            name = ing.name
            if name not in ingredient_index:
                ingredient_index[name] = {
                    'name': name,
                    'recipes': [],
                    'categories': set(),
                    'frequency': 0
                }
            ingredient_index[name]['recipes'].append({
                'id': r.id,
                'name': r.name,
                'amount': ing.amount,
                'is_optional': ing.is_optional
            })
            ingredient_index[name]['categories'].add(r.category)
            ingredient_index[name]['frequency'] += 1
    
    # 转换为列表并排序（按使用频率）
    ingredient_list = []
    for name, data in ingredient_index.items():
        data['categories'] = list(data['categories'])
        data['recipe_count'] = len(data['recipes'])
        del data['recipes']  # 减小体积，保留引用计数即可
        ingredient_list.append(data)
    
    ingredient_list.sort(key=lambda x: x['frequency'], reverse=True)
    
    ing_path = os.path.join(output_dir, "ingredients_index.json")
    with open(ing_path, 'w', encoding='utf-8') as f:
        json.dump({
            'version': '1.0',
            'total_unique': len(ingredient_list),
            'ingredients': ingredient_list
        }, f, ensure_ascii=False, indent=2)
    print(f"已保存食材索引: {ing_path}")
    
    # 5. 生成元数据文件（用于APP配置）
    meta_path = os.path.join(output_dir, "metadata.json")
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump({
            'version': '1.0',
            'generated_at': '2026-04-19',
            'source': 'HowToCook GitHub Repository',
            'source_url': 'https://github.com/Anduin2017/HowToCook',
            'total_recipes': len(recipes),
            'categories': [
                {'name': cat, 'name_en': en, 'count': len(by_category.get(cat, []))}
                for en, cat in CATEGORY_MAP.items()
            ],
            'difficulty_distribution': {
                f'level_{i}': len([r for r in recipes if r.difficulty == i])
                for i in range(1, 6)
            },
            'files': {
                'full': 'recipes_full.json',
                'list': 'recipes_list.json',
                'by_category': 'recipes_by_category.json',
                'ingredients': 'ingredients_index.json'
            },
            'data_structure': {
                'recipe': {
                    'id': 'string - 唯一标识',
                    'name': 'string - 菜名',
                    'category': 'string - 分类（中文）',
                    'category_en': 'string - 分类代码',
                    'difficulty': 'number - 难度 1-5',
                    'description': 'string - 简介',
                    'servings': 'string - 份量说明',
                    'image': 'string - 图片路径',
                    'ingredients': 'array - 食材列表',
                    'steps': 'array - 步骤列表',
                    'tips': 'array - 提示列表',
                    'nutrition': 'object - 营养成分',
                    'tools': 'array - 所需工具',
                    'tags': 'array - 标签'
                }
            }
        }, f, ensure_ascii=False, indent=2)
    print(f"已保存元数据: {meta_path}")
    
    return {
        'full': full_path,
        'list': list_path,
        'by_category': cat_path,
        'ingredients': ing_path,
        'metadata': meta_path
    }

def find_zip():
    current_dir = Path(__file__).resolve().parent
    zip_path = current_dir / "HowToCook.zip"  # ✅ 必须先定义
    
    matches = list(current_dir.glob("*HowToCook*.zip"))
    
    if matches:
        return matches[0]
    else:
        print("ZIP 文件不存在，正在下载...")
        url = "https://github.com/Anduin2017/HowToCook/archive/refs/heads/master.zip"
        urllib.request.urlretrieve(url, zip_path)
        print(f"下载完成: {zip_path}")
        return zip_path

def main():
    """主函数"""
    
    # 解析菜谱
    recipes = extract_zip_and_parse(find_zip())
    
    if not recipes:
        print("未解析到任何菜谱，请检查 ZIP 文件内容")
        return
    
    # 保存为 JSON
    output_files = save_to_json(recipes)
    
    print(f"\n{'='*50}")
    print("全部完成！生成的文件:")
    for name, path in output_files.items():
        size = os.path.getsize(path)
        print(f"  [{name}] {path} ({size:,} bytes)")


if __name__ == "__main__":
    main()
