
export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard'
}

export enum QuestionType {
  SingleChoice = '单项选择题',
  MultipleChoice = '多项选择题',
  FillInBlank = '填空题',
  Solution = '解答题'
}

export interface SubPoint {
  id: string;
  name: string;
}

export interface KnowledgePointNode {
  id: string;
  name: string;
  children: SubPoint[];
}

export type KnowledgePoint = string; // Legacy support for basic strings

export interface User {
  id: string;
  username: string;
  role: 'user' | 'admin';
  avatar?: string;
  createdAt: number;
}

export interface Question {
  id: string;
  userId: string; 
  authorName: string;
  content: string; 
  latex: string;   
  tags: string[];
  category: string;
  subCategory?: string;
  type: QuestionType;
  difficulty: Difficulty;
  createdAt: number;
}

export type AppView = 'dashboard' | 'upload' | 'builder' | 'userCenter' | 'auth' | 'adminPanel';

export interface OCRResult {
  text: string;
  latex: string;
}
