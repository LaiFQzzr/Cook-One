import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { Recipe } from './entities/recipe.entity';
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
      { id: 'cat_1', name: '菜1', ingredients: [], steps: [] },
      { id: 'cat_2', name: '菜2', ingredients: [], steps: [] },
    ],
  };

  const mockByCategory = {
    categories: [{ name: '荤菜', count: 1, recipes: [] }],
  };

  const mockIngredients = {
    ingredients: [{ name: '猪肉', frequency: 10 }, { name: '白菜', frequency: 5 }],
  };

  const mockMetadata = { total_recipes: 2, version: '1.0' };

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

    const mockRecipeRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: getRepositoryToken(Recipe), useValue: mockRecipeRepository },
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
