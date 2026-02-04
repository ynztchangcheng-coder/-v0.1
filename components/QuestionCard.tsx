
import React from 'react';
import { Question, Difficulty, QuestionType } from '../types';
import LatexRenderer from './LatexRenderer';

interface QuestionCardProps {
  question: Question;
  currentUserId?: string;
  onDelete?: (id: string) => void;
  onSelect?: (question: Question) => void;
  isSelected?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, currentUserId, onDelete, onSelect, isSelected }) => {
  const isOwner = currentUserId === question.userId;
  
  const difficultyMap = {
    [Difficulty.Easy]: '简单',
    [Difficulty.Medium]: '中等',
    [Difficulty.Hard]: '困难',
  };

  const difficultyColors = {
    [Difficulty.Easy]: 'bg-green-100 text-green-700',
    [Difficulty.Medium]: 'bg-yellow-100 text-yellow-700',
    [Difficulty.Hard]: 'bg-red-100 text-red-700',
  };

  const typeColors = {
    [QuestionType.SingleChoice]: 'bg-blue-100 text-blue-700',
    [QuestionType.MultipleChoice]: 'bg-purple-100 text-purple-700',
    [QuestionType.FillInBlank]: 'bg-orange-100 text-orange-700',
    [QuestionType.Solution]: 'bg-red-100 text-red-700',
  };

  const formattedDate = new Date(question.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Helper for solution text formatting
  const formatSolutionText = (text: string) => {
    return text.replace(/(?<!\n)([（\(]\d+[）\)])/g, '\n$1');
  };

  // Helper to detect if content has options and style them with smart layout
  const renderContent = () => {
    const isChoice = question.type === QuestionType.SingleChoice || question.type === QuestionType.MultipleChoice;
    if (isChoice) {
      const parts = question.content.split(/([A-D]\.)/);
      if (parts.length > 1) {
        const stem = parts[0].trim();
        const options = [];
        for (let i = 1; i < parts.length; i += 2) {
          options.push({ label: parts[i], text: parts[i + 1]?.trim() || '' });
        }
        
        // Calculate layout
        const maxLen = Math.max(...options.map(opt => opt.text.length + 3));
        let gridCols = 'grid-cols-1';
        if (maxLen < 12) gridCols = 'grid-cols-2 md:grid-cols-4';
        else if (maxLen < 35) gridCols = 'grid-cols-1 md:grid-cols-2';

        return (
          <div className="space-y-4">
            <LatexRenderer content={stem} className="text-justify" />
            <div className={`grid ${gridCols} gap-2 mt-4`}>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-start bg-red-50/20 p-2 rounded-lg border border-red-50 text-justify">
                  <span className="font-black text-red-600 shrink-0">{opt.label}</span>
                  <LatexRenderer content={opt.text} className="text-sm" />
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    if (question.type === QuestionType.Solution) {
      return <LatexRenderer content={formatSolutionText(question.content)} className="text-justify whitespace-pre-wrap" />;
    }

    return <LatexRenderer content={question.content} className="text-justify" />;
  };

  return (
    <div 
      className={`relative group bg-white border rounded-[24px] p-6 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl ${
        isSelected ? 'border-red-500 ring-4 ring-red-50 bg-red-50/5' : 'border-slate-200 hover:border-red-200'
      }`}
      onClick={() => onSelect?.(question)}
    >
      <div className="flex justify-between items-start mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${typeColors[question.type]}`}>
            {question.type}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${difficultyColors[question.difficulty]}`}>
            {difficultyMap[question.difficulty]}
          </span>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider">
            {question.category}
          </span>
        </div>
        
        {isOwner && onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(question.id); }}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="删除题目"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="text-slate-800 leading-relaxed text-[15px] min-h-[60px]">
         {renderContent()}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-50 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-1.5">
          {question.tags.map(tag => (
            <span key={tag} className="text-[9px] text-slate-400 font-black uppercase tracking-widest px-2 py-0.5 bg-red-50 rounded-md">
              #{tag}
            </span>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
           <div className="text-right">
             <p className="text-[10px] font-black text-slate-900 leading-none">{question.authorName || '匿名'}</p>
             <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">{formattedDate}</p>
           </div>
           <div className="w-7 h-7 bg-red-50 rounded-full flex items-center justify-center text-red-500 text-[10px] font-black border border-red-100">
             {(question.authorName || 'U').charAt(0).toUpperCase()}
           </div>
        </div>
      </div>
      
      {isSelected && (
        <div className="absolute top-4 right-4 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce-in">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
