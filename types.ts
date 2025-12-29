
export enum LanguageLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  ADVANCED = 'Advanced'
}

export interface VocabularyItem {
  word: string;
  translation: string;
  pronunciation?: string;
  imageUrl?: string;
  mastery: number;
}

export interface Lesson {
  id: string;
  title: string;
  narrative: string;
  content: string;
  vocabulary: VocabularyItem[];
  examples: { original: string; translated: string }[];
  questType: 'discovery' | 'battle' | 'stealth';
  difficulty: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface PowerUp {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  effect: 'shield' | 'xp_boost' | 'extra_time';
}

export interface GameState {
  hearts: number;
  maxHearts: number;
  xp: number;
  level: number;
  gems: number;
  streak: number;
  streakProgress: boolean[]; // 7-day history (e.g., [true, true, false, ...])
  lastLoginDate: string; // ISO string
  inventory: VocabularyItem[];
  unlockedRegions: string[];
  powerups: { [key: string]: number };
  activeBuffs: string[];
}

export type AppView = 'map' | 'quest' | 'battle' | 'oracle' | 'archive' | 'shop' | 'share' | 'streak';
