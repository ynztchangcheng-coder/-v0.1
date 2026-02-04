
import { Question, Difficulty, QuestionType } from '../types';

const difficultyMap = {
  [Difficulty.Easy]: '简单',
  [Difficulty.Medium]: '中等',
  [Difficulty.Hard]: '困难',
};

const formatChoiceContent = (question: Question) => {
  const isChoice = question.type === QuestionType.SingleChoice || question.type === QuestionType.MultipleChoice;
  if (isChoice) {
    const parts = question.content.split(/([A-D]\.)/);
    if (parts.length > 1) {
      const stem = parts[0].trim();
      const options = [];
      for (let i = 1; i < parts.length; i += 2) {
        options.push(`${parts[i]} ${parts[i + 1]?.trim() || ''}`);
      }
      return { stem, options };
    }
  }
  return { stem: question.content, options: [] };
};

const formatSolutionText = (text: string) => {
  return text.replace(/(?<!\n)([（\(]\d+[）\)])/g, '\n$1');
};

/**
 * Calculates layout based on option length
 * @returns 'one' | 'two' | 'four'
 */
const getChoiceLayoutType = (options: string[]) => {
  if (options.length === 0) return 'four';
  const maxLen = Math.max(...options.map(opt => opt.length));
  if (maxLen < 12) return 'one';
  if (maxLen < 35) return 'two';
  return 'four';
};

export const exportToWord = (questions: Question[], examTitle: string = "数学测试卷") => {
  const questionsHtml = questions.map((q, idx) => {
    let { stem, options } = formatChoiceContent(q);
    if (q.type === QuestionType.Solution) {
      stem = formatSolutionText(stem);
    }
    
    const layout = getChoiceLayoutType(options);
    
    let optionsHtml = '';
    if (options.length > 0) {
      if (layout === 'one') {
        optionsHtml = `<p style="text-align: justify; line-height: 1.5; margin-left: 30pt;">${options.join('&nbsp;&nbsp;&nbsp;&nbsp;')}</p>`;
      } else if (layout === 'two') {
        const row1 = options.slice(0, 2).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
        const row2 = options.slice(2, 4).join('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
        optionsHtml = `
          <p style="text-align: justify; line-height: 1.5; margin-left: 30pt;">${row1}</p>
          <p style="text-align: justify; line-height: 1.5; margin-left: 30pt;">${row2}</p>
        `;
      } else {
        optionsHtml = options.map(opt => `<p style="margin-left: 30pt; text-align: justify; line-height: 1.5;">${opt}</p>`).join('');
      }
    }

    return `
      <div style="margin-bottom: 25pt; page-break-inside: avoid;">
        <p style="font-size: 10pt; color: #b91c1c; font-family: 'Arial'; margin-bottom: 5pt; font-weight: bold;">
          [${q.type}] | [${q.category}] | 难度: ${difficultyMap[q.difficulty]}
        </p>
        <div style="display: table; width: 100%;">
          <div style="display: table-cell; width: 30pt; font-weight: bold; font-size: 14pt; color: #b91c1c; vertical-align: top;">
            ${idx + 1}.
          </div>
          <div style="display: table-cell; font-size: 12pt; font-family: 'Times New Roman', 'SimSun'; line-height: 1.6; text-align: justify;">
            ${stem.replace(/\n/g, '<br/>')}
          </div>
        </div>
        <div style="margin-top: 10pt;">
          ${optionsHtml}
        </div>
      </div>
    `;
  }).join('');

  const fullHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${examTitle}</title>
      <style>
        body { font-family: 'Times New Roman', 'SimSun', serif; }
        h1 { text-align: center; font-size: 22pt; font-weight: bold; margin-bottom: 30pt; color: #b91c1c; }
      </style>
    </head>
    <body>
      <h1>${examTitle}</h1>
      ${questionsHtml}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${examTitle}.doc`;
  link.click();
};

export const exportToPDF = (questions: Question[], examTitle: string = "数学测试卷") => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const questionsHtml = questions.map((q, idx) => {
    let { stem, options } = formatChoiceContent(q);
    if (q.type === QuestionType.Solution) {
      stem = formatSolutionText(stem);
    }
    const layout = getChoiceLayoutType(options);
    
    let optionsHtml = '';
    if (options.length > 0) {
      const layoutClass = `layout-${layout}`;
      optionsHtml = `<div class="options-container ${layoutClass}">${options.map(opt => `<div class="option-item">${opt}</div>`).join('')}</div>`;
    }

    return `
      <div class="question">
        <div class="meta">${q.type} | ${q.category} | 难度: ${difficultyMap[q.difficulty]}</div>
        <div class="stem">
          <span class="num">${idx + 1}.</span>
          <div class="content-wrapper">
            <div class="content whitespace-pre-wrap">${stem}</div>
            ${optionsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  printWindow.document.write(`
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${examTitle}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        window.MathJax = {
          tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
          svg: { fontCache: 'global' }
        };
      </script>
      <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
      <style>
        body { padding: 40px; font-family: sans-serif; color: #1e293b; line-height: 1.6; }
        .question { margin-bottom: 40px; page-break-inside: avoid; }
        .meta { font-size: 10px; color: #b91c1c; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; border-left: 3px solid #b91c1c; padding-left: 10px; }
        .stem { display: flex; gap: 12px; }
        .num { font-weight: 800; color: #b91c1c; font-size: 18px; min-width: 25px; }
        .content-wrapper { flex: 1; }
        .content { font-size: 16px; text-align: justify; margin-bottom: 12px; }
        
        .options-container { margin-top: 15px; display: grid; width: 100%; }
        .layout-one { grid-template-columns: repeat(4, 1fr); justify-content: space-between; }
        .layout-two { grid-template-columns: repeat(2, 1fr); justify-content: space-between; gap: 10px; }
        .layout-four { grid-template-columns: 1fr; }
        
        .option-item { text-align: justify; font-size: 15px; padding-right: 10px; }
        @media print {
          body { padding: 20mm; }
          h1 { margin-top: 0; }
        }
      </style>
    </head>
    <body>
      <h1 class="text-4xl font-black text-center mb-20 text-red-700 border-b-4 border-red-700 pb-10">${examTitle}</h1>
      ${questionsHtml}
      <script>
        window.onload = () => {
          setTimeout(() => {
            if (window.MathJax.typesetPromise) {
              window.MathJax.typesetPromise().then(() => {
                setTimeout(() => { window.print(); }, 800);
              });
            }
          }, 1000);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
