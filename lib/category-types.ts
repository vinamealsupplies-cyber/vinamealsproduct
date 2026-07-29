// Client-safe category tree types (no server-only).

export type CategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type CategoryNode = CategoryRow & { children: CategoryRow[] };
