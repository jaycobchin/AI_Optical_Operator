import { TYPES, money } from '../domain/index.mjs';
// The provider chooses a phrase plan, never facts. The renderer owns every word
// containing patient/practice context; unsupported provider fields are discarded.
export class TemplateProvider { async plan({ tone = 'warm' }) { return { tone }; } }
export const INTENTS = {
  OVERDUE_RECALL: 'We would be happy to help arrange your next routine eye examination.',
  CL_REPLENISHMENT: 'Would you like help with your next contact lens replenishment? Our team can confirm the details with you.',
  INACTIVE_PATIENT: 'We would love to welcome you back. Let us know if you would like to arrange a visit.',
  MISSED_APPOINTMENT: 'We noticed a missed or cancelled appointment in our records. Would you like help arranging another time?',
  RECENT_PURCHASE: 'We are checking in after your recent purchase. How has your experience been so far?',
  UNCOLLECTED_ORDER: 'Our records show an order awaiting collection. Please contact our team to arrange a convenient time.',
};
export async function draftMessage(context, provider = new TemplateProvider(), tone = 'warm') {
  let plan = { tone }; let fallback = false;
  try {
    // No identifiers, contact details, prescriptions, free text, or patient history
    // are supplied to language providers. A deadline keeps core workflows usable.
    const result = await Promise.race([provider.plan({ type: context.opportunity.type, tone }), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Provider timeout')), 4000); timer.unref?.(); })]);
    if (['warm','concise','professional'].includes(result?.tone)) plan.tone = result.tone;
  } catch { fallback = true; }
  const firstName = context.patient.name?.trim().split(/\s+/)[0];
  const greeting = plan.tone === 'professional' ? 'Hello' : 'Hi';
  const intro = `${greeting}${firstName ? ` ${firstName}` : ''}, this is ${context.practice.name}.`;
  const intent = INTENTS[context.opportunity.type] || 'Please get in touch if you would like help from our team.';
  const close = plan.tone === 'concise' ? 'Reply to chat. Reply STOP to opt out.' : 'Just reply and our team will be happy to help. Reply STOP to opt out.';
  return { text: `${intro} ${intent} ${close}`, provider: 'verified-template', fallback, tone: plan.tone, requires_human_approval: true };
}
export function campaignTemplate(type, practiceName) { return `Hi {{first_name}}, this is ${practiceName}. ${INTENTS[type] || INTENTS.OVERDUE_RECALL} Just reply and our team will be happy to help. Reply STOP to opt out.`; }
export function renderTemplate(template, patient) { return template.replaceAll('{{first_name}}', patient.name.trim().split(/\s+/)[0]); }
export function explainOpportunity(opportunity) { const evidence = typeof opportunity.evidence === 'string' ? JSON.parse(opportunity.evidence) : opportunity.evidence; return { summary: `${TYPES[opportunity.type]?.action || opportunity.recommended_action}. This recommendation is based on the recorded ${evidence.map(e => e.field.replaceAll('_',' ')).join(', ')}.`, source: `Deterministic rule ${opportunity.rule_version}`, evidence }; }
export function answerQuestion(question, facts) {
  if (/diagnos|prescri|treat|disease|clinical/i.test(question)) return { answer: 'Clinical decisions need a qualified practitioner. I can help with practice revenue, outreach, data quality and recorded opportunities.', sources: [] };
  if (/revenue|sales|turnover|month/i.test(question)) {
    const current = facts.revenue?.[1], previous = facts.revenue?.[0];
    if (!current || !previous) return { answer: 'Revenue comparison is unavailable because there are not two complete months of transaction data.', sources: [] };
    const delta = previous.total ? ((current.total-previous.total)/previous.total*100) : null;
    return { answer: `${current.month} recorded ${money(current.total)} in paid transactions, compared with ${money(previous.total)} in ${previous.month}.${delta === null ? ' A percentage comparison is unavailable because the earlier month has no revenue.' : ` That is ${Math.abs(delta).toFixed(1)}% ${delta >= 0 ? 'higher' : 'lower'}.`} Transaction count changed from ${previous.count} to ${current.count}. Average transaction value was ${money(current.count ? current.total/current.count : 0)}. These are observations from recorded transactions; the data does not establish why sales changed.`, sources: [{ label:'Paid transactions · two complete calendar months', value:`${previous.month}: ${previous.count} / ${current.month}: ${current.count}` }], chart: facts.revenue };
  }
  if (/opportun|today|overdue|contact lens|priority|work|patient/i.test(question)) {
    const groups = facts.opportunities || []; const top = [...groups].sort((a,b) => b.count-a.count)[0];
    return { answer: top ? `Start with ${TYPES[top.type]?.label.toLowerCase()}: ${top.count} open opportunities. ${groups.map(x => `${TYPES[x.type]?.label}: ${x.count}`).join('; ')}. Review the evidence and consent status before approving outreach.` : 'There are no open opportunities yet. Import practice data and run the opportunity analysis.', sources: groups.map(g => ({ label:TYPES[g.type]?.label,value:`${g.count} open` })) };
  }
  if (/data|quality|import|consent/i.test(question)) return { answer: `There are ${facts.health?.patients || 0} patients in this practice. ${facts.health?.contactable || 0} have recorded marketing consent and a valid contact method. Missing or invalid contact details and absent consent prevent outreach.`, sources: [{ label:'Patients · current practice', value: String(facts.health?.patients || 0) }] };
  return { answer: 'That analysis is not available in this MVP. Supported questions cover revenue comparisons, today’s opportunities and data quality. I only use recorded practice data.', sources: [] };
}
