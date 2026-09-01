export type ToolKind = 'inline' | 'bundle' | 'link';
export type ToolCategory = 'game' | 'web' | 'mobile' | 'tool';

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  game: 'Games',
  web: 'Web Apps',
  mobile: 'Mobile Apps',
  tool: 'Tools',
};

export interface Tool {
  id: string;
  title: string;
  /** Nullable since the migration: bundle rows fall back to a default icon. */
  icon_name: string | null;
  /** Only present for kind === 'inline'. */
  html_code: string | null;

  kind: ToolKind;
  category: ToolCategory;
  /** Folder prefix inside the games bucket. Only for kind === 'bundle'. */
  storage_path: string | null;
  /** Relative HTML entry point inside storage_path. */
  entry_path: string;

  description: string | null;
  thumbnail_url: string | null;
  tags: string[];
  /** Tech used, shown on the card. e.g. ['Three.js', 'WebGL'] */
  tech: string[];
  /** What he did on it, for client work where he was not the only person. */
  role_note: string | null;
  /** Button label inside the project popup. Falls back to a per-kind default. */
  cta_label: string | null;
  /** Live link for work not hosted here (Play Store, client site, game portal). */
  external_url: string | null;
  source_url: string | null;
  year: number | null;

  play_count: number;
  sort_order: number;
  is_published: boolean;
  is_featured: boolean;

  bundle_bytes: number | null;
  file_count: number | null;

  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  role: 'admin' | 'user';
  full_name?: string | null;
  avatar_url?: string | null;
  skills?: string[] | null;
  tagline?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  fiverr_url?: string | null;
  location?: string | null;
  /** Photos for the About carousel, in display order. */
  gallery?: string[] | null;
}

export interface Message {
  id: string;
  name: string;
  email: string;
  body: string;
  is_read: boolean;
  created_at: string;
}
