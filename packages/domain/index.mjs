export const TYPES = {
  OVERDUE_RECALL: { label: 'Overdue recall', short: 'Recall', action: 'Invite for a routine eye examination', color: 'blue' },
  CL_REPLENISHMENT: { label: 'Contact lens replenishment', short: 'Contact lenses', action: 'Offer help with contact lens replenishment', color: 'green' },
  INACTIVE_PATIENT: { label: 'Valuable patient re-engagement', short: 'Re-engagement', action: 'Reconnect and offer a visit to the practice', color: 'purple' },
  MISSED_APPOINTMENT: { label: 'Missed appointment', short: 'Rebooking', action: 'Offer help arranging another appointment', color: 'amber' },
  RECENT_PURCHASE: { label: 'Recent purchase follow-up', short: 'Follow-up', action: 'Check in on the recent purchase experience', color: 'pink' },
  UNCOLLECTED_ORDER: { label: 'Uncollected order', short: 'Collection', action: 'Invite the patient to arrange collection', color: 'orange' },
};
export function practiceDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function daysSince(date, now = new Date()) { return date ? Math.floor((Date.parse(practiceDate(now)) - Date.parse(date.slice(0,10))) / 86400000) : null; }
export const money = cents => new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD', maximumFractionDigits: 0 }).format((cents || 0) / 100);
export const phoneValid = phone => /^\+[1-9]\d{7,14}$/.test(phone || '');
export const emailValid = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
export function exclusionReason(patient, channel) {
  if (patient.status !== 'active') return 'Patient is not active';
  if (!patient.marketing_consent) return 'Marketing consent is not recorded';
  if (channel === 'email' ? !emailValid(patient.email) : !phoneValid(patient.phone)) return `No valid ${channel === 'email' ? 'email address' : 'phone number'}`;
  return null;
}
