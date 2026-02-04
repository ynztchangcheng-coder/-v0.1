
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppView, Question, Difficulty, KNOWLEDGE_POINTS, KnowledgePoint } from './types';
import { getQuestions, saveQuestion, deleteQuestion, exportToPDF, exportToWord } from './utils/storage';
import { performOCR } from './geminiService';
import QuestionCard from './components/QuestionCard';
import LatexRenderer from './components/LatexRenderer';

declare const mammoth: any;

interface ProcessedResult {
  file: string;
  fileData: { base64?: string; mimeType?: string; textContent?: string }; 
  latex: string;
  text: string;
  id: string;
  category: KnowledgePoint;
  difficulty: Difficulty;
  tags: string;
  isSaved?: boolean;
  retryCount: number;
  isRetrying?: boolean;
  hasError?: boolean;
}

const MAX_RETRIES = 2;

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('dashboard');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [processedResults, setProcessedResults] = useState<ProcessedResult[]>([]);
  const [notifications, setNotifications] = useState<{id: number, message: string}[]>([]);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<KnowledgePoint | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    setQuestions(getQuestions());
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    questions.forEach(q => q.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [questions]);

  const addNotification = useCallback((message: string) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  const startOCR = async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);
    const results: ProcessedResult[] = [];

    try {
      for (const file of uploadFiles) {
        try {
          let ocrResults = [];
          if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer });
            ocrResults = await performOCR({ textContent: htmlContent });
            ocrResults.forEach((ocr, index) => {
              results.push({
                file: `${file.name} (题 ${index + 1})`,
                fileData: { textContent: htmlContent },
                latex: ocr.latex || "",
                text: ocr.text || "未识别到内容",
                id: Math.random().toString(36).substr(2, 9),
                category: '未分类',
                difficulty: Difficulty.Medium,
                tags: 'Word 导入',
                isSaved: false,
                retryCount: 0,
                hasError: false
              });
            });
          } else {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const mimeTypeMatch = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!mimeTypeMatch) throw new Error(`无效文件格式`);
            const mimeType = mimeTypeMatch[1];
            const base64Data = mimeTypeMatch[2];
            ocrResults = await performOCR({ base64: base64Data, mimeType });
            ocrResults.forEach((ocr, index) => {
              results.push({
                file: `${file.name} (题 ${index + 1})`,
                fileData: { base64: base64Data, mimeType },
                latex: ocr.latex || "",
                text: ocr.text || "未识别到内容",
                id: Math.random().toString(36).substr(2, 9),
                category: '未分类',
                difficulty: Difficulty.Medium,
                tags: 'OCR 导入',
                isSaved: false,
                retryCount: 0,
                hasError: false
              });
            });
          }
        } catch (err: any) {
          addNotification(`处理文件 ${file.name} 时出错：${err.message || '未知错误'}`);
        }
      }
      if (results.length > 0) {
        setProcessedResults(prev => [...prev, ...results]);
        addNotification(`成功处理：提取到 ${results.length} 个项目。`);
        setUploadFiles([]); 
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleMathError = useCallback(async (idx: number) => {
    const target = processedResults[idx];
    if (!target || target.isSaved || target.isRetrying) return;
    if (target.retryCount < MAX_RETRIES) {
      updateProcessedResult(idx, { isRetrying: true, hasError: false });
      try {
        const ocrResults = await performOCR(target.fileData, true);
        if (ocrResults && ocrResults.length > 0) {
          updateProcessedResult(idx, {
            text: ocrResults[0].text,
            latex: ocrResults[0].latex,
            retryCount: target.retryCount + 1,
            isRetrying: false
          });
          addNotification("已重新优化识别。");
        } else {
          updateProcessedResult(idx, { isRetrying: false, retryCount: target.retryCount + 1, hasError: true });
        }
      } catch (err) {
        updateProcessedResult(idx, { isRetrying: false, retryCount: target.retryCount + 1, hasError: true });
      }
    } else {
      if (!target.hasError) updateProcessedResult(idx, { hasError: true });
    }
  }, [processedResults, addNotification]);

  const updateProcessedResult = (idx: number, updates: Partial<ProcessedResult>) => {
    setProcessedResults(prev => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], ...updates } as ProcessedResult;
      return next;
    });
  };

  const saveSingle = (idx: number) => {
    const res = processedResults[idx];
    if (res.isSaved) return;
    saveQuestion({
      id: res.id,
      content: res.text,
      latex: res.latex,
      tags: res.tags.split(/[,\/，]/).map(t => t.trim()).filter(t => t.length > 0),
      category: res.category,
      difficulty: res.difficulty,
      createdAt: Date.now()
    });
    updateProcessedResult(idx, { isSaved: true });
    setQuestions(getQuestions());
    addNotification("已存入题库。");
    if (processedResults.every(r => r.isSaved)) setTimeout(() => setProcessedResults([]), 1500);
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.content.toLowerCase().includes(search.toLowerCase()) || 
                          q.category.toLowerCase().includes(search.toLowerCase()) ||
                          q.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = activeCategory ? q.category === activeCategory : true;
    const matchesTag = activeTag ? q.tags.includes(activeTag) : true;
    return matchesSearch && matchesCategory && matchesTag;
  });

  const toggleSelection = (q: Question) => {
    const next = new Set(selectedQuestions);
    if (next.has(q.id)) next.delete(q.id);
    else next.add(q.id);
    setSelectedQuestions(next);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-[#fbfcfd]">
      {/* Toast System */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-xl text-sm animate-bounce-in flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            {n.message}
          </div>
        ))}
      </div>

      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:scale-105 transition-all">F</div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Filatex <span className="text-indigo-600">Quest</span></h1>
          </div>
          
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>题库浏览</button>
            <button onClick={() => setView('upload')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>智能录入</button>
            <button onClick={() => setView('builder')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === 'builder' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>组卷中心 {selectedQuestions.size > 0 && <span className="ml-1 px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] rounded-full">{selectedQuestions.size}</span>}</button>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {view === 'dashboard' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">库内概览</h4>
                 <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-xl font-black text-slate-900">{questions.length}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">题目总量</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-xl font-black text-indigo-700">{selectedQuestions.size}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">待组卷</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-6">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">知识点过滤</h4>
                  <div className="space-y-1">
                    <button 
                      onClick={() => setActiveCategory(null)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${!activeCategory ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      全部知识点
                    </button>
                    {KNOWLEDGE_POINTS.map(cat => (
                      <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all flex justify-between items-center ${activeCategory === cat ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span className="truncate">{cat}</span>
                        <span className="text-[10px] opacity-50">{questions.filter(q => q.category === cat).length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {allTags.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">常用标签</h4>
                    <div className="flex flex-wrap gap-2 px-1">
                      <button 
                        onClick={() => setActiveTag(null)}
                        className={`px-2 py-1 rounded-md text-[10px] font-black uppercase transition-all border ${!activeTag ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                      >
                        ALL
                      </button>
                      {allTags.map(tag => (
                        <button 
                          key={tag}
                          onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                          className={`px-2 py-1 rounded-md text-[10px] font-black uppercase transition-all border ${activeTag === tag ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <div className="flex-1 space-y-6">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="搜索题目内容、解析公式或标签关键词..." 
                  className="block w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 bg-white shadow-sm text-slate-900 font-bold transition-all placeholder:text-slate-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {filteredQuestions.length > 0 ? filteredQuestions.map(q => (
                  <QuestionCard 
                    key={q.id} 
                    question={q} 
                    onDelete={(id) => { deleteQuestion(id); setQuestions(getQuestions()); }}
                    onSelect={toggleSelection}
                    isSelected={selectedQuestions.has(q.id)}
                  />
                )) : (
                  <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                    <p className="text-slate-400 font-bold italic">暂无匹配题目，尝试更换搜索词或分类</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className={`bg-white p-10 rounded-[32px] border border-slate-200 shadow-sm transition-all ${processedResults.length > 0 ? 'opacity-40 grayscale pointer-events-none scale-95' : 'scale-100'}`}>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">智能批量录题</h2>
              <p className="text-slate-500 mb-8 font-medium">拖拽上传高清截图、PDF 或 Word，系统将通过 Gemini AI 自动解析并生成 LaTeX 代码。</p>
              
              <div className="border-2 border-dashed border-slate-200 rounded-[32px] p-16 text-center hover:border-indigo-400 hover:bg-indigo-50/20 cursor-pointer transition-all">
                <input type="file" multiple accept="image/*,.pdf,.docx" onChange={handleFileChange} className="hidden" id="file-upload" />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <div className="mx-auto h-20 w-20 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-6">
                    <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <span className="text-indigo-600 font-black text-2xl block">点击或拖拽上传文件</span>
                  <span className="text-sm text-slate-400 mt-3 block font-bold uppercase tracking-wider">支持 PNG, JPG, PDF, DOCX</span>
                </label>
              </div>

              {uploadFiles.length > 0 && (
                <div className="mt-8 flex items-center justify-between p-5 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 animate-bounce-in">
                  <span className="text-sm font-black text-white px-2">已就绪：{uploadFiles.length} 个待解析文件</span>
                  <button onClick={startOCR} disabled={isUploading} className="px-10 py-3 bg-white text-indigo-700 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all">
                    {isUploading ? '正在深度解析中...' : '开始 AI 识别'}
                  </button>
                </div>
              )}
            </div>

            {processedResults.length > 0 && (
              <div className="space-y-10 pb-24">
                <div className="flex items-center justify-between bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-20 z-40">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                    <h3 className="font-black text-slate-900">解析流水线报告 ({processedResults.length})</h3>
                  </div>
                  <button onClick={() => setProcessedResults([])} className="text-xs font-black text-slate-400 hover:text-red-500 transition-colors">清除结果</button>
                </div>
                {processedResults.map((res, idx) => (
                  <div key={idx} className={`bg-white border rounded-[32px] p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 shadow-sm transition-all hover:shadow-xl ${res.isSaved ? 'opacity-40 grayscale border-green-200' : 'border-slate-200'}`}>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LaTeX 编辑器</label>
                        <span className="text-[10px] text-indigo-500 font-bold italic">{res.file}</span>
                      </div>
                      <textarea 
                        disabled={res.isSaved}
                        value={res.text} 
                        onChange={(e) => updateProcessedResult(idx, { text: e.target.value, hasError: false })}
                        className="w-full h-80 p-6 text-sm font-mono font-bold bg-slate-900 text-slate-200 border-0 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none resize-none shadow-inner leading-relaxed" 
                      />
                    </div>
                    <div className="flex flex-col space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">知识分类</label>
                          <select 
                            disabled={res.isSaved}
                            value={res.category}
                            onChange={(e) => updateProcessedResult(idx, { category: e.target.value as KnowledgePoint })}
                            className="w-full p-4 text-xs font-black border border-slate-200 rounded-2xl bg-white shadow-sm hover:border-indigo-300 transition-all outline-none"
                          >
                            {KNOWLEDGE_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">标签管理 (逗号分隔)</label>
                          <input 
                            disabled={res.isSaved}
                            type="text"
                            value={res.tags}
                            onChange={(e) => updateProcessedResult(idx, { tags: e.target.value })}
                            className="w-full p-4 text-xs font-black border border-slate-200 rounded-2xl bg-white shadow-sm hover:border-indigo-300 transition-all outline-none"
                            placeholder="如：真题, 2024, 压轴"
                          />
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-50 p-8 rounded-2xl min-h-[160px] overflow-y-auto border border-slate-100 relative group">
                        <span className="absolute top-4 right-4 text-[9px] font-black text-slate-300 uppercase opacity-0 group-hover:opacity-100 transition-opacity">MathJax 预览层</span>
                        {res.isRetrying ? <div className="animate-pulse text-indigo-600 text-xs font-black flex items-center gap-2">识别引擎正在重试...</div> : (
                          <LatexRenderer content={res.text} className="text-sm font-medium" onError={() => handleMathError(idx)} />
                        )}
                      </div>
                      <button onClick={() => saveSingle(idx)} disabled={res.isSaved} className={`w-full py-5 rounded-2xl font-black transition-all shadow-lg ${res.isSaved ? 'bg-green-100 text-green-600' : 'bg-slate-900 text-white hover:bg-black active:scale-[0.98]'}`}>
                        {res.isSaved ? '✓ 已存入题库' : '确认并入库'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'builder' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="flex-1 bg-white p-10 rounded-[40px] border border-slate-200 min-h-[600px] shadow-sm">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">待组题目概览 ({selectedQuestions.size})</h2>
                  <button onClick={() => setSelectedQuestions(new Set())} className="text-xs font-black text-red-500 hover:underline">移除全部</button>
                </div>
                <div className="space-y-8">
                  {questions.filter(q => selectedQuestions.has(q.id)).length > 0 ? (
                    questions.filter(q => selectedQuestions.has(q.id)).map((q, i) => (
                      <div key={q.id} className="p-6 border border-slate-50 bg-slate-50/30 rounded-2xl flex gap-6 relative group">
                        <span className="font-black text-indigo-600 text-xl opacity-20">{(i+1).toString().padStart(2, '0')}</span>
                        <div className="flex-1">
                          <LatexRenderer content={q.content} className="text-sm leading-relaxed" />
                        </div>
                        <button onClick={() => toggleSelection(q)} className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 shadow-sm transition-all">×</button>
                      </div>
                    ))
                  ) : (
                    <div className="py-48 text-center text-slate-300">
                      <p className="font-black text-lg">试卷篮目前是空的</p>
                      <p className="text-sm font-bold">请前往题库浏览勾选所需题目</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full lg:w-80 space-y-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-24">
                  <h3 className="text-lg font-black text-slate-900 mb-6">发布导出</h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">试卷标题</label>
                      <input id="exam-title-input" type="text" defaultValue="2025数学专项提升卷" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-black border-0 focus:ring-4 focus:ring-indigo-50 outline-none transition-all" />
                    </div>
                    
                    <div className="space-y-3 pt-4">
                      <button 
                        disabled={selectedQuestions.size === 0}
                        onClick={() => {
                          const title = (document.getElementById('exam-title-input') as HTMLInputElement).value;
                          exportToPDF(questions.filter(q => selectedQuestions.has(q.id)), title);
                        }}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        导出 PDF 试卷
                      </button>
                      
                      <button 
                        disabled={selectedQuestions.size === 0}
                        onClick={() => {
                          const title = (document.getElementById('exam-title-input') as HTMLInputElement).value;
                          exportToWord(questions.filter(q => selectedQuestions.has(q.id)), title);
                        }}
                        className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14.7,11.5c0-1.1-0.9-2-2-2s-2,0.9-2,2s0.9,2,2,2S14.7,12.6,14.7,11.5z M13,2L3,5v14l10,3l10-3V5L13,2z M21,18.1l-8,2.4l-8-2.4V6.9l8-2.4l8,2.4V18.1z M15,11.5c0,1.4-1.1,2.5-2.5,2.5s-2.5-1.1-2.5-2.5s1.1-2.5,2.5-2.5S15,10.1,15,11.5z"/></svg>
                        导出 Word 文档
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed pt-4 text-center">Word 导出包含可编辑的 LaTeX 代码块。PDF 提供精美的数学公式渲染。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-20 border-t border-slate-100 mt-20 text-center space-y-4">
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Filatex Quest Engine · Precision & Speed</p>
         <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400">
           <span>本地离线存储</span>
           <span>多端排版适配</span>
           <span>Gemini 3.0 Core</span>
         </div>
      </footer>

      <style>{`
        @keyframes bounce-in { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1em; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
