import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { IngredientsController } from './ingredients.controller';
import { Recipe } from './entities/recipe.entity';
import { Ingredient } from './entities/ingredient.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Recipe, Ingredient, RecipeIngredient])],
  controllers: [RecipesController, IngredientsController],
  providers: [RecipesService],
  exports: [RecipesService],
})
export class RecipesModule {}
