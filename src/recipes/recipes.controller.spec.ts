import { Test, TestingModule } from '@nestjs/testing';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

describe('RecipesController', () => {
  let controller: RecipesController;
  let service: RecipesService;

  const mockRecipesService = {
    updateRecipes: jest.fn().mockResolvedValue({
      success: true,
      message: '菜谱数据更新成功',
      total: 357,
    }),
    getRecipesList: jest.fn().mockResolvedValue({
      total: 2,
      page: 1,
      limit: 20,
      data: [{ id: '1', name: '菜1' }],
    }),
    getRecipeById: jest.fn().mockResolvedValue({
      id: '1',
      name: '菜1',
      ingredients: [],
      steps: [],
    }),
    getRecipesByCategory: jest.fn().mockResolvedValue([
      { name: '荤菜', count: 10, recipes: [] },
    ]),
    searchIngredients: jest.fn().mockResolvedValue([
      { name: '猪肉', frequency: 10 },
    ]),
    getMetadata: jest.fn().mockResolvedValue({
      total_recipes: 357,
      version: '1.0',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [
        {
          provide: RecipesService,
          useValue: mockRecipesService,
        },
      ],
    }).compile();

    controller = module.get<RecipesController>(RecipesController);
    service = module.get<RecipesService>(RecipesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateRecipes', () => {
    it('should call service.updateRecipes', async () => {
      const result = await controller.updateRecipes();
      expect(service.updateRecipes).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: '菜谱数据更新成功',
        total: 357,
      });
    });
  });

  describe('getRecipes', () => {
    it('should return recipes with pagination', async () => {
      const result = await controller.getRecipes('荤菜', '1', '10');
      expect(service.getRecipesList).toHaveBeenCalledWith({
        category: '荤菜',
        page: 1,
        limit: 10,
      });
      expect(result.data.length).toBe(1);
    });
  });

  describe('getCategories', () => {
    it('should return categories', async () => {
      const result = await controller.getCategories();
      expect(service.getRecipesByCategory).toHaveBeenCalled();
      expect(result[0].name).toBe('荤菜');
    });
  });

  describe('getMetadata', () => {
    it('should return metadata', async () => {
      const result = await controller.getMetadata();
      expect(service.getMetadata).toHaveBeenCalled();
      expect(result.total_recipes).toBe(357);
    });
  });

  describe('searchIngredients', () => {
    it('should search ingredients', async () => {
      const result = await controller.searchIngredients('猪肉', '5');
      expect(service.searchIngredients).toHaveBeenCalledWith('猪肉', 5);
      expect(result[0].name).toBe('猪肉');
    });
  });

  describe('getRecipeById', () => {
    it('should return single recipe', async () => {
      const result = await controller.getRecipeById('1');
      expect(service.getRecipeById).toHaveBeenCalledWith('1');
      expect(result.name).toBe('菜1');
    });
  });
});
