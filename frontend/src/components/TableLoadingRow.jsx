import React from 'react';
import Spinner from './Spinner.jsx';

/**
 * Drop-in replacement for a bare "Loading..." <td>: centers a small
 * spinner next to the label inside a full-width table row.
 */
export default function TableLoadingRow({ colSpan, label = 'Loading...' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-8 text-center text-slate-400">
        <div className="inline-flex items-center gap-2 text-sm">
          <Spinner size={16} tone="brand" />
          <span>{label}</span>
        </div>
      </td>
    </tr>
  );
}
