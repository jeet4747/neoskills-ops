import { useRef } from 'react';
import { Download, Printer, Save, Upload } from 'lucide-react';
import './GstInvoiceDocument.css';
import { amountInWords } from '../utils/amountInWords';

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
const DEFAULT_COLOR = '#1f4e79';

function tint(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '#eef3f8';
  const mix = (c) => Math.round(parseInt(c, 16) * 0.1 + 255 * 0.9).toString(16).padStart(2, '0');
  return `#${mix(m[1])}${mix(m[2])}${mix(m[3])}`;
}

function settingsTerms(settings) {
  if (Array.isArray(settings?.terms)) return settings.terms;
  try { return JSON.parse(settings?.terms || '[]'); } catch { return []; }
}

function dateLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function GstInvoiceDocument({
  form, settings, totals, doc, onDocChange, onSave, saving, onSaveJson, onLoadJson,
}) {
  const logoRef = useRef(null);
  const jsonRef = useRef(null);
  const symbol = SYMBOLS[doc.currency] || '';
  const money = (value) => `${symbol ? `${symbol} ` : ''}${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
  const rate = Number(doc.taxRate) || Number(settings.tax_rate) || 18;
  const terms = doc.terms
    ? doc.terms.split('\n').map((line) => line.replace(/^\s*\d+[.)]\s*/, '')).filter(Boolean)
    : settingsTerms(settings);
  const company = [
    settings.entity_name || 'NeoSkills',
    settings.address || '',
    [settings.website, settings.phone].filter(Boolean).join(' | '),
    `GSTIN: ${settings.gstin || ''} | PAN: ${settings.pan || ''}`,
  ].filter(Boolean).join('\n');
  const party = [
    form.student_name || 'Customer name',
    form.company || '',
    [form.location, form.city].filter(Boolean).join(', '),
    form.state_name ? `${form.state_name}${form.state_code ? ` (${form.state_code})` : ''}` : '',
    `GSTIN: ${form.customer_gstin || '-'}`,
  ].filter(Boolean).join('\n');
  const details = [
    `Invoice No.: ${form.invoice_number || (form.id ? `#${form.id}` : 'New invoice')}`,
    `Date: ${dateLabel(form.invoice_date)}`,
    `Reference: ${form.reference || '-'}`,
    `Place of Supply: ${form.state_name || settings.state || ''} (${form.state_code || settings.state_code || '00'})`,
  ].join('\n');
  const bank = [
    `Account Name: ${settings.bank_account_name || ''}`,
    `Account No.: ${settings.bank_account_number || ''}`,
    `IFSC Code: ${settings.bank_ifsc || ''}`,
    settings.bank_account_type ? `Account Type: ${settings.bank_account_type}` : '',
  ].filter(Boolean).join('\n');
  const taxRows = totals.exportBill ? (
    <div><span>IGST (0%) — Export / Zero Rated</span><span>{money(0)}</span></div>
  ) : totals.sameState ? (
    <>
      <div><span>CGST @ {totals.cgstRate}%</span><span>{money(totals.cgst)}</span></div>
      <div><span>SGST @ {totals.sgstRate}%</span><span>{money(totals.sgst)}</span></div>
    </>
  ) : (
    <div><span>IGST @ {totals.igstRate}%</span><span>{money(totals.igst)}</span></div>
  );

  return (
    <div className="space-y-3">
      <div className="gst-doc-toolbar">
        <label>Document
          <select value={doc.docType} onChange={(e) => onDocChange({ docType: e.target.value })}>
            <option value="Tax Invoice">Tax Invoice</option>
            <option value="Quotation">Quotation</option>
            <option value="Proforma Invoice">Proforma Invoice</option>
          </select>
        </label>
        <label>Tax
          <select value={doc.taxMode} onChange={(e) => onDocChange({ taxMode: e.target.value })}>
            <option value="exclusive">Extra</option>
            <option value="inclusive">Included</option>
          </select>
        </label>
        <label>Rate % <input type="number" min="0" max="100" step="0.01" value={doc.taxRate}
          onChange={(e) => onDocChange({ taxRate: e.target.value })} /></label>
        <label>Currency
          <select value={doc.currency} onChange={(e) => onDocChange({ currency: e.target.value })}>
            <option value="INR">INR</option><option value="USD">USD</option>
            <option value="EUR">EUR</option><option value="GBP">GBP</option>
          </select>
        </label>
        <label>Colour <input type="color" value={doc.color || DEFAULT_COLOR}
          onChange={(e) => onDocChange({ color: e.target.value })} /></label>
        <label>Font <input type="number" min="10" max="18" step="1" value={doc.fontSize}
          onChange={(e) => onDocChange({ fontSize: e.target.value })} /></label>
        <label className="btn-secondary text-xs cursor-pointer">Logo
          <input ref={logoRef} type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onDocChange({ logo: reader.result });
            reader.readAsDataURL(file);
            e.target.value = '';
          }} />
        </label>
        <button type="button" className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => onSaveJson()}>
          <Download size={13} /> Save JSON
        </button>
        <button type="button" className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => jsonRef.current?.click()}>
          <Upload size={13} /> Load JSON
        </button>
        <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onLoadJson(file);
          e.target.value = '';
        }} />
        <button type="button" className="btn-secondary text-xs flex items-center gap-1.5" onClick={() => window.print()}>
          <Printer size={13} /> Print / PDF
        </button>
        <button type="button" disabled={saving} className="btn-primary text-xs flex items-center gap-1.5" onClick={onSave}>
          <Save size={13} /> {saving ? 'Saving…' : form.id ? 'Update Invoice' : 'Save Invoice'}
        </button>
      </div>

      <div className="gst-doc-shell">
        <div className="gst-doc" style={{ '--gst-p': doc.color || DEFAULT_COLOR, '--gst-tint': tint(doc.color || DEFAULT_COLOR), '--gst-fs': `${doc.fontSize || 13}px` }}>
          <div className="gst-doc-head">
            <div className="gst-logo">
              <img src={doc.logo || '/logo/nsl-logo-cropped.png'} alt="NeoSkills logo" />
            </div>
            <div className="gst-company">{company}</div>
          </div>

          <div className="gst-title">{doc.docType.toUpperCase()}</div>

          <div className="gst-two">
            <div className="gst-box"><h4>BILLED TO</h4><div className="in">{party}</div></div>
            <div className="gst-box"><h4>DOCUMENT DETAILS</h4><div className="in">{details}</div></div>
          </div>

          <table className="gst-items">
            <colgroup>
              <col style={{ width: '38px' }} /><col /><col style={{ width: '90px' }} />
              <col style={{ width: '52px' }} /><col style={{ width: '100px' }} /><col style={{ width: '115px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="c">Sr.</th><th>Description</th><th>SAC / HSN</th>
                <th className="c">Qty</th><th className="r">Rate</th><th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {totals.items.map((item, i) => (
                <tr key={i}>
                  <td className="c">{i + 1}</td>
                  <td>{item.description || '—'}</td>
                  <td className="c">{form.sac || settings.sac || '999293'}</td>
                  <td className="c">{item.participants}</td>
                  <td className="r">{money(item.unit_price)}</td>
                  <td className="r amount">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="gst-sum">
            <div className="gst-words">
              <span>Amount in Words</span>
              <b>{amountInWords(totals.total, doc.currency)}</b>
              <span>Tax payable under reverse charge: No</span>
            </div>
            <div className="gst-tot">
              <div><span>Taxable Value</span><span>{money(totals.subtotal)}</span></div>
              {taxRows}
              {totals.roundOff ? <div><span>Round Off</span><span>{totals.roundOff > 0 ? '+' : ''}{money(Math.abs(totals.roundOff))}</span></div> : null}
              <div className="g"><span>Total Amount</span><span>{money(totals.total)}</span></div>
            </div>
          </div>

          <div className="gst-foot">
            <div className="gst-box"><h4>BANK DETAILS</h4><div className="in">{bank}</div></div>
            <div className="gst-sig">
              <b>For {settings.entity_name || 'NeoSkills'}</b>
              {form.poc && <div style={{ marginTop: 24 }}>POC: {form.poc}</div>}
              <div className="line">Authorised Signatory</div>
            </div>
          </div>

          <div className="gst-terms">
            <h4>Terms &amp; Conditions</h4>
            <div className="in">{terms.map((term, i) => `${i + 1}. ${term}`).join('\n')}</div>
          </div>
          <div className="gst-note">This is a computer-generated document.</div>
        </div>
      </div>
    </div>
  );
}
