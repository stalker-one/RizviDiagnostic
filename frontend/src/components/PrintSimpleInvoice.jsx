import React from 'react';
import Logo from './Logo.jsx';
import PaidStamp from './PaidStamp.jsx';

export default function PrintSimpleInvoice({ invoice, settings }) {
  if (!invoice) return null;
  const p = invoice.patientSnapshot || {};
  const accent = settings?.simpleAccentColor || '#0a4a93';
  const template = settings?.simpleTemplate || 'classic';
  const isModern = template === 'modern';
  const isCompact = template === 'compact';
  const showStamp = settings?.stampEnabled && invoice.status === 'paid';

  return (
    <div
      className={`bg-white ${isCompact ? 'p-4 sm:p-6' : 'p-4 sm:p-10'} max-w-3xl mx-auto text-slate-800 relative`}
      style={{ fontFamily: 'Segoe UI, sans-serif' }}
    >
      {showStamp && <PaidStamp settings={settings} />}
      {isModern ? (
        <div className="rounded-lg mb-6 p-4 sm:p-6 text-white flex flex-col sm:flex-row sm:justify-between gap-4" style={{ backgroundColor: accent }}>
          <div className="flex items-center gap-3">
            {settings?.simpleShowLogo !== false && (
              <Logo settings={settings} width={settings?.logoWidth || 60} height={settings?.logoHeight || 60} rounded={false} />
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{settings?.clinicName || 'Rizvi Diagnostic Center'}</h1>
              <p className="text-xs sm:text-sm opacity-90">{settings?.address}</p>
              <p className="text-xs sm:text-sm opacity-90">{settings?.phone1} {settings?.phone2 ? `- ${settings.phone2}` : ''}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <h2 className="text-lg sm:text-xl font-semibold">INVOICE</h2>
            <p className="text-xs sm:text-sm opacity-90">Invoice# {invoice.invoiceNumber}</p>
            <p className="text-xs sm:text-sm opacity-90">{new Date(invoice.createdAt).toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-start border-b-2 ${isCompact ? 'pb-2 mb-3' : 'pb-4 mb-6'} gap-3`} style={{ borderColor: accent }}>
          <div className="flex items-start gap-3 sm:gap-4">
            {settings?.simpleShowLogo !== false && (
              <Logo settings={settings} width={settings?.logoWidth} height={settings?.logoHeight} rounded={false} />
            )}
            <div>
              <h1 className={`${isCompact ? 'text-lg' : 'text-2xl'} font-bold`} style={{ color: accent }}>{settings?.clinicName || 'Rizvi Diagnostic Center'}</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">{settings?.address}</p>
              <p className="text-xs sm:text-sm text-slate-500">{settings?.phone1} {settings?.phone2 ? `- ${settings.phone2}` : ''}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <h2 className={`${isCompact ? 'text-base' : 'text-xl'} font-semibold`}>INVOICE</h2>
            <p className="text-xs sm:text-sm text-slate-500">Invoice# {invoice.invoiceNumber}</p>
            <p className="text-xs sm:text-sm text-slate-500">{new Date(invoice.createdAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isCompact ? 'mb-3' : 'mb-6'} text-xs sm:text-sm`}>
        <div className="space-y-0.5">
          <div><span className="text-slate-400">Name: </span><span className="font-medium">{p.name}</span></div>
          <div><span className="text-slate-400">MR#: </span>{p.mrNumber}</div>
          <div><span className="text-slate-400">Phone: </span>{p.phone || '-'}</div>
          <div><span className="text-slate-400">Age/Gender: </span>{p.age ? `${p.age} Y, ` : ''}{p.gender}</div>
          {p.address && <div><span className="text-slate-400">Address: </span>{p.address}</div>}
          {p.doctorName && <div><span className="text-slate-400">Doctor: </span>{p.doctorName}{p.department ? ` (${p.department})` : ''}</div>}
          {!p.doctorName && invoice.patient?.doctorName && (
            <div><span className="text-slate-400">Doctor: </span>{invoice.patient.doctorName}{invoice.patient.department ? ` (${invoice.patient.department})` : ''}</div>
          )}
          {settings?.simpleShowReferredBy !== false && (
            <div><span className="text-slate-400">Referred By: </span>{invoice.referralName || '-'}</div>
          )}
        </div>
        <div className="sm:text-right space-y-0.5">
          <div><span className="text-slate-400">Payment Mode: </span>{invoice.paymentMode}</div>
          <div><span className="text-slate-400">Status: </span><span className="uppercase font-semibold">{invoice.status}</span></div>
          <div><span className="text-slate-400">Booked By: </span>{invoice.createdByName || '-'}</div>
          {invoice.updatedByName && invoice.updatedByName !== invoice.createdByName && (
            <div><span className="text-slate-400">Last Updated By: </span>{invoice.updatedByName}</div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className={`w-full text-xs sm:text-sm ${isCompact ? 'mb-3' : 'mb-6'} min-w-[500px]`}>
          <thead>
            <tr className="text-left" style={{ backgroundColor: `${accent}15` }}>
              <th className="p-2">Procedure / Description</th>
              <th className="p-2 text-right">Rate</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-left">Performed By</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="p-2">{it.description}</td>
                <td className="p-2 text-right">{it.rate.toFixed(2)}</td>
                <td className="p-2 text-right">{it.quantity}</td>
                <td className="p-2 text-right">{it.amount.toFixed(2)}</td>
                <td className="p-2">{it.performedBy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full sm:w-64 text-xs sm:text-sm space-y-1">
          <div className="flex justify-between"><span>Sub Total</span><span>{invoice.subTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-{invoice.discountAmount.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-sm sm:text-base border-t border-slate-200 pt-1">
            <span>Total</span><span>{invoice.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between"><span>Paid Amount</span><span>{invoice.amountPaid.toFixed(2)}</span></div>
          <div className="flex justify-between text-red-600"><span>Due Amount</span><span>{invoice.dueAmount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="mt-6 sm:mt-10 text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
        {settings?.simpleFooterNote || settings?.footerNote || 'Thank you for choosing Rizvi Diagnostic Center'}
      </div>
    </div>
  );
}
