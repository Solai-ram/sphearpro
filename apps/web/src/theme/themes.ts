export const THEMES = [
  {
    id: 'clinical-blue',
    name: 'Clinical Blue',
    description: 'Clean medical UI with sky-blue accents',
    swatches: ['#eff6ff', '#2563eb', '#0f172a'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark navy workspace for low-glare screens',
    swatches: ['#0f172a', '#38bdf8', '#e2e8f0'],
  },
  {
    id: 'emerald-care',
    name: 'Emerald Care',
    description: 'Calming green for therapy and wellness',
    swatches: ['#ecfdf5', '#059669', '#064e3b'],
  },
  {
    id: 'sunset-coral',
    name: 'Sunset Coral',
    description: 'Warm terracotta accents on cream',
    swatches: ['#fff7ed', '#ea580c', '#7c2d12'],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'clinical-blue';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
