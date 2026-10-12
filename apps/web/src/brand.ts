/**
 * The names, kept in one place so the provisional product name can change. Every other word the
 * interface shows lives in the catalogues (src/i18n, P6-02).
 */
export const brand = {
  name: 'Dear Steven',
  host: { fullName: 'Steven Bartlett', firstName: 'Steven' },
  show: 'The Diary Of A CEO',
} as const;

export type Brand = typeof brand;
