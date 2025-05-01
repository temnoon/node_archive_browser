// MathJax typesetting helper for React
import { useEffect } from 'react';

export function useMathJaxTypeset(deps) {
  useEffect(() => {
    if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
      window.MathJax.typesetPromise();
    }
  }, deps);
}
