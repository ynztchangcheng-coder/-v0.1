
import { Question, User, KnowledgePointNode } from './types';

export const DB_QUESTIONS = 'math_v4_questions';
export const DB_USERS = 'math_v4_users';
export const DB_KP = 'math_v4_knowledge_points';
export const SESSION_KEY = 'math_v4_session';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEFAULT_KP: KnowledgePointNode[] = [
  { id: '1', name: '集合与常用逻辑', children: [{id: '1-1', name: '集合的概念'}, {id: '1-2', name: '全称量词与存在量词'}] },
  { id: '2', name: '函数概念与性质', children: [] },
  { id: '3', name: '指数与对数函数', children: [] },
  { id: '4', name: '三角函数', children: [] },
  { id: '5', name: '数列', children: [] },
  { id: '6', name: '解析几何', children: [] },
  { id: '7', name: '未分类', children: [] }
];

export const api = {
  // --- Authentication ---
  async register(username: string, secret: string): Promise<User> {
    await delay(600);
    const users: (User & { secret: string })[] = JSON.parse(localStorage.getItem(DB_USERS) || '[]');
    if (users.find(u => u.username === username)) throw new Error('用户名已存在');
    
    const newUser: User & { secret: string } = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      secret,
      role: (username === 'admin' && secret === 'admin') ? 'admin' : 'user',
      createdAt: Date.now(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&backgroundColor=ffdfdf`
    };
    
    users.push(newUser);
    localStorage.setItem(DB_USERS, JSON.stringify(users));
    return newUser;
  },

  async login(username: string, secret: string): Promise<User> {
    await delay(500);
    // Hardcoded Super Admin Check
    if (username === 'admin' && secret === 'admin') {
      const admin: User = {
        id: 'admin-001',
        username: 'admin',
        role: 'admin',
        createdAt: Date.now(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=admin&backgroundColor=ff5555`
      };
      return admin;
    }

    const users: (User & { secret: string })[] = JSON.parse(localStorage.getItem(DB_USERS) || '[]');
    const user = users.find(u => u.username === username && u.secret === secret);
    if (!user) throw new Error('用户名或密码错误');
    return user;
  },

  setSession(user: User | null) {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  },

  getSession(): User | null {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  },

  // --- Knowledge Points ---
  getKnowledgePoints(): KnowledgePointNode[] {
    const data = localStorage.getItem(DB_KP);
    if (!data) {
      localStorage.setItem(DB_KP, JSON.stringify(DEFAULT_KP));
      return DEFAULT_KP;
    }
    return JSON.parse(data);
  },

  saveKnowledgePoints(points: KnowledgePointNode[]) {
    localStorage.setItem(DB_KP, JSON.stringify(points));
  },

  // --- Admin Stats ---
  async fetchAllUsers(): Promise<User[]> {
    return JSON.parse(localStorage.getItem(DB_USERS) || '[]');
  },

  // --- Questions ---
  async fetchAllQuestions(): Promise<Question[]> {
    await delay(400);
    return JSON.parse(localStorage.getItem(DB_QUESTIONS) || '[]');
  },

  async saveQuestion(question: Question): Promise<void> {
    const all = await this.fetchAllQuestions();
    const existingIndex = all.findIndex(q => q.id === question.id);
    if (existingIndex > -1) {
      all[existingIndex] = question; // Update existing
    } else {
      all.unshift(question); // New question
    }
    localStorage.setItem(DB_QUESTIONS, JSON.stringify(all));
  },

  async deleteQuestion(id: string, operator: User): Promise<void> {
    const all = await this.fetchAllQuestions();
    const filtered = all.filter(q => {
      const isOwner = q.userId === operator.id;
      const isAdmin = operator.role === 'admin';
      return !(q.id === id && (isOwner || isAdmin));
    });
    localStorage.setItem(DB_QUESTIONS, JSON.stringify(filtered));
  },

  exportBackup(questions: Question[], username: string) {
    const dataStr = JSON.stringify(questions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MathBank_Backup_${username}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }
};
