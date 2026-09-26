import { id, timestamp, transaction } from '../../database/db.mjs';
import { exclusionReason, daysSince } from './index.mjs';
import { renderTemplate } from '../ai/index.mjs';
import { DEFAULT_SETTINGS } from '../rules/index.mjs';
export function audiencePreview(store, { type, channel, opportunityIds }) {
  const patients = new Map(store.all('patients').map(p => [p.id,p]));
  const communications = store.all('communications');
  const cooldown = { ...DEFAULT_SETTINGS,...JSON.parse(store.practice().settings) }.contact_cooldown_days;
  const opportunities = store.all('opportunities',"status = 'new'").filter(o => (!type || o.type === type) && (!opportunityIds || opportunityIds.includes(o.id)));
  const seen = new Set(); const included = [], excluded = [];
  for (const opportunity of opportunities.sort((a,b) => b.score-a.score)) {
    const patient = patients.get(opportunity.patient_id); if (!patient || seen.has(patient.id)) continue; seen.add(patient.id);
    const recentlyContacted = communications.some(c => c.patient_id === patient.id && ((c.sent_at && daysSince(c.sent_at) < cooldown) || c.status === 'queued'));
    const reason = exclusionReason(patient,channel) || (recentlyContacted ? 'Recently contacted or already queued' : null);
    const item = { patient_id:patient.id,name:patient.name,opportunity_id:opportunity.id,score:opportunity.score,reason };
    (reason ? excluded : included).push(item);
  }
  return { included,excluded,total:included.length+excluded.length };
}
export function createCampaign(store, input, userId) {
  const preview = audiencePreview(store,input);
  if (!preview.included.length) throw Object.assign(Error('No eligible patients. Review consent, contact details and recent outreach.'),{status:400});
  const campaignId = id('campaign');
  store.insert('campaigns',{id:campaignId,name:input.name,type:input.type,channel:input.channel,template:input.template,status:'draft',created_at:timestamp()});
  for (const member of preview.included) {
    const patient = store.get('patients',member.patient_id);
    store.insert('communications',{id:id('msg'),campaign_id:campaignId,patient_id:patient.id,opportunity_id:member.opportunity_id,channel:input.channel,body:renderTemplate(input.template,patient),status:'draft'});
  }
  store.audit('campaign.created',campaignId,userId,{recipients:preview.included.length,excluded:preview.excluded.length});
  return store.get('campaigns',campaignId);
}
export function approveCampaign(store,campaignId,userId) {
  const campaign = store.get('campaigns',campaignId);
  if (!campaign) throw Object.assign(Error('Campaign not found'),{status:404});
  if (campaign.status !== 'draft') throw Object.assign(Error('Only a draft campaign can be approved.'),{status:409});
  const messages = store.all('communications','campaign_id = ?',[campaignId]);
  let queued = 0;
  for (const message of messages) {
    const patient = store.get('patients',message.patient_id);
    const otherQueued = store.all('communications',"patient_id = ? AND campaign_id != ? AND status = 'queued'",[patient.id,campaignId]).length;
    const cooldown = { ...DEFAULT_SETTINGS,...JSON.parse(store.practice().settings) }.contact_cooldown_days;
    const recent = store.all('communications',"patient_id = ? AND sent_at IS NOT NULL",[patient.id]).some(c => daysSince(c.sent_at) < cooldown);
    const reason = exclusionReason(patient,campaign.channel) || (otherQueued || recent ? 'Recently contacted or already queued' : null);
    store.update('communications',message.id,{status:reason ? 'excluded' : 'queued',exclusion_reason:reason});
    if (!reason) { queued++; if (message.opportunity_id) store.update('opportunities',message.opportunity_id,{status:'queued'}); }
  }
  if (!queued) throw Object.assign(Error('No eligible recipients remain. Consent and recent outreach were checked again.'),{status:400});
  store.update('campaigns',campaignId,{status:'approved',approved_at:timestamp(),approved_by:userId});
  store.audit('campaign.approved',campaignId,userId,{queued});
  return {queued};
}
export class MockCommunicationProvider {
  send(message) { return { id:`mock_${message.id}`,status:'delivered' }; }
}
export function sendCampaign(store,campaignId,userId,provider = new MockCommunicationProvider()) {
  const campaign = store.get('campaigns',campaignId);
  if (!campaign) throw Object.assign(Error('Campaign not found'),{status:404});
  if (!campaign.approved_at || !campaign.approved_by || campaign.status !== 'approved') throw Object.assign(Error('A staff approval is required before sending.'),{status:409});
  let delivered = 0;
  for (const message of store.all('communications',"campaign_id = ? AND status = 'queued'",[campaignId])) {
    const reason = exclusionReason(store.get('patients',message.patient_id),message.channel);
    if (reason) { store.update('communications',message.id,{status:'excluded',exclusion_reason:reason}); if (message.opportunity_id) store.update('opportunities',message.opportunity_id,{status:'new'}); continue; }
    try {
      const receipt = provider.send(message); const sentAt = timestamp();
      store.update('communications',message.id,{status:'delivered',provider_id:receipt.id,sent_at:sentAt});
      store.insert('events',{id:id('evt'),communication_id:message.id,type:'delivered',created_at:sentAt,metadata:JSON.stringify({provider:'mock'})});
      if (message.opportunity_id) store.update('opportunities',message.opportunity_id,{status:'completed'});
      delivered++;
    } catch { store.update('communications',message.id,{status:'failed'}); if (message.opportunity_id) store.update('opportunities',message.opportunity_id,{status:'new'}); }
  }
  store.update('campaigns',campaignId,{status:'completed'}); store.audit('campaign.mock_sent',campaignId,userId,{delivered});
  return {delivered,provider:'mock'};
}
export function campaignMetrics(store) {
  return store.db.prepare(`SELECT c.*,
    (SELECT COUNT(*) FROM communications m WHERE m.tenant_id=c.tenant_id AND m.campaign_id=c.id) AS recipients,
    (SELECT COUNT(*) FROM communications m WHERE m.tenant_id=c.tenant_id AND m.campaign_id=c.id AND m.status='delivered') AS delivered,
    (SELECT COUNT(*) FROM events e JOIN communications m ON m.tenant_id=e.tenant_id AND m.id=e.communication_id WHERE m.tenant_id=c.tenant_id AND m.campaign_id=c.id AND e.type='reply') AS replies,
    (SELECT COUNT(*) FROM events e JOIN communications m ON m.tenant_id=e.tenant_id AND m.id=e.communication_id WHERE m.tenant_id=c.tenant_id AND m.campaign_id=c.id AND e.type='appointment') AS appointments,
    (SELECT COUNT(*) FROM events e JOIN communications m ON m.tenant_id=e.tenant_id AND m.id=e.communication_id WHERE m.tenant_id=c.tenant_id AND m.campaign_id=c.id AND e.type='purchase') AS purchases,
    (SELECT COALESCE(SUM(t.total),0) FROM events e JOIN communications m ON m.tenant_id=e.tenant_id AND m.id=e.communication_id JOIN transactions t ON t.tenant_id=e.tenant_id AND t.id=e.transaction_id WHERE m.tenant_id=c.tenant_id AND m.campaign_id=c.id AND e.type='purchase' AND t.status='paid') AS revenue
    FROM campaigns c WHERE c.tenant_id=? ORDER BY c.created_at DESC`).all(store.tenantId);
}
export function recordOutcome(store,communicationId,type,transactionId,userId) {
  const message = store.get('communications',communicationId);
  if (!message || message.status !== 'delivered') throw Object.assign(Error('Outcomes require a delivered communication.'),{status:400});
  if (store.all('events','communication_id = ? AND type = ?',[communicationId,type]).length) throw Object.assign(Error('This outcome is already recorded.'),{status:409});
  if (type === 'purchase') {
    const purchase = store.get('transactions',transactionId);
    const days = purchase ? (Date.parse(purchase.date)-Date.parse(message.sent_at.slice(0,10)))/86400000 : -1;
    if (!purchase || purchase.patient_id !== message.patient_id || purchase.status !== 'paid' || days < 0 || days > 30) throw Object.assign(Error('Choose a paid transaction for this patient within 30 days after outreach.'),{status:400});
    if (store.all('events','transaction_id = ?',[transactionId]).length) throw Object.assign(Error('This transaction is already attributed to a campaign.'),{status:409});
  }
  store.insert('events',{id:id('evt'),communication_id:communicationId,type,transaction_id:type === 'purchase' ? transactionId : null,created_at:timestamp(),metadata:JSON.stringify({source:'staff-recorded'})});
  store.audit(`outcome.${type}`,communicationId,userId,{transaction_id:transactionId || null});
}
