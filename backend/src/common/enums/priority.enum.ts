export enum Priority {
  BAIXA = 'baixa',
  MEDIA = 'media',
  ALTA = 'alta',
}

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  [Priority.ALTA]: 3,
  [Priority.MEDIA]: 2,
  [Priority.BAIXA]: 1,
};
