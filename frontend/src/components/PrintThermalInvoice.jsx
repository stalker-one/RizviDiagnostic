import React from 'react';
import Logo from './Logo.jsx';
import PaidStamp from './PaidStamp.jsx';

export default function PrintThermalInvoice({ invoice, settings }) {
  if (!invoice) return null;
  const p = invoice.patientSnapshot || {};
  const paperWidth = settings?.thermalPaperWidth || 80;
  const fontSize = settings?.thermalFontSize || 11;
  const showStamp = settings?.stampEnabled && invoice.status === 'paid';
  
  // Get stamp position from settings or default to 'center'
  const stampPosition = settings?.stampPosition || 'center';

  // Function to get stamp styles based on position
  const getStampStyles = () => {
    const baseStyles = {
      position: 'absolute',
      zIndex: 10,
      opacity: 1, // Changed to 1 (fully opaque)
      pointerEvents: 'none'
    };

    switch(stampPosition) {
      case 'top-left':
        return {
          ...baseStyles,
          top: '10%',
          left: '10%',
          transform: 'rotate(-15deg)'
        };
      case 'top-right':
        return {
          ...baseStyles,
          top: '10%',
          right: '10%',
          transform: 'rotate(15deg)'
        };
      case 'top-center':
        return {
          ...baseStyles,
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%) rotate(0deg)'
        };
      case 'center-left':
        return {
          ...baseStyles,
          top: '50%',
          left: '10%',
          transform: 'translateY(-50%) rotate(-15deg)'
        };
      case 'center-right':
        return {
          ...baseStyles,
          top: '50%',
          right: '5%',
          transform: 'translateY(-50%) rotate(55deg)'
        };
      case 'bottom-left':
        return {
          ...baseStyles,
          bottom: '10%',
          left: '10%',
          transform: 'rotate(-15deg)'
        };
      case 'bottom-right':
        return {
          ...baseStyles,
          bottom: '10%',
          right: '10%',
          transform: 'rotate(15deg)'
        };
      case 'bottom-center':
        return {
          ...baseStyles,
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%) rotate(0deg)'
        };
      case 'center':
      default:
        return {
          ...baseStyles,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-20deg)'
        };
    }
  };

  return (
    <div
      className="thermal-invoice mx-auto relative"
      style={{ 
        width: `${paperWidth}mm`, 
        fontSize: `${fontSize}px`, 
        padding: '6px 8px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: '1.5',
        backgroundColor: '#fff',
        color: '#000',
        minHeight: '100mm',
        position: 'relative'
      }}
    >
      {/* Stamp - Position from admin settings */}
      {showStamp && (
        <div style={getStampStyles()}>
          <PaidStamp settings={settings} compact />
        </div>
      )}

      {/* Logo - Centered */}
      {settings?.thermalShowLogo !== false && settings?.logoUrl && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '5px',
          width: '100%'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Logo 
              settings={settings} 
              width={settings?.thermalLogoWidth} 
              height={settings?.thermalLogoHeight} 
              rounded={false} 
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '5px' }}>
        <div style={{ fontWeight: 'bold', fontSize: `${fontSize + 2}px` }}>
          {settings?.clinicName || 'Rizvi Diagnostic Center'}
        </div>
        <div>Address: {settings?.address}</div>
        <div>Phone: {settings?.phone1}{settings?.phone2 ? ` -${settings.phone2}` : ''}</div>
      </div>

      {/* Patient Info */}
      <div style={{ borderTop: '1px solid black', paddingTop: '5px', marginTop: '5px' }}>
        <div><b>Invoice#</b> {invoice.invoiceNumber}</div>
        <div><b>Date:</b> {new Date(invoice.createdAt).toLocaleString()}</div>
        <div><b>Name:</b> {p.name}</div>
        <div><b>MR#:</b> {p.mrNumber}</div>
        {p.phone && <div><b>Phone:</b> {p.phone}</div>}
        <div><b>Age/Gender:</b> {p.age ? `${p.age} Y, ` : ''}0 M, 0 D/ {p.gender}</div>
        {p.address && <div><b>Address:</b> {p.address}</div>}
        {p.doctorName && <div><b>Doctor:</b> {p.doctorName}{p.department ? ` (${p.department})` : ''}</div>}
        {!p.doctorName && invoice.patient?.doctorName && (
          <div><b>Doctor:</b> {invoice.patient.doctorName}{invoice.patient.department ? ` (${invoice.patient.department})` : ''}</div>
        )}
        {settings?.thermalShowReferredBy !== false && (
          <div><b>Referred By:</b> {invoice.referralName || '-'}</div>
        )}
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderTop: '1px solid black', borderBottom: '1px solid black' }}>
            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 'bold' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.id}>
              <td style={{ padding: '3px 0', borderBottom: '1px dotted #ddd' }}>
                {it.description}{it.quantity > 1 ? ` x${it.quantity}` : ''}
              </td>
              <td style={{ padding: '3px 0', textAlign: 'right', borderBottom: '1px dotted #ddd' }}>
                {it.amount.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ 
        marginTop: '8px',
        borderTop: '1px solid black', 
        paddingTop: '5px'
      }}>
        {invoice.discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount:</span>
            <span>{invoice.discountAmount.toFixed(1)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>Total:</span>
          <span>{invoice.total.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Payment Mode:</span>
          <span>{invoice.paymentMode}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Paid Amount:</span>
          <span>{invoice.amountPaid.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
          <span>Due Amount:</span>
          <span>Rs. {invoice.dueAmount.toFixed(1)}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '8px',
        borderTop: '1px dashed black', 
        paddingTop: '5px'
      }}>
        {settings?.thermalFooterNote || settings?.footerNote || 'Thank you for choosing Rizvi Diagnostic Center'}
      </div>
      
      <div style={{ 
        textAlign: 'center', 
        fontSize: '10px', 
        color: '#888', 
        marginTop: '5px' 
      }}>
        Booked by: {invoice.createdByName || '-'}
      </div>
    </div>
  );
}