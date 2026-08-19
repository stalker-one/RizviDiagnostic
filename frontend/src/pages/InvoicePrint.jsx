import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import Layout from '../components/Layout.jsx';
import PrintThermalInvoice from '../components/PrintThermalInvoice.jsx';
import PrintSimpleInvoice from '../components/PrintSimpleInvoice.jsx';
import Button from '../components/Button.jsx';
import PageLoader from '../components/PageLoader.jsx';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const NativePrint = registerPlugin('Print');

async function printInvoice() {
  if (Capacitor.getPlatform() === 'android') {
    await NativePrint.print();
    return;
  }
  window.print();
}

export default function InvoicePrint() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});
  const [format, setFormat] = useState('simple');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/invoices/${encodeURIComponent(id)}`);
        if (!cancelled) setInvoice(response.data);
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          setError(
            status === 404
              ? 'This invoice could not be found. It may not have finished syncing to the live database yet.'
              : status === 401
                ? 'Your session has expired. Please log in again to view this invoice.'
                : 'Unable to load this invoice. Please try again.'
          );
        }
      }

      try {
        const response = await api.get('/settings');
        if (!cancelled && response.data) {
          setSettings(response.data);
          if (response.data.printFormat === 'thermal') setFormat('thermal');
          if (response.data.printFormat === 'simple') setFormat('simple');
        }
      } catch (err) {
        console.warn('[invoice-print] Settings unavailable; using defaults.', err);
      }

      if (!cancelled) setLoading(false);
    }

    loadInvoice();
    return () => { cancelled = true; };
  }, [id]);

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await printInvoice();
    } catch (err) {
      console.error('[invoice-print] Print failed:', err);
      // Android native printing is preferred. If the native bridge is not
      // available in an older APK, retain the browser/WebView fallback.
      try { window.print(); } catch (fallbackError) { console.error(fallbackError); }
    } finally {
      setPrinting(false);
    }
  };

  if (loading) return <Layout title="Invoice"><PageLoader message="Loading invoice..." /></Layout>;

  if (error || !invoice) {
    return (
      <Layout title="Invoice">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Unable to open invoice</h2>
          <p className="text-sm text-slate-500 mb-5">{error || 'Invoice not found.'}</p>
          <div className="flex gap-2">
            <Button as={Link} to="/invoices" variant="secondary" icon={ArrowLeft} size="sm">Back to Invoices</Button>
            <Button variant="outline" icon={RefreshCw} size="sm" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Invoice ${invoice.invoiceNumber}`}>
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-3 sm:p-4">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFormat('simple')} className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${format === 'simple' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Simple (A4)</button>
          <button onClick={() => setFormat('thermal')} className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${format === 'thermal' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Thermal (80mm)</button>
        </div>
        <div className="flex gap-2">
          <Button as={Link} to="/invoices" variant="secondary" icon={ArrowLeft} size="sm">Back</Button>
          <Button variant="success" icon={Printer} onClick={handlePrint} disabled={printing} size="sm">{printing ? 'Opening printer...' : 'Print'}</Button>
        </div>
      </div>

      <div id="printable-area" className="bg-white rounded-xl border border-slate-100 shadow-sm py-6 overflow-x-auto">
        {format === 'simple' ? <PrintSimpleInvoice invoice={invoice} settings={settings} /> : <PrintThermalInvoice invoice={invoice} settings={settings} />}
      </div>
    </Layout>
  );
}
