// Client-safe types for saved special-request phrases (no server-only imports).

export type SpecialRequest = {
  id: string;
  body: string;
  useCount: number;
  lastUsedAt: string;
};
