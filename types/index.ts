
export interface Tool {
  id: string;
  title: string;
  icon_name: string;
  html_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  role: 'admin' | 'user';
  full_name?: string;
  avatar_url?: string;
  skills?: string[];
}
