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

function buildPrintableHtml(format) {
  const target = document.getElementById('printable-area');
  if (!target) throw new Error('Printable invoice area was not found.');

  const styles = Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent || '')
    .join('\n');
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join('\n');

  const thermal = format === 'thermal';
  const width = thermal ? '80mm' : '190mm';
  const outerCss = thermal
    ? `
      @page{size:80mm auto;margin:0!important;}
      html,body{width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important;background:#fff!important;}
      #printable-area{width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important;overflow:visible!important;box-shadow:none!important;border:0!important;}
      #printable-area>div{width:80mm!important;max-width:80mm!important;min-width:0!important;margin:0!important;padding:2mm!important;box-shadow:none!important;border:0!important;overflow:visible!important;}
      #printable-area table{width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important;}
    `
    : `
      @page{size:A4;margin:10mm!important;}
      html,body{width:190mm!important;max-width:190mm!important;margin:0!important;padding:0!important;background:#fff!important;}
      #printable-area{width:190mm!important;max-width:190mm!important;margin:0!important;padding:0!important;overflow:visible!important;box-shadow:none!important;border:0!important;}
      #printable-area>div{width:190mm!important;max-width:190mm!important;min-width:0!important;margin:0!important;padding:0!important;box-shadow:none!important;border:0!important;overflow:visible!important;}
      #printable-area table{width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important;}
    `;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=${width}">
${links}<style>${styles}
html,body{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;}
.no-print{display:none!important;}
*{box-sizing:border-box!important;}
img{max-width:100%!important;height:auto!important;}
#printable-area{box-shadow:none!important;border:0!important;}
${outerCss}
@media print{html,body{margin:0!important;padding:0!important;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}}
</style></head><body>${target.outerHTML}</body></html>`;
}

async function printInvoice(format) {
  if (Capacitor.getPlatform() === 'android') {
    const html = buildPrintableHtml(format);
    await NativePrint.print({
      html,
      type: format === 'thermal' ? 'thermal-80mm' : 'simple-a4',
      name: format === 'thermal' ? 'Rizvi Diagnostic Thermal Invoice' : 'Rizvi Diagnostic Invoice',
    });
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
      await printInvoice(format);
    } catch (err) {
      console.error('[invoice-print] Native print failed:', err);
      try {
        window.print();
      } catch (fallbackError) {
        console.error('[invoice-print] Browser print fallback failed:', fallbackError);
        setError('Printing could not be started. Please check that an Android print service/printer is available and try again.');
      }
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
