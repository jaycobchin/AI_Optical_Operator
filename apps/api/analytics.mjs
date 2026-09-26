import { campaignMetrics } from '../../packages/domain/campaigns.mjs';
import { phoneValid,emailValid,practiceDate } from '../../packages/domain/index.mjs';
export function analytics(store) {
  const patients=store.all('patients'); const opportunities=store.all('opportunities',"status = 'new'"); const campaigns=campaignMetrics(store);
  const groups=Object.entries(Object.groupBy(opportunities,o=>o.type)).map(([type,items])=>({type,count:items.length,value:items.reduce((n,o)=>n+o.estimated_value,0)}));
  const contactable=patients.filter(p=>p.status==='active'&&p.marketing_consent&&(phoneValid(p.phone)||emailValid(p.email))).length;
  const date=practiceDate(); const start=new Date(date.slice(0,7)+'-01T00:00:00Z'); const previous=new Date(start);previous.setUTCMonth(previous.getUTCMonth()-1);const before=new Date(start);before.setUTCMonth(before.getUTCMonth()-2);
  const revenue=[before,previous].map(d=>{const month=d.toISOString().slice(0,7);const row=store.db.prepare("SELECT COALESCE(SUM(total),0) total,COUNT(*) count FROM transactions WHERE tenant_id=? AND status='paid' AND substr(date,1,7)=?").get(store.tenantId,month);return {month,...row};});
  const trend=[];for(let i=13;i>=0;i--){const day=new Date(Date.parse(date)-i*86400000).toISOString().slice(0,10);const row=store.db.prepare("SELECT COALESCE(SUM(t.total),0) revenue,COUNT(*) purchases FROM events e JOIN transactions t ON t.tenant_id=e.tenant_id AND t.id=e.transaction_id WHERE e.tenant_id=? AND e.type='purchase' AND t.status='paid' AND substr(t.date,1,10)=?").get(store.tenantId,day);trend.push({date:day,...row});}
  // A patient may have more than one opportunity. The estimate counts each patient once.
  const values=new Map();for(const o of opportunities)values.set(o.patient_id,Math.max(values.get(o.patient_id)||0,o.estimated_value));
  const totals=campaigns.reduce((a,c)=>{for(const key of ['recipients','delivered','replies','appointments','purchases','revenue'])a[key]+=c[key];return a;},{recipients:0,delivered:0,replies:0,appointments:0,purchases:0,revenue:0});
  const imports=store.all('imports').sort((a,b)=>b.created_at.localeCompare(a.created_at));
  return {opportunities:groups,open:opportunities.length,highPriority:opportunities.filter(o=>o.score>=75).length,potentialRevenue:[...values.values()].reduce((a,b)=>a+b,0),health:{patients:patients.length,transactions:store.all('transactions').length,contactable,missingContact:patients.filter(p=>!phoneValid(p.phone)&&!emailValid(p.email)).length,noConsent:patients.filter(p=>!p.marketing_consent).length,quality:patients.length?Math.round(contactable/patients.length*100):0,lastImport:imports[0]?.committed_at||null},campaigns,totals,trend,revenue};
}
