import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<any>;
  }
}

const PYODIDE_VERSION = "0.27.2";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export type PyodideLoadState = "loading" | "ready" | "error";

/**
 * Loads Pyodide once per page (subsequent components on the same page reuse
 * the cached <script> tag) and hands back the live instance once ready.
 */
export function usePyodide() {
  const [loadState, setLoadState] = useState<PyodideLoadState>("loading");
  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await loadScript(`${PYODIDE_INDEX_URL}pyodide.js`);
        if (cancelled) return;
        const pyodide = await window.loadPyodide!({ indexURL: PYODIDE_INDEX_URL });
        if (cancelled) return;
        pyodideRef.current = pyodide;
        setLoadState("ready");
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadState("error");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loadState, pyodideRef };
}
