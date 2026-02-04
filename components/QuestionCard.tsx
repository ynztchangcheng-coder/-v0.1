
import React from 'react';
import { Question, Difficulty } from '../types';
import LatexRenderer from './LatexRenderer';

interface QuestionCardProps {
  question: Question;
  onDelete?: (id: string) => void;
  onSelect?: (question: Question) => void;
  isSelected?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onDelete, onSelect, isSelected }) => {
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

  return (
    <div 
      className={`relative group bg-white border rounded-2xl p-5 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/10' : 'border-slate-200 hover:border-indigo-300'
      }`}
      onClick={() => onSelect?.(question)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-wrap gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${difficultyColors[question.difficulty]}`}>
            {difficultyMap[question.difficulty]}
          </span>
          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
            {/* Fix: Directly use question.category as it matches KnowledgePoint type and handles '未分类' */}
            {question.category}
          </span>
        </div>
        {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(question.id); }}
            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            title="从题库删除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-slate-800 leading-relaxed text-sm">
           <LatexRenderer content={question.content} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5 pt-4 border-t border-slate-50">
        {question.tags.map(tag => (
          <span key={tag} className="text-[9px] text-slate-400 font-bold uppercase tracking-widest px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
            #{tag}
          </span>
        ))}
      </div>
      
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
