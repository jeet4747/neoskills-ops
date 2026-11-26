import './GstInvoiceDocument.css';
import { amountInWords } from '../utils/amountInWords';

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
const DEFAULT_COLOR = '#1f4e79';

function tint(hex, amount = 0.1) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '#eef3f8';
  const mix = (c) => Math.round(parseInt(c, 16) * amount + 255 * (1 - amount)).toString(16).padStart(2, '0');
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

export default function GstInvoiceDocument({ form, settings, totals, doc }) {
  const symbol = SYMBOLS[doc.currency] || '';
  const money = (value) => `${symbol ? `${symbol} ` : ''}${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
  const terms = doc.terms
    ? doc.terms.split('\n').map((line) => line.replace(/^\s*\d+[.)]\s*/, '')).filter(Boolean)
    : settingsTerms(settings);
  const isQuotation = doc.docType === 'Quotation';
  const isProforma = doc.docType === 'Proforma Invoice';
  const numberLabel = isQuotation ? 'Quotation No.' : isProforma ? 'Proforma No.' : 'Invoice No.';
  const subtitle = isQuotation ? 'Quotation for Training Services' : isProforma ? 'Proforma Invoice for Recipient' : 'Original for Recipient';
  const entity = settings.entity_name || 'NeoSkills';
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
    <div className="gst-doc-shell">
      <article className="gst-doc" style={{ '--gst-p': doc.color || DEFAULT_COLOR, '--gst-tint': tint(doc.color || DEFAULT_COLOR), '--gst-fs': `${doc.fontSize || 13}px` }}>
        <div className="gst-accent" />

        <header className="gst-doc-head">
          <div className="gst-brand">
            <div className="gst-logo"><img src={doc.logo || '/logo/nsl-logo-cropped.png'} alt={`${entity} logo`} /></div>
            <div className="gst-brand-text">
              <h2>{entity}</h2>
              <p>{settings.sac_description || 'Commercial Training & Coaching Services'}</p>
            </div>
          </div>
          <div className="gst-contact">
            <span>{settings.address}</span>
            <span>{[settings.website, settings.phone].filter(Boolean).join('  ·  ')}</span>
            <span className="gst-ids">GSTIN {settings.gstin || '-'} &nbsp;|&nbsp; PAN {settings.pan || '-'}</span>
          </div>
        </header>

        <section className="gst-title-wrap">
          <div>
            <div className="gst-title">{doc.docType.toUpperCase()}</div>
            <div className="gst-subtitle">{subtitle}</div>
          </div>
          {!isQuotation && !isProforma && form.status && (
            <span className={`gst-status gst-status-${form.status}`}>{form.status.toUpperCase()}</span>
          )}
        </section>

        <section className="gst-two">
          <div className="gst-box">
            <h4>BILLED TO</h4>
            <div className="in gst-party">
              <strong>{form.student_name || 'Customer name'}</strong>
              {form.company && <span>{form.company}</span>}
              {[form.location, form.city].filter(Boolean).length > 0 && <span>{[form.location, form.city].filter(Boolean).join(', ')}</span>}
              {form.state_name && <span>{form.state_name}{form.state_code ? ` (${form.state_code})` : ''}</span>}
              <span className="gst-muted">GSTIN: {form.customer_gstin || '-'}</span>
            </div>
          </div>
          <div className="gst-box">
            <h4>DOCUMENT DETAILS</h4>
            <div className="in gst-kv">
              <div><span>{numberLabel}</span><b>{form.invoice_number || (form.id ? `#${form.id}` : 'Draft')}</b></div>
              <div><span>Date</span><b>{dateLabel(form.invoice_date)}</b></div>
              <div><span>Reference</span><b>{form.reference || '-'}</b></div>
              <div><span>Place of Supply</span><b>{form.state_name || settings.state || '-'} ({form.state_code || settings.state_code || '00'})</b></div>
            </div>
          </div>
        </section>

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
            <span className="gst-label">Amount in Words</span>
            <b>{amountInWords(totals.total, doc.currency)}</b>
            <span className="gst-muted">Tax payable under reverse charge: No</span>
          </div>
          <div className="gst-tot">
            <div><span>Taxable Value</span><span>{money(totals.subtotal)}</span></div>
            {taxRows}
            {totals.roundOff ? <div><span>Round Off</span><span>{totals.roundOff > 0 ? '+' : ''}{money(Math.abs(totals.roundOff))}</span></div> : null}
            <div className="g"><span>Total Amount</span><span>{money(totals.total)}</span></div>
          </div>
        </div>

        <div className="gst-foot">
          <div className="gst-box"><h4>BANK DETAILS</h4><div className="in gst-bank">{[
            `Account Name: ${settings.bank_account_name || '-'}`,
            `Account No.: ${settings.bank_account_number || '-'}`,
            `IFSC Code: ${settings.bank_ifsc || '-'}`,
            settings.bank_account_type ? `Account Type: ${settings.bank_account_type}` : '',
          ].filter(Boolean).join('\n')}</div></div>
          <div className="gst-sig">
            <b>For {entity}</b>
            {form.poc && <div className="gst-poc">POC: {form.poc}</div>}
            <div className="line">Authorised Signatory</div>
            <div className="gst-muted gst-sig-note">This is a system-generated document and does not require a physical signature.</div>
          </div>
        </div>

        {terms.length > 0 && (
          <div className="gst-terms">
            <h4>Terms &amp; Conditions</h4>
            <ol>{terms.map((term, i) => <li key={i}>{term}</li>)}</ol>
          </div>
        )}

        <footer className="gst-doc-footer">
          <span>{entity} · {settings.website || 'www.neoskills.co.in'}</span>
          <span>Page 1 of 1</span>
        </footer>
      </article>
    </div>
  );
}
