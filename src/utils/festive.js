// Diwali 2026 runs from 1–15 November. The festive touches and the wishes
// popup only appear inside this window, so the app returns to normal after.
export const DIWALI_YEAR = 2026;
export const DIWALI_START = new Date('2026-11-01T00:00:00+05:30');
export const DIWALI_END = new Date('2026-11-16T00:00:00+05:30'); // exclusive

export const MOTIVATION_SESSION_KEY = 'ns_team_target_popup';
export const DIWALI_CELEBRATED_KEY = `ns_diwali_${DIWALI_YEAR}_celebrated`;

export function isDiwaliPeriod(now = new Date()) {
  const t = now.getTime();
  return t >= DIWALI_START.getTime() && t < DIWALI_END.getTime();
}

export function diwaliSeenKey(userId) {
  return `ns_diwali_${DIWALI_YEAR}_${userId ?? 'guest'}`;
}
