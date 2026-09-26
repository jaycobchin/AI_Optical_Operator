import { id,tenantStore,passwordHash,timestamp,transaction } from '../db.mjs';
import { analyse } from '../../packages/rules/index.mjs';
import { campaignTemplate,renderTemplate } from '../../packages/ai/index.mjs';
import { practiceDate } from '../../packages/domain/index.mjs';
const firstNames=['Aisha','Daniel','Mei Ling','Arjun','Sarah','Wei Jie','Priya','Jonathan','Nur','Marcus','Hui Min','Rachel','Hafiz','Evelyn','Joshua','Chloe','Ravi','Grace','Ethan','Siti'];
const lastNames=['Tan','Lim','Lee','Wong','Chen','Ng','Koh','Goh','Ong','Chua','Teo','Yeo','Low','Toh','Foo','Seah','Sim','Tay','Ho','Lau','Ang','Phua','Soh','Cheng','Gwee','Seng','Quek','Han','Pang','Liew','Chew','Wee','Kwek','Fong','Chong','Chin','Chia','Yap','Soo','Peh','Lam','Leong','Khoo','Yong','Tham','Tong','Heng','Kang','Loh','Chow'];
const dateAgo=days=>new Date(Date.parse(practiceDate())-days*86400000).toISOString().slice(0,10);
export function seedDemo(db) {
  if(db.prepare('SELECT id FROM practices WHERE id=?').get('demo-practice')) return;
  transaction(db,()=> {
    db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run('demo-practice','Clarity Optical',timestamp());
    db.prepare('INSERT INTO practices(id,name,created_at) VALUES(?,?,?)').run('second-practice','Harbour Eyecare',timestamp());
    const store=tenantStore(db,'demo-practice'),other=tenantStore(db,'second-practice');
    for(const [s,email,name,role] of [[store,'owner@demo.optical','Jay Tan','owner'],[store,'staff@demo.optical','Rachel Lim','staff'],[other,'owner@harbour.optical','Harbour Owner','owner']]) s.insert('users',{id:id('user'),email,name,role,password_hash:passwordHash('OpticalDemo2026!'),created_at:timestamp()});
    const owner=store.all('users',"role = 'owner'")[0];
    store.insert('outlets',{id:'outlet-orchard',name:'Orchard'}); store.insert('outlets',{id:'outlet-tampines',name:'Tampines'});
    const importId='demo-import'; store.insert('imports',{id:importId,filename:'synthetic_practice_export.csv',status:'completed',record_count:1000,report:JSON.stringify({imported:1000,updated:0,skipped:0,invalid:0,duplicates:8,warnings:60,entity:'patients',synthetic:true}),mapping:JSON.stringify({version:1,source:'synthetic-seed'}),created_at:timestamp(),committed_at:timestamp()});
    for(const [i,category,price] of [[1,'Eyewear',28000],[2,'Contact lenses',15000],[3,'Eye examination',6500]]) store.insert('products',{id:`product-${i}`,sku:`SYN-${i}`,name:`Demo ${category}`,category,price});
    for(let i=0;i<1000;i++) {
      const patientId=`demo-p-${i}`; const group=i%10; const inactive=group===3; const lastPurchase=inactive?580+i%90:group===4?7+i%14:group===1?100+i%100:25+i%300;
      const examAgo=group===0?440+i%400:group===1?180+i%130:group===2?90:inactive?650:30+i%330;
      const phone=i%41===0?'invalid':i%43===0?null:`+658${String(1000000+Math.floor(i/2)).padStart(7,'0')}`;
      const name=i===997?'Aisha Tan':`${firstNames[i%20]} ${lastNames[Math.floor(i/20)%50]}`;
      store.insert('patients',{id:patientId,source_id:`POS-${String(i+1).padStart(5,'0')}`,name,dob:i%7===0?null:`${1960+i%45}-${String(i%12+1).padStart(2,'0')}-15`,phone,email:i%11===0?null:`patient${i+1}@example.test`,marketing_consent:i%7===0?0:1,status:i===998?'inactive':i===999?'deceased':'active',outlet:i%3===0?'Tampines':'Orchard',cl_interval:group===1?90:null,import_id:importId,created_at:timestamp()});
      store.insert('visits',{id:`demo-v-${i}`,patient_id:patientId,date:dateAgo(examAgo),type:'eye examination',source_id:`VISIT-${i}`});
      store.insert('prescriptions',{id:`demo-rx-${i}`,patient_id:patientId,date:dateAgo(examAgo),modality:group===1?'contact lens':'spectacles',metadata:JSON.stringify({synthetic:true,clinical_fields_omitted:true})});
      if(group===1) store.insert('contact_lens_rx',{id:`demo-cl-${i}`,patient_id:patientId,date:dateAgo(examAgo),replacement_interval:90,product:'Synthetic contact lens'});
      for(let j=0;j<3;j++) {
        const category=group===1?'Contact lenses':j===2?'Eye examination':'Eyewear'; const total=inactive?32000+i%5*12000:category==='Contact lenses'?12000+i%7*1500:category==='Eye examination'?6500:18000+i%11*2200;
        const txId=`demo-t-${i}-${j}`;
        store.insert('transactions',{id:txId,patient_id:patientId,date:dateAgo(lastPurchase+(i%53===0?0:j*120)),total,category,status:'paid',source_id:`TX-${i}-${j}`});
        store.insert('transaction_lines',{id:`demo-line-${i}-${j}`,transaction_id:txId,product_id:category==='Contact lenses'?'product-2':category==='Eye examination'?'product-3':'product-1',category,quantity:1,unit_price:total});
      }
      if(group===2) store.insert('appointments',{id:`demo-ap-${i}`,patient_id:patientId,date:dateAgo(3+i%25),status:i%4===0?'cancelled':'no-show',source_id:`AP-${i}`});
      if(group===2&&i%3===0) store.insert('appointments',{id:`demo-rebook-${i}`,patient_id:patientId,date:dateAgo(-7),status:'scheduled',source_id:`AP-R-${i}`});
      if(group===5) store.insert('orders',{id:`demo-order-${i}`,patient_id:patientId,date:dateAgo(16+i%30),status:'ready',source_id:`ORDER-${i}`});
    }
    other.insert('patients',{id:'harbour-private-patient',source_id:'PRIVATE-001',name:'Harbour Private Patient',phone:'+6588880000',marketing_consent:1,created_at:timestamp()});
    other.insert('visits',{id:'harbour-visit',patient_id:'harbour-private-patient',date:dateAgo(600),type:'eye examination',source_id:'HARBOUR-VISIT'});
    analyse(store); analyse(other);
    for(const [c,name,type,size] of [[0,'A little care after your purchase','RECENT_PURCHASE',48],[1,'Time for a fresh perspective','OVERDUE_RECALL',28],[2,'Your next pair of contact lenses','CL_REPLENISHMENT',20]]) {
      const campaignId=`demo-campaign-${c}`,created=dateAgo(40+c*12)+'T02:00:00.000Z'; const template=campaignTemplate(type,'Clarity Optical');
      store.insert('campaigns',{id:campaignId,name,type,channel:c===1?'email':'whatsapp',template,status:'completed',created_at:created,approved_at:created,approved_by:owner.id});
      for(let n=0;n<size;n++) {
        const i=4+10*(n+[0,48,76][c]); const patient=store.get('patients',`demo-p-${i}`); const tx=store.get('transactions',`demo-t-${i}-0`); const sentAt=new Date(Date.parse(tx.date)-3*86400000).toISOString(); const msgId=`demo-msg-${c}-${n}`;
        store.insert('communications',{id:msgId,campaign_id:campaignId,patient_id:patient.id,channel:c===1?'email':'whatsapp',body:renderTemplate(template,patient),status:'delivered',sent_at:sentAt,provider_id:`mock_seed_${msgId}`});
        for(const event of ['delivered',...(n%3===0?['reply']:[]),...(n%5===0?['appointment']:[]),...(n%6===0?['purchase']:[])]) store.insert('events',{id:id('event'),communication_id:msgId,type:event,transaction_id:event==='purchase'?tx.id:null,created_at:event==='purchase'?tx.date+'T04:00:00.000Z':sentAt,metadata:JSON.stringify({synthetic:true,provider:'mock'})});
      }
      store.audit('campaign.demo_seeded',campaignId,owner.id,{synthetic:true});
    }
    store.audit('demo.seeded',importId,owner.id,{patients:1000,transactions:3000,synthetic:true});
  });
}
