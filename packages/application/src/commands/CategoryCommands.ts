// ============================================
// Category Command DTOs
// ============================================

export interface CreateCategoryCommand {
  name: string;
  color?: string;
  icon?: string;
}

export interface CreateCategoryResult {
  categoryId: string;
}

export interface DeleteCategoryCommand {
  categoryId: string;
}

export interface DeleteCategoryResult {
  success: boolean;
}
