
import { Question, Difficulty } from '../types';

const STORAGE_KEY = 'latex_question_bank';

const difficultyMap = {
  [Difficulty.Easy]: '简单',
  [Difficulty.Medium]: '中等',
  [Difficulty.Hard]: '困难',
};

export const getQuestions = (): Question[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveQuestion = (question: Question) => {
  const questions = getQuestions();
  questions.unshift(question);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
};

export const deleteQuestion = (id: string) => {
  const questions = getQuestions();
  const filtered = questions.filter(q => q.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

/**
 * 导出为 Word 文档
 * 利用 Word 对 HTML 格式的良好支持，导出包含可编辑 LaTeX 代码的文档
 */
export const exportToWord = (questions: Question[], examTitle: string = "数学测试卷") => {
  const questionsHtml = questions.map((q, idx) => `
    <div style="margin-bottom: 25pt; page-break-inside: avoid;">
      <p style="font-size: 10pt; color: #7f8c8d; font-family: 'Arial'; margin-bottom: 5pt;">
        [${q.category}] | 难度: ${difficultyMap[q.difficulty]} ${q.tags.length > 0 ? '| 标签: ' + q.tags.join(', ') : ''}
      </p>
      <div style="display: table; width: 100%;">
        <div style="display: table-cell; width: 30pt; font-weight: bold; font-size: 14pt; color: #4f46e5; vertical-align: top;">
          ${idx + 1}.
        </div>
        <div style="display: table-cell; font-size: 12pt; font-family: 'Times New Roman', 'SimSun'; line-height: 1.6;">
          ${q.content.replace(/\n/g, '<br/>')}
        </div>
      </div>
    </div>
  `).join('');

  const fullHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${examTitle}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 { size: 595.3pt 841.9pt; margin: 72.0pt 72.0pt 72.0pt 72.0pt; mso-header-margin: 35.4pt; mso-footer-margin: 35.4pt; mso-paper-source: 0; }
        div.Section1 { page: Section1; }
        body { font-family: 'Times New Roman', 'SimSun', serif; }
        h1 { text-align: center; font-size: 22pt; font-weight: bold; margin-bottom: 30pt; }
      </style>
    </head>
    <body lang=ZH-CN style='tab-interval:36.0pt'>
      <div class=Section1>
        <h1>${examTitle}</h1>
        ${questionsHtml}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', fullHtml], {
    type: 'application/msword'
  });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${examTitle}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (questions: Question[], examTitle: string = "数学测试卷") => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("请允许弹出窗口以导出 PDF。");
    return;
  }

  const questionsHtml = questions.map((q, idx) => `
    <div class="question">
      <div class="meta">${q.category} | 难度: ${difficultyMap[q.difficulty]} ${q.tags.length > 0 ? '| 标签: ' + q.tags.join(', ') : ''}</div>
      <div class="stem">
        <span class="num">${idx + 1}.</span>
        <div class="content">${q.content}</div>
      </div>
    </div>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${examTitle}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']]
          },
          svg: { fontCache: 'global' }
        };
      </script>
      <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
      <style>
        body { 
          font-family: -apple-system, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
          padding: 60px; 
          color: #1e293b; 
          line-height: 1.6;
        }
        h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
        .question { margin-bottom: 40px; page-break-inside: avoid; }
        .meta { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 8px; }
        .stem { display: flex; align-items: flex-start; gap: 16px; }
        .num { font-weight: 700; font-size: 18px; color: #4f46e5; min-width: 30px; }
        .content { font-size: 16px; flex: 1; white-space: pre-wrap; }
        @media print {
          body { padding: 0; }
          @page { margin: 2cm; }
        }
      </style>
    </head>
    <body>
      <h1 class="text-3xl font-bold text-center mb-12">${examTitle}</h1>
      <div class="exam-container">
        ${questionsHtml}
      </div>
      <script>
        window.onload = () => {
          const checkMathJax = setInterval(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
              clearInterval(checkMathJax);
              window.MathJax.typesetPromise().then(() => {
                setTimeout(() => {
                  window.print();
                }, 500);
              });
            }
          }, 100);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
