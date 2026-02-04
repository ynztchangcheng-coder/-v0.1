
export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard'
}

// 定义标准的知识点分类
export const KNOWLEDGE_POINTS = [
  '集合与常用逻辑',
  '函数概念与性质',
  '指数与对数函数',
  '三角函数',
  '解三角形',
  '数列',
  '不等式',
  '导数及其应用',
  '复数',
  '平面向量',
  '立体几何',
  '解析几何',
  '概率与统计',
  '综合性题型',
  '未分类'
] as const;

export type KnowledgePoint = typeof KNOWLEDGE_POINTS[number];

export interface Question {
  id: string;
  content: string; // 包含 LaTeX 的纯文本描述
  latex: string;   // 核心公式
  tags: string[];
  category: KnowledgePoint;
  difficulty: Difficulty;
  createdAt: number;
}

export type AppView = 'dashboard' | 'upload' | 'builder' | 'settings';

export interface OCRResult {
  text: string;
  latex: string;
}
