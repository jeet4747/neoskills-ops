const TZ = 'Asia/Kolkata';

export function istDate(d) {
  return new Date(d ?? Date.now()).toLocaleString('en-CA', { timeZone: TZ }).slice(0, 10);
}

export function istMonth(d) {
  return new Date(d ?? Date.now()).toLocaleString('en-CA', { timeZone: TZ }).slice(0, 7);
}
