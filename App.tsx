
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppView, Question, Difficulty, QuestionType, User, KnowledgePointNode } from './types';
import { api } from './api';
import { exportToPDF, exportToWord } from './utils/storage';
import { performOCR } from './geminiService';
import QuestionCard from './components/QuestionCard';
import LatexRenderer from './components/LatexRenderer';

declare const mammoth: any;

interface ProcessedResult {
  file: string;
  latex: string;
  text: string;
  id: string;
  category: string;
  subCategory?: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string;
  isSaved?: boolean;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(api.getSession());
  const [view, setView] = useState<AppView>('dashboard');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [kpData, setKpData] = useState<KnowledgePointNode[]>(api.getKnowledgePoints());
  
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [processedResults, setProcessedResults] = useState<ProcessedResult[]>([]);
  const [notifications, setNotifications] = useState<{id: number, message: string}[]>([]);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'public' | 'mine'>('public');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [adminTab, setAdminTab] = useState<'users' | 'questions' | 'kp'>('users');
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [qs, users] = await Promise.all([api.fetchAllQuestions(), api.fetchAllUsers()]);
      setQuestions(qs);
      setAllUsers(users);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const addNotification = useCallback((message: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  // --- Knowledge Point Actions ---
  const addCategory = (name: string) => {
    const newNode: KnowledgePointNode = { id: Date.now().toString(), name, children: [] };
    const next = [...kpData, newNode];
    setKpData(next);
    api.saveKnowledgePoints(next);
  };

  const addSubPoint = (parentId: string, name: string) => {
    const next = kpData.map(node => {
      if (node.id === parentId) {
        return { ...node, children: [...node.children, { id: Date.now().toString(), name }] };
      }
      return node;
    });
    setKpData(next);
    api.saveKnowledgePoints(next);
  };

  // --- Handlers ---
  const cleanQuestionStem = (text: string) => text.replace(/^\d+[\.、\s]+/, '').trim();
  const formatSolutionText = (text: string) => text.replace(/(?<!\n)([（\(]\d+[）\)])/g, '\n$1');

  // Fix: Added missing handleFileChange function
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  const handleSetView = (newView: AppView) => {
    if (newView === 'upload' && !currentUser) {
      setView('auth');
      addNotification("录入题目需要先登录账号");
    } else if ((newView === 'userCenter' || newView === 'adminPanel') && !currentUser) {
      setView('auth');
    } else {
      setView(newView);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const username = target.username.value.trim();
    const secret = target.secret.value.trim();
    try {
      const user = authMode === 'login' ? await api.login(username, secret) : await api.register(username, secret);
      api.setSession(user);
      setCurrentUser(user);
      setView('dashboard');
      addNotification(`欢迎回来, ${username}!`);
      refreshData();
    } catch (err: any) {
      addNotification(err.message);
    }
  };

  const handleLogout = () => {
    api.setSession(null);
    setCurrentUser(null);
    setView('dashboard');
    addNotification("已安全退出。");
  };

  // Improved startOCR to handle Word documents using mammoth
  const startOCR = async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);
    const results: ProcessedResult[] = [];
    try {
      for (const file of uploadFiles) {
        if (file.name.toLowerCase().endsWith('.docx')) {
          // Extract text from Word document before sending to Gemini
          const arrayBuffer = await file.arrayBuffer();
          const mammothResult = await mammoth.extractRawText({ arrayBuffer });
          const ocrResults = await performOCR({ textContent: mammothResult.value });
          ocrResults.forEach((ocr) => {
            results.push({
              file: file.name,
              latex: ocr.latex || "",
              text: cleanQuestionStem(ocr.text || ""),
              id: Math.random().toString(36).substr(2, 9),
              category: '未分类',
              type: QuestionType.Solution,
              difficulty: Difficulty.Medium,
              tags: '', 
              isSaved: false,
            });
          });
        } else {
          // Standard Image or PDF base64 handling
          const dataUrl = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(file);
          });
          const mimeTypeMatch = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!mimeTypeMatch) continue;
          const ocrResults = await performOCR({ base64: mimeTypeMatch[2], mimeType: mimeTypeMatch[1] });
          ocrResults.forEach((ocr) => {
            results.push({
              file: file.name,
              latex: ocr.latex || "",
              text: cleanQuestionStem(ocr.text || ""),
              id: Math.random().toString(36).substr(2, 9),
              category: '未分类',
              type: QuestionType.Solution,
              difficulty: Difficulty.Medium,
              tags: '', 
              isSaved: false,
            });
          });
        }
      }
      setProcessedResults(results);
    } catch (err: any) {
      addNotification(`文件解析失败: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const saveSingle = async (idx: number) => {
    const res = processedResults[idx];
    if (!currentUser || !res.tags.trim()) return;
    const newQuestion: Question = {
      ...res,
      userId: currentUser.id,
      authorName: currentUser.username,
      content: res.type === QuestionType.Solution ? formatSolutionText(res.text) : res.text,
      tags: res.tags.split(/[,\/，]/).map(t => t.trim()).filter(Boolean),
      createdAt: Date.now()
    };
    await api.saveQuestion(newQuestion);
    setProcessedResults(prev => prev.map((item, i) => i === idx ? { ...item, isSaved: true } : item));
    refreshData();
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory ? q.category === activeCategory : true;
    const matchesMode = (displayMode === 'mine' && currentUser) ? q.userId === currentUser.id : true;
    return matchesSearch && matchesCategory && matchesMode;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#fffbfc] font-sans selection:bg-red-100 selection:text-red-900">
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
        {notifications.map(n => (
          <div key={n.id} className="bg-red-600/95 backdrop-blur-xl text-white px-6 py-4 rounded-3xl shadow-2xl text-sm animate-bounce-in flex items-center gap-3 border border-white/10">
            {n.message}
          </div>
        ))}
      </div>

      <header className="bg-white/80 backdrop-blur-2xl border-b border-red-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => handleSetView('dashboard')}>
            <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-red-100 transition-all">∑</div>
            <h1 className="text-xl font-black text-slate-900">个人数学题库</h1>
          </div>
          
          <nav className="hidden md:flex items-center bg-red-50/50 p-1 rounded-2xl">
            <button onClick={() => handleSetView('dashboard')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'dashboard' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-red-600'}`}>浏览</button>
            <button onClick={() => handleSetView('upload')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'upload' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-red-600'}`}>录入</button>
            <button onClick={() => handleSetView('builder')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'builder' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-red-600'}`}>组卷</button>
            {currentUser?.role === 'admin' && (
              <button onClick={() => handleSetView('adminPanel')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'adminPanel' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-red-600'}`}>管理</button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {currentUser ? (
              <button onClick={() => handleSetView('userCenter')} className="flex items-center gap-3 pl-2 pr-5 py-1.5 bg-white border border-slate-200 rounded-full hover:shadow-red-100 transition-all">
                <img src={currentUser.avatar} className="w-8 h-8 rounded-full bg-red-50" />
                <span className="text-[10px] font-black uppercase">{currentUser.username}</span>
              </button>
            ) : (
              <button onClick={() => handleSetView('auth')} className="px-6 py-2 bg-red-600 text-white rounded-full text-xs font-black shadow-lg shadow-red-100">登录/注册</button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {view === 'adminPanel' && currentUser?.role === 'admin' && (
          <div className="animate-fade-in space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">系统管理后台</h2>
                <p className="text-red-500 font-bold uppercase tracking-widest text-xs mt-2">Super Admin Console</p>
              </div>
              <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button onClick={() => setAdminTab('users')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${adminTab === 'users' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>用户管理</button>
                <button onClick={() => setAdminTab('questions')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${adminTab === 'questions' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>全库题目</button>
                <button onClick={() => setAdminTab('kp')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${adminTab === 'kp' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>知识点树</button>
              </div>
            </div>

            {adminTab === 'users' && (
              <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <span className="text-sm font-black text-slate-500 uppercase tracking-widest">活跃开发者列表</span>
                  <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black">总计 {allUsers.length} 位用户</span>
                </div>
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-4">ID / 头像</th>
                      <th className="px-8 py-4">用户名</th>
                      <th className="px-8 py-4">注册时间</th>
                      <th className="px-8 py-4">权限角色</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-red-50/20 transition-colors">
                        <td className="px-8 py-4 flex items-center gap-4">
                          <img src={u.avatar} className="w-8 h-8 rounded-full bg-slate-100" />
                          <span className="text-xs font-mono text-slate-400">{u.id}</span>
                        </td>
                        <td className="px-8 py-4 text-sm font-black text-slate-700">{u.username}</td>
                        <td className="px-8 py-4 text-xs font-bold text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {adminTab === 'questions' && (
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-red-50 mb-4 flex justify-between items-center">
                  <span className="text-sm font-black">当前库中共有 {questions.length} 道题目</span>
                  <button onClick={() => refreshData()} className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-4 py-2 rounded-xl">刷新同步</button>
                </div>
                {questions.map(q => (
                  <QuestionCard 
                    key={q.id} 
                    question={q} 
                    currentUserId={currentUser?.id} 
                    onDelete={async (id) => {
                      if (currentUser) {
                        await api.deleteQuestion(id, currentUser);
                        refreshData();
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {adminTab === 'kp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm">
                  <h3 className="text-2xl font-black mb-8 text-slate-900">结构化知识点管理</h3>
                  <div className="space-y-6">
                    {kpData.map(node => (
                      <div key={node.id} className="border-b border-slate-50 pb-6 last:border-0">
                        <div className="flex justify-between items-center mb-4 group">
                          <span className="text-lg font-black text-slate-800">{node.name}</span>
                          <button 
                            onClick={() => {
                              const name = prompt('请输入子知识点名称:');
                              if (name) addSubPoint(node.id, name);
                            }}
                            className="opacity-0 group-hover:opacity-100 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-black transition-all"
                          >
                            + 新增小节
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 pl-4">
                          {node.children.map(child => (
                            <span key={child.id} className="px-3 py-1.5 bg-slate-50 text-slate-500 rounded-xl text-xs font-bold border border-slate-100">
                              {child.name}
                            </span>
                          ))}
                          {node.children.length === 0 && <span className="text-slate-300 text-[10px] italic">暂无细化知识点</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-red-600 p-10 rounded-[48px] text-white shadow-2xl">
                   <h3 className="text-2xl font-black mb-6">新增一级目录</h3>
                   <form onSubmit={(e) => {
                     e.preventDefault();
                     const target = e.target as any;
                     if (target.cat.value) {
                       addCategory(target.cat.value);
                       target.cat.value = '';
                     }
                   }} className="space-y-4">
                     <input name="cat" className="w-full p-5 bg-white/10 rounded-3xl border-0 placeholder:text-white/40 text-sm font-black focus:ring-4 focus:ring-white transition-all outline-none" placeholder="目录名称，例如：立体几何" />
                     <button type="submit" className="w-full py-5 bg-white text-red-600 rounded-3xl font-black shadow-xl hover:scale-[1.02] transition-all">创建一级分类</button>
                   </form>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'dashboard' && (
          <div className="flex flex-col lg:flex-row gap-10 animate-fade-in">
             <aside className="w-full lg:w-72 space-y-6">
               <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-sm">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">知识点导航</h4>
                 <div className="space-y-1">
                   <button onClick={() => setActiveCategory(null)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${!activeCategory ? 'bg-red-50 text-red-900' : 'text-slate-500 hover:bg-red-50'}`}>全部分类</button>
                   {kpData.map(cat => (
                     <div key={cat.id}>
                        <button onClick={() => setActiveCategory(cat.name)} className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex justify-between items-center ${activeCategory === cat.name ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:bg-red-50'}`}>
                          <span>{cat.name}</span>
                          <span className="opacity-30 text-[9px] font-black">{(questions.filter(q => q.category === cat.name).length)}</span>
                        </button>
                     </div>
                   ))}
                 </div>
               </div>
             </aside>
             <div className="flex-1 space-y-8">
               <input 
                 type="text" placeholder="搜索题目..." 
                 className="w-full px-10 py-5 bg-white border border-slate-200 rounded-[32px] shadow-sm font-bold outline-none focus:border-red-500 transition-all"
                 value={search} onChange={(e) => setSearch(e.target.value)}
               />
               <div className="space-y-6">
                 {filteredQuestions.map(q => (
                   <QuestionCard key={q.id} question={q} currentUserId={currentUser?.id} 
                    onSelect={(target) => {
                      const next = new Set(selectedQuestions);
                      if (next.has(target.id)) next.delete(target.id); else next.add(target.id);
                      setSelectedQuestions(next);
                    }}
                    isSelected={selectedQuestions.has(q.id)}
                   />
                 ))}
               </div>
             </div>
          </div>
        )}
        
        {view === 'auth' && (
           <div className="min-h-[60vh] flex items-center justify-center">
             <form onSubmit={handleAuth} className="w-full max-md bg-white p-12 rounded-[48px] border border-red-100 shadow-2xl text-center space-y-6">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                  {authMode === 'login' ? '欢迎回来' : '创建开发者账号'}
                </h2>
                <div className="bg-slate-50 p-1.5 rounded-2xl flex">
                  <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-3 text-xs font-black rounded-xl ${authMode === 'login' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>登录</button>
                  <button type="button" onClick={() => setAuthMode('register')} className={`flex-1 py-3 text-xs font-black rounded-xl ${authMode === 'register' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>注册</button>
                </div>
                <input name="username" type="text" placeholder="用户名" required className="w-full p-5 bg-slate-50 rounded-3xl text-sm font-black outline-none border-0 focus:ring-4 focus:ring-red-100" />
                <input name="secret" type="password" placeholder="密码" required className="w-full p-5 bg-slate-50 rounded-3xl text-sm font-black outline-none border-0 focus:ring-4 focus:ring-red-100" />
                <button type="submit" className="w-full py-5 bg-red-600 text-white rounded-3xl font-black shadow-xl shadow-red-100 hover:scale-[1.02] transition-all">
                  {authMode === 'login' ? '立即登录' : '立即注册'}
                </button>
                {authMode === 'login' && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tip: 管理员账号为 admin/admin</p>}
             </form>
           </div>
        )}

        {view === 'upload' && (
          <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-12 rounded-[48px] border border-red-50 text-center space-y-8">
               <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-white mx-auto shadow-xl shadow-red-100">
                 <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
               </div>
               <h2 className="text-4xl font-black text-slate-900 tracking-tight">批量数学题录入</h2>
               <input type="file" multiple onChange={handleFileChange} className="hidden" id="file-up" />
               <label htmlFor="file-up" className="inline-block px-12 py-5 bg-slate-900 text-white rounded-full font-black cursor-pointer hover:bg-black transition-all">选择图片或文档</label>
               {uploadFiles.length > 0 && <button onClick={startOCR} disabled={isUploading} className="block mx-auto text-red-600 font-black uppercase text-xs tracking-widest">{isUploading ? '正在深度解析...' : `开始解析 ${uploadFiles.length} 个文件`}</button>}
            </div>
            
            <div className="space-y-10">
              {processedResults.map((res, idx) => (
                <div key={idx} className={`bg-white p-10 rounded-[56px] border border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-10 shadow-xl ${res.isSaved ? 'opacity-40 grayscale' : ''}`}>
                   <textarea value={res.text} onChange={(e) => {
                     const next = [...processedResults];
                     next[idx].text = e.target.value;
                     setProcessedResults(next);
                   }} className="w-full h-80 p-8 bg-slate-900 text-red-50 font-mono text-sm rounded-3xl outline-none border-0 resize-none" />
                   <div className="space-y-4">
                      <select value={res.category} onChange={(e) => {
                        const next = [...processedResults];
                        next[idx].category = e.target.value;
                        setProcessedResults(next);
                      }} className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-black text-xs outline-none focus:ring-2 focus:ring-red-200">
                        {kpData.map(kp => <option key={kp.id} value={kp.name}>{kp.name}</option>)}
                      </select>
                      <input value={res.tags} onChange={(e) => {
                        const next = [...processedResults];
                        next[idx].tags = e.target.value;
                        setProcessedResults(next);
                      }} placeholder="标签 (逗号分割)" className="w-full p-4 bg-slate-50 rounded-2xl border-0 font-black text-xs outline-none focus:ring-2 focus:ring-red-200" />
                      <div className="h-40 bg-red-50/20 rounded-2xl p-4 overflow-auto border border-dashed border-red-100">
                         <LatexRenderer content={res.text} />
                      </div>
                      <button onClick={() => saveSingle(idx)} disabled={res.isSaved} className="w-full py-5 bg-red-600 text-white rounded-3xl font-black shadow-lg">确认并同步</button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="py-24 text-center opacity-10 border-t border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-[1em] mb-4">Math Question Bank Pro Console</p>
      </footer>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes bounce-in { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

export default App;
