export function getReceiptUrls(p) {
  if (Array.isArray(p?.receipt_urls) && p.receipt_urls.length) return p.receipt_urls;
  if (p?.receipt_url) return [p.receipt_url];
  return [];
}