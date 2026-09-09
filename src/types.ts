import type {SiteContent} from './siteContent';
export type PublishStatus = 'draft' | 'published';
export type ContentType = 'article' | 'video' | 'gallery';
export type WorkShowcaseType = 'image' | 'video';
export type WorkShowcaseLayout = 'wide' | 'portrait' | 'standard';

export interface Work {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  problem: string;
  solution: string;
  result: string;
  stack: string[];
  cover_url: string;
  showcase_url: string;
  showcase_type: WorkShowcaseType;
  showcase_layout: WorkShowcaseLayout;
  showcase_highlight: string;
  showcase_cta: string;
  status: PublishStatus;
  featured: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  cover_url: string;
  content_type: ContentType;
  video_url: string;
  status: PublishStatus;
  published_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface ResumeData {
  profile: string;
  availability: string;
  location: string;
  email: string;
  pdf_enabled: boolean;
  pdf_kicker: string;
  pdf_title: string;
  pdf_description: string;
  pdf_url: string;
  pdf_file_name: string;
  pdf_show_open: boolean;
  pdf_show_download: boolean;
  experience: Array<{ period: string; role: string; company: string; detail: string }>;
  education: Array<{ period: string; title: string; place: string }>;
  skills: string[];
}

export interface SiteSettings {
  name: string;
  role: string;
  hero_prefix: string;
  hero_emphasis: string;
  hero_suffix: string;
  hero_description: string;
  hero_video_url: string;
  email: string;
  location: string;
}

export interface AvatarPreset {
  question: string;
  answer: string;
}

export interface AvatarSettings {
  enabled: boolean;
  name: string;
  subtitle: string;
  welcome: string;
  placeholder: string;
  suggestions: string[];
}

export interface AvatarAdminSettings extends AvatarSettings {
  system_prompt: string;
  knowledge: string;
  presets: AvatarPreset[];
  max_output_tokens: number;
}

export interface MediaItem {
  id: string;
  key: string;
  name: string;
  url: string;
  content_type: string;
  size: number;
  created_at: string;
}

export interface SiteData {
  content?: SiteContent;
  works: Work[];
  posts: Post[];
  resume: ResumeData;
  settings: SiteSettings;
  avatar: AvatarSettings;
}

export interface AdminData extends SiteData {
  avatar: AvatarAdminSettings;
  media: MediaItem[];
  contacts: Contact[];
  user: { id: string; email: string; name?: string };
}

export interface Contact { id:string; name:string; contact:string; email:string; message:string; created_at:string; status:string }
