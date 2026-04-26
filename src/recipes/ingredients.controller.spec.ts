import { Test, TestingModule } from '@nestjs/testing';
import { IngredientsController } from './ingredients.controller';
import { RecipesService } from './recipes.service';

describe('IngredientsController', () => {
  let controller: IngredientsController;
  let service: RecipesService;

  const mockRecipesService = {
    getIngredients: jest.fn().mockResolvedValue({
      total: 2,
      page: 1,
      limit: 20,
      data: [
        { id: 1, name: '猪肉' },
        { id: 2, name: '白菜' },
      ],
    }),
    getRecipesByIngredient: jest.fn().mockResolvedValue({
      ingredientId: 1,
      ingredientName: '猪肉',
      total: 1,
      page: 1,
      limit: 20,
      recipes: [
        {
          id: 'cat_1',
          name: '菜1',
          category: '荤菜',
          amount: '200g',
          is_optional: false,
          note: '',
        },
      ],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngredientsController],
      providers: [
        {
          provide: RecipesService,
          useValue: mockRecipesService,
        },
      ],
    }).compile();

    controller = module.get<IngredientsController>(IngredientsController);
    service = module.get<RecipesService>(RecipesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getIngredients', () => {
    it('should return paginated ingredients', async () => {
      const result = await controller.getIngredients();
      expect(service.getIngredients).toHaveBeenCalledWith({
        search: undefined,
        category: undefined,
        page: undefined,
        limit: undefined,
      });
      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);
    });

    it('should search ingredients by keyword', async () => {
      const result = await controller.getIngredients('猪肉', undefined, '1', '10');
      expect(service.getIngredients).toHaveBeenCalledWith({
        search: '猪肉',
        category: undefined,
        page: 1,
        limit: 10,
      });
      expect(result.data.length).toBe(2);
    });
  });

  describe('getRecipesByIngredient', () => {
    it('should return recipes using the ingredient', async () => {
      const result = await controller.getRecipesByIngredient('1', '1', '10');
      expect(service.getRecipesByIngredient).toHaveBeenCalledWith(1, {
        page: 1,
        limit: 10,
      });
      expect((result as any).ingredientName).toBe('猪肉');
      expect((result as any).recipes.length).toBe(1);
      expect((result as any).recipes[0].name).toBe('菜1');
    });

    it('should return bad request for invalid id', async () => {
      const result = await controller.getRecipesByIngredient('abc');
      expect((result as any).statusCode).toBe(400);
      expect((result as any).message).toBe('食材ID必须是数字');
    });
  });
});
