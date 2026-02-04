
import React, { useEffect, useRef } from 'react';

interface LatexRendererProps {
  content: string;
  className?: string;
  onError?: () => void;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ content, className = '', onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mathJax = (window as any).MathJax;
    if (mathJax && containerRef.current) {
      const timeoutId = setTimeout(() => {
        if (mathJax.typesetPromise) {
          mathJax.typesetPromise([containerRef.current])
            .then(() => {
              // Check for MathJax errors in the container (MathJax 3 puts errors in <mjx-merror>)
              const errorElements = containerRef.current?.querySelectorAll('mjx-merror, merror');
              if (errorElements && errorElements.length > 0 && onError) {
                console.warn("Math input error detected in content.");
                onError();
              }
            })
            .catch((err: any) => {
              console.error('MathJax typeset failed: ', err);
              if (onError) onError();
            });
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [content, onError]);

  return (
    <div 
      ref={containerRef} 
      className={`mathjax-container overflow-x-auto whitespace-pre-wrap break-words ${className}`}
    >
      {content}
    </div>
  );
};

export default LatexRenderer;
