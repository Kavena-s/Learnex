import { useEffect, useRef } from 'react';

export default function useAutoRefresh(refreshFn, options = {}) {
  const { intervalMs = 30000, enabled = true } = options;
  const refreshRef = useRef(refreshFn);

  useEffect(() => {
    refreshRef.current = refreshFn;
  }, [refreshFn]);

  useEffect(() => {
    if (!enabled || typeof refreshRef.current !== 'function') return undefined;

    const runRefresh = () => {
      Promise.resolve(refreshRef.current({ silent: true })).catch((error) => {
        console.error('Auto-refresh failed:', error);
      });
    };

    const intervalId = setInterval(runRefresh, intervalMs);
    const handleFocus = () => runRefresh();
    const handleVisibilityChange = () => {
      if (!document.hidden) runRefresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, enabled]);
}