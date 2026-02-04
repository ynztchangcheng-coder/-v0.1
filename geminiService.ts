
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "./types";

const OCR_PROMPT = `
Act as a world-class LaTeX typesetter and mathematics professor. 
Extract all distinct mathematical questions from the provided content (image, PDF, or text extracted from Word).

For each question identified, you must return an object with two fields:
1. "text": The COMPLETE question stem. 
   CRITICAL: You MUST wrap every mathematical variable (e.g., $x$, $a$), symbol, and equation in LaTeX delimiters. 
   Use inline $...$ for variables and small expressions. 
   Use display mode \\[ ... \\] for major formulas that should be on their own line.
   If the input is text-based (from Word), fix any mangled characters and ensure perfect LaTeX representation.
2. "latex": Extract ONLY the primary mathematical equation or result of the question as raw LaTeX code (without delimiters).

Ensure all LaTeX syntax is valid.
If the content contains multiple numbered questions, return them as separate objects in a JSON array.
Return ONLY a JSON array of these objects.
`;

const RETRY_INSTRUCTION = "The previous recognition attempt resulted in LaTeX rendering errors. Please pay extra attention to balanced brackets, correct command syntax, and proper delimiters. Ensure the output is valid LaTeX.";

export const performOCR = async (
  input: { base64?: string; mimeType?: string; textContent?: string }, 
  isRetry: boolean = false
): Promise<OCRResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const parts: any[] = [];
    
    // 如果提供了图像/PDF 数据
    if (input.base64 && input.mimeType) {
      parts.push({
        inlineData: {
          mimeType: input.mimeType,
          data: input.base64,
        },
      });
    }
    
    // 如果提供了文本内容（如从 Word 提取的内容）
    if (input.textContent) {
      parts.push({ text: `Content extracted from document:\n${input.textContent}` });
    }

    parts.push({ text: isRetry ? `${OCR_PROMPT}\n\n${RETRY_INSTRUCTION}` : OCR_PROMPT });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { 
                type: Type.STRING,
                description: "The full question text with all math properly delimited with $ or \\."
              },
              latex: { 
                type: Type.STRING,
                description: "The core formula extracted separately."
              }
            },
            required: ["text", "latex"],
          }
        }
      }
    });

    const resultStr = response.text;
    if (!resultStr) return [];

    return JSON.parse(resultStr.trim()) as OCRResult[];
  } catch (e) {
    console.error("OCR Service Error:", e);
    throw e;
  }
};
