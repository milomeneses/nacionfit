import type { HabitId, Meals, ProjectIntensity } from '@nacionfit/shared';

export const HABITS: { id: HabitId; label: string }[] = [
  { id: 'meditacion', label: 'Meditación' },
  { id: 'lectura', label: 'Lectura' },
  { id: 'estiramiento', label: 'Estiramiento' },
  { id: 'sin_azucar', label: 'Sin azúcar' },
  { id: 'suplementos', label: 'Suplementos' },
  { id: 'pasos', label: '10.000 pasos' },
];

export const INTENSITY_OPTIONS: { value: ProjectIntensity; label: string }[] = [
  { value: 'low', label: 'Bajo' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Alto' },
  { value: 'crisis', label: 'Crisis' },
];

export const MOOD_OPTIONS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😔', label: 'Muy mal' },
  { value: 2, emoji: '😕', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Muy bien' },
];

export const MEAL_FIELDS: { key: keyof Meals; label: string }[] = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'almuerzo', label: 'Almuerzo' },
  { key: 'cena', label: 'Cena' },
  { key: 'snacks', label: 'Snacks' },
];

export const EMPTY_MEALS: Meals = {
  desayuno: '',
  almuerzo: '',
  cena: '',
  snacks: '',
};
