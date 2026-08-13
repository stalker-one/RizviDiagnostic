import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Navbar from './Navbar.jsx';

export default function Layout({ title, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="no-print">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="no-print">
          <Navbar title={title} onMenuClick={() => setMobileOpen(true)} />
        </div>
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
