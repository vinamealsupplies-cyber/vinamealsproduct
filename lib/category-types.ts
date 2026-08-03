// Client-safe category tree types (no server-only).

export type CategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  /** Sales-tax class for products in this category: grocery | prepared_food | general. */
  taxCategory: string;
};

export type CategoryNode = CategoryRow & { children: CategoryRow[] };
