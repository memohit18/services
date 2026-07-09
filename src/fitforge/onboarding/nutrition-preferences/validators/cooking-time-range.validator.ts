import { Max, Min } from 'class-validator';
import {
  COOKING_TIME_MAX,
  COOKING_TIME_MIN,
} from '../constants/nutrition-preferences.constants';

export function MinCookingTime() {
  return Min(COOKING_TIME_MIN);
}

export function MaxCookingTime() {
  return Max(COOKING_TIME_MAX);
}
