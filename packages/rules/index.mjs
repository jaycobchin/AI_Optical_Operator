import { TYPES, daysSince, phoneValid, emailValid } from '../domain/index.mjs';
import { id, patientFacts, timestamp } from '../../database/db.mjs';
export const DEFAULT_SETTINGS = { recall_days: 365, inactive_days: 540, valuable_threshold: 60000, followup_min_days: 7, followup_max_days: 21, collection_days: 14, contact_cooldown_days: 14 };
export function evaluatePatient(p, settings = DEFAULT_SETTINGS, now = new Date()) {
  if (p.status !== 'active') return [];
  const s = { ...DEFAULT_SETTINGS, ...settings }; const found = [];
  const examGap = daysSince(p.last_exam, now), purchaseGap = daysSince(p.last_purchase, now), clGap = daysSince(p.last_cl_purchase, now), missedGap = daysSince(p.missed_date, now), orderGap = daysSince(p.order_date, now);
  const add = (type, gap, threshold, evidence) => {
    const components = {
      urgency: Math.min(30, Math.round(15 + Math.max(0, gap-threshold)/30)),
      recency_gap: Math.min(25, Math.round(10 + Math.max(0, gap-threshold)/45)),
      historical_value: Math.min(20, Math.round((p.lifetime_value || 0)/10000)),
      actionability: p.marketing_consent && (phoneValid(p.phone) || emailValid(p.email)) ? 20 : 0,
      response_likelihood: 5,
    };
    found.push({ type, score: Object.values(components).reduce((a,b) => a+b,0), components, confidence: p.source_id ? 0.95 : 0.75, estimated_value: p.last_total || 0,
      evidence: evidence.map(([field,value]) => ({ field, value, source_id: p.source_id, patient_id: p.id, import_id: p.import_id || null })),
      recommended_action: TYPES[type].action, rule_version: '1.0.0', requires_human_approval: true });
  };
  if (examGap !== null && examGap > s.recall_days && !(p.rebooked_date && p.rebooked_date > now.toISOString().slice(0,10))) add('OVERDUE_RECALL',examGap,s.recall_days,[['last_exam',p.last_exam],['days_since_exam',examGap],['threshold_days',s.recall_days]]);
  if (clGap !== null && p.cl_interval > 0 && clGap >= p.cl_interval) add('CL_REPLENISHMENT',clGap,p.cl_interval,[['last_cl_purchase',p.last_cl_purchase],['replacement_interval_days',p.cl_interval],['days_since_purchase',clGap]]);
  if (purchaseGap !== null && purchaseGap > s.inactive_days && p.lifetime_value >= s.valuable_threshold) add('INACTIVE_PATIENT',purchaseGap,s.inactive_days,[['last_purchase',p.last_purchase],['lifetime_value_cents',p.lifetime_value],['inactive_days',purchaseGap]]);
  if (missedGap !== null && missedGap >= 0 && missedGap <= 90 && (!p.rebooked_date || p.rebooked_date < p.missed_date)) add('MISSED_APPOINTMENT',missedGap,1,[['missed_appointment_date',p.missed_date],['rebooking','No later booking recorded']]);
  if (purchaseGap !== null && purchaseGap >= s.followup_min_days && purchaseGap <= s.followup_max_days) add('RECENT_PURCHASE',purchaseGap,s.followup_min_days,[['last_purchase',p.last_purchase],['followup_window',`${s.followup_min_days}–${s.followup_max_days} days`]]);
  if (orderGap !== null && p.order_status === 'ready' && orderGap >= s.collection_days) add('UNCOLLECTED_ORDER',orderGap,s.collection_days,[['order_ready_date',p.order_date],['order_status','ready'],['days_waiting',orderGap]]);
  return found;
}
export function analyse(store, now = new Date()) {
  const settings = { ...DEFAULT_SETTINGS, ...JSON.parse(store.practice().settings) }; let count = 0;
  const existing = store.all('opportunities'); const seen = new Set();
  const byKey = new Map(existing.map(o => [`${o.patient_id}:${o.type}`,o]));
  for (const patient of patientFacts(store)) {
    for (const o of evaluatePatient(patient, settings, now)) {
      const key = `${patient.id}:${o.type}`; seen.add(key); count++;
      const old = byKey.get(key);
      const record = { score:o.score,confidence:o.confidence,estimated_value:o.estimated_value,components:JSON.stringify(o.components),evidence:JSON.stringify(o.evidence),recommended_action:o.recommended_action,rule_version:o.rule_version,calculated_at:now.toISOString() };
      if (old) { if (old.status === 'resolved' || (old.status === 'snoozed' && old.snoozed_until <= now.toISOString())) record.status = 'new'; store.update('opportunities',old.id,record); }
      else store.insert('opportunities',{id:id('opp'),patient_id:patient.id,type:o.type,status:'new',...record});
    }
  }
  for (const old of existing) if (!seen.has(`${old.patient_id}:${old.type}`) && ['new','snoozed'].includes(old.status)) store.update('opportunities',old.id,{status:'resolved',calculated_at:timestamp()});
  return count;
}
