
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: GroundingSource[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface SavedMessage {
  id: string;
  content: string;
  timestamp: Date;
}

export interface AppSettings {
  model: 'gemini-3-flash-preview' | 'gemini-3-pro-preview';
  useSearch: boolean;
  useMaps: boolean;
  voiceLanguage: string;
  backgroundImage?: string;
  backgroundOpacity: number;
  isDarkMode: boolean;
  userAvatar?: string;
}
