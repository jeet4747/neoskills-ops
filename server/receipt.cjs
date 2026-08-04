const PDFDocument = require('pdfkit');

const COMPANY = {
  name: 'Neoskill Learning Solutions',
  address: '4th floor, Office no-402, Yugal Parnavi, Sai Chowk Rd, near Irani cafe, Laxman Nagar, Baner, Pune, Maharashtra 411045',
  phone: '9975214585',
  pan: 'AAVPN4318E',
  email: 'account@neoskills.co.in',
  website: 'www.neoskills.co.in',
};

const CURRENCY = '\u20B9';

function toWords(num) {
  num = Math.round(Number(num) || 0);
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ''));
  const three = (n) => (n < 100 ? two(n) : a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : ''));
  let words = '';
  if (num >= 10000000) { words += three(Math.floor(num / 10000000)) + ' Crore '; num %= 10000000; }
  if (num >= 100000) { words += three(Math.floor(num / 100000)) + ' Lakh '; num %= 100000; }
  if (num >= 1000) { words += three(Math.floor(num / 1000)) + ' Thousand '; num %= 1000; }
  if (num > 0) words += three(num);
  return words.trim() + ' Rupees Only';
}

function formatINR(n) {
  const value = Number(n) || 0;
  const s = Math.round(value).toString();
  let lastThree = s.substring(s.length - 3);
  const other = s.substring(0, s.length - 3);
  if (other !== '') lastThree = ',' + lastThree;
  return other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
}

function generateReceipt(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  const W = doc.page.width - 100;
  const margin = 50;
  const dark = '#1e293b';
  const gray = '#475569';
  const border = '#cbd5e1';

  let y = margin;

  // BILL OF SUPPLY header
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text('BILL OF SUPPLY', margin, y);
  doc.rect(margin + 115, y - 2, 120, 16).fill('#e2e8f0');
  doc.font('Helvetica-Bold').fontSize(7).fillColor(gray).text('ORIGINAL FOR RECIPIENT', margin + 120, y + 2);
  y += 28;

  // Company info
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#111').text(COMPANY.name, margin, y);
  y += 20;
  doc.font('Helvetica').fontSize(8).fillColor(gray);
  doc.text(COMPANY.address, margin, y, { width: W - 120 });
  y += 28;
  doc.text('Mobile: ' + COMPANY.phone + '    PAN Number: ' + COMPANY.pan, margin, y);
  y += 12;
  doc.text('Email: ' + COMPANY.email, margin, y);
  y += 12;
  doc.text(COMPANY.website, margin, y);
  y += 18;

  // Invoice details bar
  doc.rect(margin, y, W, 22).fill(dark);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
  doc.text('Invoice No.: ' + data.receipt_number, margin + 10, y + 7, { continued: true });
  doc.text('    Invoice Date: ' + data.date, margin + 180, y + 7, { continued: true });
  doc.text('    Due Date: ' + data.date, margin + 370, y + 7, { lineBreak: false });
  y += 36;

  // Bill To
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text('BILL TO', margin, y);
  y += 14;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(data.student_name, margin, y);
  y += 14;
  if (data.student_phone) {
    doc.font('Helvetica').fontSize(8).fillColor(gray).text('Mobile: ' + data.student_phone, margin, y);
    y += 14;
  }
  y += 6;

  // Divider
  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(border).lineWidth(1).stroke();
  y += 10;

  // Services table header
  doc.rect(margin, y, W, 18).fill('#f1f5f9');
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111');
  doc.text('SERVICES', margin + 10, y + 5);
  doc.text('QTY.', margin + 280, y + 5, { width: 50, align: 'center' });
  doc.text('RATE', margin + 340, y + 5, { width: 70, align: 'right' });
  doc.text('AMOUNT', margin + W - 80, y + 5, { width: 70, align: 'right' });
  y += 24;

  // Service row
  doc.font('Helvetica').fontSize(9).fillColor('#111');
  doc.text(data.course_name || 'Course', margin + 10, y);
  doc.text('1', margin + 280, y, { width: 50, align: 'center' });
  doc.text(CURRENCY + ' ' + formatINR(data.total_amount), margin + 340, y, { width: 70, align: 'right' });
  doc.text(CURRENCY + ' ' + formatINR(data.total_amount), margin + W - 80, y, { width: 70, align: 'right' });
  y += 20;

  // Divider
  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(border).lineWidth(1).stroke();
  y += 10;

  // Subtotal
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111');
  doc.text('SUBTOTAL', margin + 10, y);
  doc.text('1', margin + 280, y, { width: 50, align: 'center' });
  doc.text(CURRENCY + ' ' + formatINR(data.total_amount), margin + W - 80, y, { width: 70, align: 'right' });
  y += 16;

  // Divider
  doc.moveTo(margin, y).lineTo(margin + W, y).strokeColor(border).lineWidth(1).stroke();
  y += 20;

  // Terms + Financial Summary
  const halfW = W * 0.55;
  const rightX = margin + halfW + 20;

  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('TERMS AND CONDITIONS', margin, y);
  doc.font('Helvetica').fontSize(7.5).fillColor(gray);
  doc.text('1. Goods once sold will not be taken back or exchanged', margin, y + 12, { width: halfW });
  doc.text('2. All disputes are subject to Pune jurisdiction only', margin, y + 22, { width: halfW });

  // Financial summary box
  const summaryY = y;
  doc.rect(rightX - 10, summaryY - 2, 190, 80).fill('#f8fafc').strokeColor(border).lineWidth(0.5).stroke();

  let sy = summaryY + 8;
  doc.font('Helvetica').fontSize(8.5).fillColor('#111');
  doc.text('Total Amount', rightX, sy, { width: 120 });
  doc.text(CURRENCY + ' ' + formatINR(data.total_amount), rightX + 120, sy, { width: 60, align: 'right' });
  sy += 16;

  doc.text('Received Amount', rightX, sy, { width: 120 });
  doc.text(CURRENCY + ' ' + formatINR(data.total_paid), rightX + 120, sy, { width: 60, align: 'right' });
  sy += 16;

  doc.moveTo(rightX, sy - 4).lineTo(rightX + 180, sy - 4).strokeColor(border).lineWidth(0.5).stroke();

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111');
  doc.text('Balance', rightX, sy, { width: 120 });
  doc.text(CURRENCY + ' ' + formatINR(data.total_pending), rightX + 120, sy, { width: 60, align: 'right' });

  y += 100;

  // Amount in words
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('Total Amount (in words)', margin, y);
  doc.font('Helvetica').fontSize(8).fillColor(gray).text(toWords(data.total_paid), margin, y + 12);
  y += 30;

  // Stamp placeholder
  doc.circle(margin + W - 50, y + 10, 28).lineWidth(1).strokeColor('#1e3a8a');
  doc.font('Helvetica-Bold').fontSize(6).fillColor('#1e3a8a');
  doc.text('NEO', margin + W - 58, y + 3, { width: 16, align: 'center' });
  doc.text('SKILLS', margin + W - 58, y + 11, { width: 16, align: 'center' });
  doc.text('PUNE', margin + W - 58, y + 19, { width: 16, align: 'center' });

  // Authorised Signatory
  const sigY = doc.page.height - 100;
  doc.moveTo(margin + 110, sigY + 30).lineTo(margin + 280, sigY + 30).strokeColor('#9ca3af').lineWidth(1).stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111').text('AUTHORISED SIGNATORY FOR', margin + 110, sigY + 34, { width: 170, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(gray).text('Neoskill Learning Solutions', margin + 110, sigY + 46, { width: 170, align: 'center' });

  doc.end();
  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = { generateReceipt, toWords, formatINR };
