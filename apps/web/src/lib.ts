export type Patient={id:string;source_id:string;name:string;phone:string|null;email:string|null;marketing_consent:number;outlet:string;last_exam:string|null;last_purchase:string|null;lifetime_value:number;status:string};
export type Opportunity={id:string;type:string;score:number;confidence:number;estimated_value:number;status:string;patient:Patient;recommended_action:string;calculated_at:string;rule_version:string;components:Record<string,number>;evidence:{field:string;value:string|number;source_id:string;import_id?:string}[];transactions?:{id:string;date:string;total:number;category:string}[]};
export type Campaign={id:string;name:string;type:string;channel:string;status:string;created_at:string;template:string;recipients:number;delivered:number;replies:number;appointments:number;purchases:number;revenue:number;messages?:Message[]};
export type Message={id:string;body:string;status:string;patient:Patient;sent_at:string|null;exclusion_reason?:string;events:{type:string}[];transactions:{id:string;date:string;total:number;category:string}[]};
export type Dashboard={open:number;highPriority:number;potentialRevenue:number;opportunities:{type:string;count:number;value:number}[];health:{patients:number;transactions:number;contactable:number;missingContact:number;noConsent:number;quality:number;lastImport:string|null};campaigns:Campaign[];totals:{recipients:number;delivered:number;replies:number;appointments:number;purchases:number;revenue:number};trend:{date:string;revenue:number;purchases:number}[];revenue:{month:string;total:number;count:number}[]};
export type Session={user:{id:string;name:string;email:string;role:string};practice:{id:string;name:string;timezone:string;settings:Record<string,number>};demo:boolean;provider:string};
export const TYPES:Record<string,{label:string;short:string;color:string;description:string}>={
  OVERDUE_RECALL:{label:'Overdue recall',short:'Recall',color:'blue',description:'A timely invitation for their next eye examination.'},
  CL_REPLENISHMENT:{label:'Contact lens replenishment',short:'Contact lenses',color:'green',description:'Help patients stay on top of their lens supply.'},
  INACTIVE_PATIENT:{label:'Valuable patient re-engagement',short:'Re-engagement',color:'purple',description:'Reconnect with patients you haven’t seen in a while.'},
  MISSED_APPOINTMENT:{label:'Missed appointment',short:'Rebooking',color:'amber',description:'Make it easy to find another convenient time.'},
  RECENT_PURCHASE:{label:'Recent purchase follow-up',short:'Follow-up',color:'pink',description:'A thoughtful check-in after a recent purchase.'},
  UNCOLLECTED_ORDER:{label:'Uncollected order',short:'Collection',color:'orange',description:'Help patients collect the order waiting for them.'},
};
export const money=(cents:number,decimals=0)=>new Intl.NumberFormat('en-SG',{style:'currency',currency:'SGD',maximumFractionDigits:decimals,minimumFractionDigits:decimals}).format((cents||0)/100);
export const number=(value:number)=>new Intl.NumberFormat('en-SG').format(value||0);
export const date=(value:string|null|undefined,short=false)=>value?new Intl.DateTimeFormat('en-SG',{day:'numeric',month:short?'short':'long',...(short?{}:{year:'numeric'}),timeZone:'Asia/Singapore'}).format(new Date(value.length===10?value+'T00:00:00Z':value)):'Not recorded';
export const initials=(name:string)=>name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('');
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
  const isForm=options.body instanceof FormData;
  const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'X-Requested-With':'OpticalOperator',...(!isForm&&options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const payload=await response.json();
  if(!response.ok){if(response.status===401&&!path.startsWith('/auth'))window.dispatchEvent(new Event('session-expired'));throw new Error(payload.error||'Something went wrong. Please try again.');}
  return payload as T;
}
export const post=<T=any>(path:string,body:unknown={})=>api<T>(path,{method:'POST',body:JSON.stringify(body)});
