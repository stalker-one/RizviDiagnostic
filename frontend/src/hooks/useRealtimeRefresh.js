import { useEffect, useRef } from 'react';

export default function useRealtimeRefresh(refresh, tables) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const tableKey = Array.isArray(tables) ? tables.join('|') : String(tables || '');

  useEffect(() => {
    const watchedTables = new Set(Array.isArray(tables) ? tables : [tables]);

    const handleDataChanged = (event) => {
      const changedTables = event.detail?.tables || (event.detail?.table ? [event.detail.table] : []);
      if (!changedTables.length || changedTables.some((table) => watchedTables.has(table))) {
        refreshRef.current?.({ realtime: true });
      }
    };

    window.addEventListener('rdc:data-changed', handleDataChanged);
    return () => window.removeEventListener('rdc:data-changed', handleDataChanged);
  }, [tableKey]);
}
