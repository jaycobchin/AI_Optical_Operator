import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { id,timestamp,transaction } from '../../database/db.mjs';
import { phoneValid,emailValid,practiceDate } from '../../packages/domain/index.mjs';
import { analyse } from '../../packages/rules/index.mjs';
import { OpticalConnector } from '../base.mjs';
const F = (key,label,aliases=[],required=false) => ({key,label,aliases:[key,label,...aliases].map(x=>x.toLowerCase().replace(/[^a-z0-9]/g,'')),required});
export const FIELDS = {
  patients:[F('source_id','Patient ID',['id','patientid','customerid'],true),F('name','Full name',['patientname','customername','name'],true),F('phone','Phone',['mobile','telephone','contactnumber']),F('email','Email'),F('dob','Date of birth',['birthday','birthdate']),F('marketing_consent','Marketing consent',['consent','optin']),F('last_exam','Last exam',['lastexamdate','lastvisit','lastvisitdate']),F('last_purchase','Last purchase',['lastpurchasedate']),F('total','Last purchase total',['amount','total']),F('category','Purchase category',['category']),F('cl_interval','Contact lens interval (days)',['clinterval','replacementinterval']),F('outlet','Outlet',['branch','location']),F('status','Patient status',['status'])],
  transactions:[F('source_id','Transaction ID',['id','receiptid'],true),F('patient_source_id','Patient ID',['patientid','customerid'],true),F('date','Date',['transactiondate','purchasedate'],true),F('total','Total',['amount','revenue'],true),F('category','Category',['productcategory']),F('status','Status')],
  appointments:[F('source_id','Appointment ID',['id'],true),F('patient_source_id','Patient ID',['patientid','customerid'],true),F('date','Date',['appointmentdate'],true),F('status','Status',[],true),F('type','Type')],
  visits:[F('source_id','Visit ID',['id'],true),F('patient_source_id','Patient ID',['patientid','customerid'],true),F('date','Date',['visitdate','examdate'],true),F('type','Type')],
  orders:[F('source_id','Order ID',['id'],true),F('patient_source_id','Patient ID',['patientid','customerid'],true),F('date','Ready date',['date','orderdate'],true),F('status','Status',[],true)],
};
function assertXlsxSize(buffer) {
  // Read ZIP central-directory metadata before decompression to reject zip bombs.
  let total=0,entries=0;
  for(let i=0;i<buffer.length-46;i++) if(buffer.readUInt32LE(i)===0x02014b50) { total+=buffer.readUInt32LE(i+24); entries++; i+=45+buffer.readUInt16LE(i+28)+buffer.readUInt16LE(i+30)+buffer.readUInt16LE(i+32); }
  if(!entries || total>30*1024*1024 || entries>1000) throw Error('Workbook is too large or is not a supported XLSX file. Export a smaller CSV.');
}
export async function inspectFile(buffer,filename,entity='patients') {
  if(!FIELDS[entity]) throw Error('Unsupported import entity.');
  if(buffer.length>5*1024*1024) throw Error('Files must be smaller than 5 MB.');
  let matrix;
  if(/\.csv$/i.test(filename)) matrix=parse(buffer,{bom:true,skip_empty_lines:true,relax_column_count:false,max_record_size:20000,trim:true});
  else if(/\.xlsx$/i.test(filename)) {
    assertXlsxSize(buffer); const workbook=new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
    const sheet=workbook.worksheets[0]; if(!sheet || sheet.rowCount>10001 || sheet.columnCount>60) throw Error('Use the first worksheet with at most 10,000 rows and 60 columns.');
    matrix=[]; sheet.eachRow(row=> { const values=[]; for(let col=1;col<=sheet.columnCount;col++) { const value=row.getCell(col).value; if(value && typeof value==='object' && !(value instanceof Date)) throw Error('Formula, rich-text and linked cells are not supported. Export values as CSV.'); values.push(value instanceof Date?value.toISOString().slice(0,10):String(value??'')); } matrix.push(values); });
  } else throw Error('Choose a CSV or XLSX file.');
  if(matrix.length<2 || matrix.length>10001) throw Error('Include a header and between 1 and 10,000 data rows.');
  const headers=matrix[0].map(x=>String(x).trim());
  if(headers.length>60 || headers.some(h=>!h || h.length>120 || ['__proto__','constructor','prototype'].includes(h))) throw Error('Use at most 60 named columns with simple headers.');
  if(new Set(headers.map(h=>h.toLowerCase())).size!==headers.length) throw Error('Duplicate column headers must be renamed.');
  const rows=matrix.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'').slice(0,2000)])));
  const mapping={},confidence={};
  for(const field of FIELDS[entity]) { const match=headers.find(h=>field.aliases.includes(h.toLowerCase().replace(/[^a-z0-9]/g,''))); if(match) { mapping[field.key]=match; confidence[field.key]=1; } }
  return {filename,entity,headers,rows,mapping,confidence};
}
function validDate(value) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date=new Date(value+'T00:00:00Z'); return !isNaN(date) && date.toISOString().slice(0,10)===value; }
function normalPhone(value) { const digits=value.replace(/[\s()\-]/g,''); return /^[89]\d{7}$/.test(digits)?`+65${digits}`:digits; }
export function validateImport(store,rows,mapping,entity='patients') {
  const fields=FIELDS[entity]; if(!fields) throw Error('Unsupported import entity.');
  const missing=fields.filter(f=>f.required&&!mapping[f.key]); if(missing.length) throw Error(`Map required fields: ${missing.map(f=>f.label).join(', ')}.`);
  const mapped=Object.values(mapping).filter(Boolean); if(new Set(mapped).size!==mapped.length) throw Error('Each source column can only map to one field.');
  const patients=store.all('patients'),patientBySource=new Map(patients.map(p=>[p.source_id,p]));
  const existing=entity==='patients'?patients:store.all(entity); const existingSources=new Set(existing.map(x=>x.source_id));
  const sources=new Set(); const identities=[...patients];
  const results=rows.map((row,index)=> {
    const data={}; for(const field of fields) if(mapping[field.key]) data[field.key]=String(row[mapping[field.key]]??'').trim();
    const errors=[],warnings=[]; let duplicate=false;
    for(const field of fields.filter(f=>f.required)) if(!data[field.key]) errors.push(`${field.label} is required`);
    if(data.source_id?.length>100) errors.push('Source ID must be 100 characters or fewer');
    if(sources.has(data.source_id)) errors.push('Repeated source ID in this file'); sources.add(data.source_id);
    for(const key of ['dob','last_exam','last_purchase','date']) if(data[key]) {
      if(!validDate(data[key])) errors.push(`${key}: use a valid YYYY-MM-DD date`);
      else if((key!=='date'||entity!=='appointments')&&data[key]>practiceDate()) errors.push(`${key}: future dates are not allowed`);
    }
    if(data.phone) { data.phone=normalPhone(data.phone); if(!phoneValid(data.phone)) warnings.push('Invalid phone; phone outreach will be excluded'); }
    if(data.email && !emailValid(data.email)) warnings.push('Invalid email; email outreach will be excluded');
    if(entity==='patients') {
      if(data.name?.length>160) errors.push('Name must be 160 characters or fewer');
      if(Object.hasOwn(data,'marketing_consent')) { if(data.marketing_consent&&!/^(yes|no|true|false|1|0)$/i.test(data.marketing_consent)) errors.push('Consent must be yes/no, true/false or 1/0'); data.marketing_consent=/^(yes|true|1)$/i.test(data.marketing_consent)?1:0; }
      if(!data.phone&&!data.email) warnings.push('No contact details in this row');
      if(data.status&&!['active','inactive','deceased'].includes(data.status)) errors.push('Patient status must be active, inactive or deceased');
      if(data.cl_interval && (!/^\d+$/.test(data.cl_interval)||Number(data.cl_interval)<1||Number(data.cl_interval)>730)) errors.push('Replacement interval must be between 1 and 730 days');
      if(!existingSources.has(data.source_id)) duplicate=identities.some(p=>(data.phone&&p.phone===data.phone)||(data.email&&p.email?.toLowerCase()===data.email.toLowerCase())||(p.name?.toLowerCase()===data.name?.toLowerCase()));
      if(duplicate) warnings.push('Possible duplicate or shared family contact; keep separate only after review');
      identities.push(data);
      if(Boolean(data.last_purchase)!==Boolean(data.total)) errors.push('Last purchase date and total must be provided together');
    } else {
      if(!patientBySource.has(data.patient_source_id)) errors.push('Patient ID is not in this practice; import patients first');
      data.patient_id=patientBySource.get(data.patient_source_id)?.id;
    }
    if(data.total!==undefined && data.total!=='') { if(!/^\d+(\.\d{1,2})?$/.test(data.total)||Number(data.total)>1000000) errors.push('Total must be an amount from 0 to 1,000,000 with at most 2 decimals'); else data.total=Math.round(Number(data.total)*100); }
    if(entity==='transactions'&&data.status&&!['paid','refunded','void'].includes(data.status)) errors.push('Transaction status must be paid, refunded or void');
    if(entity==='appointments'&&!['scheduled','completed','no-show','cancelled'].includes(data.status)) errors.push('Appointment status must be scheduled, completed, no-show or cancelled');
    if(entity==='orders'&&!['ready','collected','cancelled'].includes(data.status)) errors.push('Order status must be ready, collected or cancelled');
    return {row:index+2,data,errors,warnings,duplicate,update:existingSources.has(data.source_id)};
  });
  return {total:rows.length,valid:results.filter(r=>!r.errors.length).length,invalid:results.filter(r=>r.errors.length).length,duplicates:results.filter(r=>r.duplicate&&!r.errors.length).length,updates:results.filter(r=>r.update&&!r.errors.length).length,warnings:results.filter(r=>r.warnings.length).length,rows:results,unmapped:rows[0]?Object.keys(rows[0]).filter(k=>!mapped.includes(k)):[]};
}
export function commitImport(store,file,userId,includeDuplicates=false) {
  return transaction(store.db,()=> {
    // Validate again inside the write transaction; never trust a client preview.
    const report=validateImport(store,file.rows,file.mapping,file.entity); const importId=id('import'); let imported=0,updated=0;
    store.insert('imports',{id:importId,filename:file.filename,status:'completed',record_count:report.total,report:'{}',mapping:JSON.stringify({entity:file.entity,columns:file.mapping,version:1,connector:'generic-csv'}),created_at:timestamp(),committed_at:timestamp()});
    for(const row of report.rows) {
      if(row.errors.length || (row.duplicate&&!includeDuplicates)) continue;
      const d=row.data;
      if(file.entity==='patients') {
        const previous=store.all('patients','source_id = ?',[d.source_id])[0]; const patientId=previous?.id||id('patient');
        const record={name:d.name,source_id:d.source_id,import_id:importId};
        for(const key of ['phone','email','dob','marketing_consent','status','outlet','cl_interval']) if(Object.hasOwn(d,key)) record[key]=d[key]===''?(['status','outlet'].includes(key)?(key==='status'?'active':'Main practice'):null):d[key];
        if(previous) {store.update('patients',patientId,record); updated++;} else {store.insert('patients',{id:patientId,created_at:timestamp(),...record}); imported++;}
        if(d.last_exam) {
          const sourceId=`snapshot:${d.source_id}:${d.last_exam}`;
          if(!store.all('visits','patient_id = ? AND source_id = ?',[patientId,sourceId]).length) store.insert('visits',{id:id('visit'),patient_id:patientId,date:d.last_exam,type:'eye examination',source_id:sourceId});
        }
        if(d.last_purchase&&typeof d.total==='number') {
          const sourceId=`snapshot:${d.source_id}:${d.last_purchase}:${d.category||'Eyewear'}`;
          const previousTx=store.all('transactions','source_id = ?',[sourceId])[0];
          const tx={patient_id:patientId,date:d.last_purchase,total:d.total,category:d.category||'Eyewear',status:'paid',source_id:sourceId};
          if(previousTx) store.update('transactions',previousTx.id,tx); else store.insert('transactions',{id:id('tx'),...tx});
        }
      } else {
        const previous=store.all(file.entity,'source_id = ?',[d.source_id])[0]; const record={patient_id:d.patient_id,source_id:d.source_id,date:d.date};
        if(file.entity==='transactions') Object.assign(record,{total:d.total,category:d.category||'Eyewear',status:d.status||'paid'});
        if(['appointments','orders'].includes(file.entity)) record.status=d.status;
        if(['appointments','visits'].includes(file.entity)) record.type=d.type||'follow-up';
        if(previous && previous.patient_id!==d.patient_id) throw Error('A source record cannot be reassigned to a different patient.');
        if(previous) {store.update(file.entity,previous.id,record);updated++;} else {store.insert(file.entity,{id:id(file.entity),...record});imported++;}
      }
    }
    const summary={imported,updated,skipped:report.total-imported-updated,invalid:report.invalid,duplicates:report.duplicates,warnings:report.warnings,entity:file.entity,exceptions:report.rows.filter(r=>r.errors.length||r.warnings.length).map(r=>({row:r.row,errors:r.errors,warnings:r.warnings})).slice(0,500)};
    store.update('imports',importId,{report:JSON.stringify(summary)}); store.insert('mappings',{id:id('map'),name:file.filename,columns_json:JSON.stringify(file.mapping),created_at:timestamp()});
    const opportunities=analyse(store); store.audit('import.committed',importId,userId,{...summary,exceptions:undefined});
    return {id:importId,...summary,opportunities};
  });
}
export class GenericCSVConnector extends OpticalConnector {
  constructor() {
    super({ id: 'generic-csv', name: 'Generic CSV / XLSX', status: 'available', entities: Object.keys(FIELDS), capabilities: { fileImport: true, incrementalImport: true } });
  }
  inspect(buffer, filename, entity = 'patients') {
    this.requireCapability('fileImport', entity);
    return inspectFile(buffer, filename, entity);
  }
  validate(store, rows, mapping, entity = 'patients') {
    this.requireCapability('fileImport', entity);
    return validateImport(store, rows, mapping, entity);
  }
  import(store, file, userId, includeDuplicates = false) {
    this.requireCapability('fileImport', file.entity);
    return commitImport(store, file, userId, includeDuplicates);
  }
}
