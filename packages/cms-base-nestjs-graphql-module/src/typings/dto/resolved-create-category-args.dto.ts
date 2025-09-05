export interface ResolvedCreateCategoryArgsDto {
  parentIds?: string[] | null;
  // Single language fields (optional)
  name?: string;
  // Multi language fields (optional)
  multiLanguageNames?: Record<string, string>;
  // Allow additional custom fields
  [key: string]: any;
}
