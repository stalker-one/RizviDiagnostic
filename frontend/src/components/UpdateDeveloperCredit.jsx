import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const CREDIT = {
  name: 'Mian Bilal',
  role: 'Full Stack Developer',
  scope: 'Frontend, Backend, Web, Windows and Android Application',
};

function findMount() {
  if (window.location.pathname === '/settings') return null;
  const heading = Array.from(document.querySelectorAll('h2')).find((el) => /update required/i.test(el.textContent || ''));
  const old = document.getElementById('rdc-update-developer-credit');
  if (!heading) { old?.remove(); return null; }
  const modal = heading.closest('div[style*="background:#fff"]') || heading.closest('div[style*="background: rgb(255, 255, 255)"]') || heading.parentElement?.parentElement;
  if (!modal) { old?.remove(); return null; }
  const button = Array.from(modal.querySelectorAll('button')).find((el) => /update now|updating/i.test(el.textContent || ''));
  const footer = button?.parentElement;
  if (!footer) { old?.remove(); return null; }
  let node = modal.querySelector('#rdc-update-developer-credit');
  if (!node) {
    node = document.createElement('div');
    node.id = 'rdc-update-developer-credit';
    footer.parentElement?.insertBefore(node, footer);
  }
  return node;
}

export default function UpdateDeveloperCredit() {
  const [mount, setMount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const attach = () => { if (!cancelled) setMount(findMount()); };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(attach, 500);
    return () => { cancelled = true; observer.disconnect(); window.clearInterval(timer); document.getElementById('rdc-update-developer-credit')?.remove(); };
  }, []);
  if (!mount) return null;
  return createPortal(
    <div style={{ margin:'0 22px 10px', padding:'12px 14px', borderRadius:14, background:'linear-gradient(135deg,#f8fafc,#eff6ff)', border:'1px solid #dbeafe', textAlign:'center' }}>
      <div style={{ fontSize:11, fontWeight:800, color:'#2563eb', textTransform:'uppercase', letterSpacing:.8, marginBottom:4 }}>Developed by</div>
      <div style={{ fontSize:16, fontWeight:850, color:'#0f172a' }}>{CREDIT.name}</div>
      <div style={{ fontSize:12, fontWeight:700, color:'#334155', marginTop:2 }}>{CREDIT.role}</div>
      <div style={{ fontSize:11, lineHeight:1.4, color:'#64748b', marginTop:3 }}>{CREDIT.scope}</div>
    </div>,
    mount
  );
}
