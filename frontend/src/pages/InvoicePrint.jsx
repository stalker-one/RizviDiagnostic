import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import PrintThermalInvoice from '../components/PrintThermalInvoice.jsx';
import PrintSimpleInvoice from '../components/PrintSimpleInvoice.jsx';
import Button from '../components/Button.jsx';
import PageLoader from '../components/PageLoader.jsx';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '../api/axios';

export default function InvoicePrint() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [format, setFormat] = useState('simple'); // 'simple' | 'thermal'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get(`/invoices/${id}`), api.get('/settings')])
      .then(([i, s]) => {
        setInvoice(i.data);
        setSettings(s.data);
        if (s.data?.printFormat === 'thermal') setFormat('thermal');
        if (s.data?.printFormat === 'simple') setFormat('simple');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout title="Invoice"><PageLoader message="Loading invoice..." /></Layout>;
  if (!invoice) return <Layout title="Invoice"><div className="text-slate-400">Invoice not found.</div></Layout>;

  return (
    <Layout title={`Invoice ${invoice.invoiceNumber}`}>
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white rounded-xl border border-slate-100 shadow-sm p-3 sm:p-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFormat('simple')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${format === 'simple' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Simple (A4)
          </button>
          <button
            onClick={() => setFormat('thermal')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition ${format === 'thermal' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Thermal (80mm)
          </button>
        </div>
        <div className="flex gap-2">
          <Button as={Link} to="/invoices" variant="secondary" icon={ArrowLeft} size="sm">Back</Button>
          <Button variant="success" icon={Printer} onClick={() => window.print()} size="sm">Print</Button>
        </div>
      </div>

      <div id="printable-area" className="bg-white rounded-xl border border-slate-100 shadow-sm py-6 overflow-x-auto">
        {format === 'simple' ? (
          <PrintSimpleInvoice invoice={invoice} settings={settings} />
        ) : (
          <PrintThermalInvoice invoice={invoice} settings={settings} />
        )}
      </div>
    </Layout>
  );
}
