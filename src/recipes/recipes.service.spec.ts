import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { Recipe } from './entities/recipe.entity';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import * as pythonRunner from '../common/utils/python-runner';
import * as fs from 'fs';

jest.mock('../common/utils/python-runner');
jest.mock('fs');

describe('RecipesService', () => {
  let service: RecipesService;

  const mockRecipesList = {
    recipes: [
      { id: 'cat_1', name: '菜1', category: '荤菜', category_en: 'meat_dish', difficulty: 2 },
      { id: 'cat_2', name: '菜2', category: '素菜', category_en: 'vegetable_dish', difficulty: 1 },
    ],
  };

  const mockRecipesFull = {
    recipes: [
      {
        id: 'cat_1',
        name: '菜1',
        ingredients: [
          { name: '猪肉', amount: '200g', is_optional: false, note: '' },
          { name: '酱油', amount: '1勺', is_optional: false, note: '' },
          { name: '油、盐、料酒', amount: '', is_optional: false, note: '' },
        ],
        steps: [],
      },
      {
        id: 'cat_2',
        name: '菜2',
        ingredients: [
          { name: '白菜', amount: '300g', is_optional: false, note: '' },
          { name: '酱油', amount: '1勺', is_optional: false, note: '' },
          { name: '白醋/米醋', amount: '1勺', is_optional: false, note: '' },
        ],
        steps: [],
      },
    ],
  };

  const mockByCategory = {
    categories: [{ name: '荤菜', count: 1, recipes: [] }],
  };

  const mockIngredients = {
    ingredients: [{ name: '猪肉', frequency: 10 }, { name: '白菜', frequency: 5 }],
  };

  const mockMetadata = { total_recipes: 2, version: '1.0' };

  const mockRecipeRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockIngredientRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn(),
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRecipeIngredientRepository = {
    find: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest.fn(),
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('recipes_list.json')) return JSON.stringify(mockRecipesList);
      if (path.includes('recipes_full.json')) return JSON.stringify(mockRecipesFull);
      if (path.includes('recipes_by_category.json')) return JSON.stringify(mockByCategory);
      if (path.includes('ingredients_index.json')) return JSON.stringify(mockIngredients);
      if (path.includes('metadata.json')) return JSON.stringify(mockMetadata);
      return '{}';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: getRepositoryToken(Recipe), useValue: mockRecipeRepository },
        { provide: getRepositoryToken(Ingredient), useValue: mockIngredientRepository },
        { provide: getRepositoryToken(RecipeIngredient), useValue: mockRecipeIngredientRepository },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
    // 禁用启动时的自动更新
    jest.spyOn(service as any, 'onModuleInit').mockImplementation(async () => {
      await (service as any).loadData();
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateRecipes', () => {
    it('should run python script and reload data', async () => {
      (pythonRunner.runPythonScript as jest.Mock).mockResolvedValue({
        stdout: 'done',
        stderr: '',
        exitCode: 0,
      });

      mockIngredientRepository.find.mockResolvedValue([
        { id: 1, name: '猪肉' },
        { id: 2, name: '白菜' },
        { id: 3, name: '酱油' },
      ]);

      const result = await service.updateRecipes();
      expect(pythonRunner.runPythonScript).toHaveBeenCalledWith(
        expect.stringContaining('parse_recipes.py'),
        [],
        expect.objectContaining({ timeout: 300000 }),
      );
      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should throw HttpException on python failure', async () => {
      (pythonRunner.runPythonScript as jest.Mock).mockRejectedValue(
        new Error('Python failed'),
      );

      await expect(service.updateRecipes()).rejects.toThrow(HttpException);
    });
  });

  describe('syncToDatabase', () => {
    it('should sync recipes and split composite ingredients', async () => {
      await (service as any).loadData();
      mockRecipeRepository.findOne.mockResolvedValue(null);
      mockIngredientRepository.find.mockResolvedValue([
        { id: 1, name: '猪肉' },
        { id: 2, name: '白菜' },
        { id: 3, name: '酱油' },
        { id: 4, name: '油' },
        { id: 5, name: '盐' },
        { id: 6, name: '料酒' },
        { id: 7, name: '白醋' },
        { id: 8, name: '米醋' },
      ]);

      const result = await service.syncToDatabase();
      expect(result.synced).toBe(2);
      expect(mockIngredientRepository.upsert).toHaveBeenCalled();
      expect(mockRecipeIngredientRepository.upsert).toHaveBeenCalled();

      // 验证复合食材被拆分：油、盐、料酒 和 白醋/米醋
      expect(mockIngredientRepository.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = mockIngredientRepository.upsert.mock.calls[0][0];
      expect(Array.isArray(upsertArg)).toBe(true);
      // 检查 create 被调用时传入了拆分后的食材
      const createdNames = mockIngredientRepository.create.mock.calls
        .filter((call: any) => call[0] && call[0].name)
        .map((call: any) => call[0].name);
      expect(createdNames).toContain('油');
      expect(createdNames).toContain('盐');
      expect(createdNames).toContain('料酒');
      expect(createdNames).toContain('白醋');
      expect(createdNames).toContain('米醋');
    });
  });

  describe('getRecipesList', () => {
    beforeEach(async () => {
      await (service as any).loadData();
    });

    it('should return paginated recipes', async () => {
      const result = await service.getRecipesList({ page: 1, limit: 1 });
      expect(result.total).toBe(2);
      expect(result.data.length).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by category', async () => {
      const result = await service.getRecipesList({ category: '荤菜' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].category).toBe('荤菜');
    });
  });

  describe('getRecipeById', () => {
    beforeEach(async () => {
      await (service as any).loadData();
    });

    it('should return recipe by id', async () => {
      const result = await service.getRecipeById('cat_1');
      expect(result.name).toBe('菜1');
    });

    it('should throw 404 if not found', async () => {
      await expect(service.getRecipeById('not_exist')).rejects.toThrow(HttpException);
    });
  });

  describe('getRecipeIngredients', () => {
    it('should return ingredients with amounts for a recipe', async () => {
      mockRecipeRepository.findOne.mockResolvedValue({ id: 'cat_1', name: '菜1' });
      mockRecipeIngredientRepository.find.mockResolvedValue([
        {
          id: 1,
          recipe_id: 'cat_1',
          ingredient_id: 1,
          amount: '200g',
          is_optional: false,
          note: '',
          ingredient: { id: 1, name: '猪肉' },
        },
        {
          id: 2,
          recipe_id: 'cat_1',
          ingredient_id: 3,
          amount: '1勺',
          is_optional: false,
          note: '',
          ingredient: { id: 3, name: '酱油' },
        },
      ]);

      const result = await service.getRecipeIngredients('cat_1');
      expect(result.recipeId).toBe('cat_1');
      expect(result.ingredients.length).toBe(2);
      expect(result.ingredients[0].name).toBe('猪肉');
      expect(result.ingredients[0].amount).toBe('200g');
    });

    it('should throw 404 if recipe not found', async () => {
      mockRecipeRepository.findOne.mockResolvedValue(null);
      await expect(service.getRecipeIngredients('not_exist')).rejects.toThrow(HttpException);
    });
  });

  describe('getIngredients', () => {
    it('should return paginated ingredients', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(3),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, name: '猪肉' },
          { id: 2, name: '白菜' },
        ]),
      };
      mockIngredientRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getIngredients({ page: 1, limit: 10 });
      expect(result.total).toBe(3);
      expect(result.data.length).toBe(2);
      expect(mockIngredientRepository.createQueryBuilder).toHaveBeenCalledWith('i');
    });

    it('should filter by search keyword', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1, name: '猪肉' }]),
      };
      mockIngredientRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getIngredients({ search: '猪' });
      expect(result.total).toBe(1);
      expect(result.data[0].name).toBe('猪肉');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('i.name LIKE :search', { search: '%猪%' });
    });
  });

  describe('getRecipesByIngredient', () => {
    it('should return recipes using a specific ingredient', async () => {
      mockIngredientRepository.findOne.mockResolvedValue({ id: 3, name: '酱油' });
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            recipe_id: 'cat_1',
            ingredient_id: 3,
            amount: '1勺',
            is_optional: false,
            note: '',
            recipe: { id: 'cat_1', name: '菜1', category: '荤菜' },
          },
          {
            id: 2,
            recipe_id: 'cat_2',
            ingredient_id: 3,
            amount: '1勺',
            is_optional: false,
            note: '',
            recipe: { id: 'cat_2', name: '菜2', category: '素菜' },
          },
        ]),
      };
      mockRecipeIngredientRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRecipesByIngredient(3);
      expect(result.ingredientId).toBe(3);
      expect(result.ingredientName).toBe('酱油');
      expect(result.recipes.length).toBe(2);
      expect(result.recipes[0].name).toBe('菜1');
    });

    it('should throw 404 if ingredient not found', async () => {
      mockIngredientRepository.findOne.mockResolvedValue(null);
      await expect(service.getRecipesByIngredient(999)).rejects.toThrow(HttpException);
    });
  });

  describe('getRecipesByCategory', () => {
    beforeEach(async () => {
      await (service as any).loadData();
    });

    it('should return categories', async () => {
      const result = await service.getRecipesByCategory();
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('荤菜');
    });
  });

  describe('searchIngredients', () => {
    beforeEach(async () => {
      await (service as any).loadData();
    });

    it('should return all ingredients when no query', async () => {
      const result = await service.searchIngredients();
      expect(result.length).toBe(2);
    });

    it('should filter by query', async () => {
      const result = await service.searchIngredients('猪肉');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('猪肉');
    });
  });

  describe('getMetadata', () => {
    beforeEach(async () => {
      await (service as any).loadData();
    });

    it('should return metadata', async () => {
      const result = await service.getMetadata();
      expect(result.total_recipes).toBe(2);
    });
  });
});
