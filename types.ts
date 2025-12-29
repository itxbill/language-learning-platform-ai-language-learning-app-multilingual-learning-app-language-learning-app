
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
  scientificCategory: 'geology' | 'biology' | 'astronomy' | 'physics' | 'culture';
  educationalFact?: {
    topic: string;
    fact: string;
    imagePrompt: string;
  };
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
  effect: 'shield' | 'xp_boost' | 'extra_time' | 'streak_freeze';
}

export interface AIFeedback {
  grammar: string;
  pronunciation: string;
  naturalness: string;
  score: number;
  phonetics: string;
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  isUnlocked: boolean;
}

export interface DailyGoal {
  id: string;
  text: string;
  isCompleted: boolean;
  rewardGems: number;
}

export interface GameState {
  hearts: number;
  maxHearts: number;
  xp: number;
  level: number;
  gems: number;
  streak: number;
  streakProgress: boolean[]; // 7-day history (Mon-Sun)
  lastLoginDate: string;
  inventory: VocabularyItem[];
  unlockedRegions: string[];
  powerups: { [key: string]: number };
  activeBuffs: string[];
  achievements: Achievement[];
  dailyGoals: DailyGoal[];
}

export type AppView = 'map' | 'quest' | 'battle' | 'oracle' | 'archive' | 'shop' | 'share' | 'streak' | 'teacher' | 'minigame' | 'cooldown' | 'leaderboard';
