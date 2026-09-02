const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DATA_DIR = process.env.RIZVI_DATA_DIR ? path.resolve(process.env.RIZVI_DATA_DIR) : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TABLES = ['users', 'patients', 'procedures', 'referrals', 'doctors', 'invoices', 'settings', 'counters', 'pushTokens', 'biometricSessions'];
const DEPARTMENTS = ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Procedure', 'General'];
const DEFAULT_MORNING_START_HOUR = 8;
const DEFAULT_EVENING_START_HOUR = 14;
const CLINIC_TZ = 'Asia/Karachi';
function filePath(table) { return path.join(DATA_DIR, `${table}.json`); }
function ensureTable(table) { const fp=filePath(table); if(!fs.existsSync(fp)) fs.writeFileSync(fp, JSON.stringify(table==='settings'?{}:[],null,2)); }
TABLES.forEach(ensureTable);
const memory={};
TABLES.forEach((table)=>{try{const raw=fs.readFileSync(filePath(table),'utf-8');memory[table]=JSON.parse(raw||(table==='settings'?'{}':'[]'));}catch(_){memory[table]=table==='settings'?{}:[];}});
function readTable(table){if(memory[table]===undefined){ensureTable(table);memory[table]=table==='settings'?{}:[];}return memory[table];}
function writeTable(table,data){memory[table]=data;fs.writeFileSync(filePath(table),JSON.stringify(data,null,2));queueMongoSync(table,data);return data;}
function getDepartments(){const s=readTable('settings');return Array.isArray(s.departments)&&s.departments.length?s.departments:DEPARTMENTS;}
function morningStartHour(){const h=Number(readTable('settings').morningStartHour);return Number.isFinite(h)&&h>=0&&h<=23?h:DEFAULT_MORNING_START_HOUR;}
function eveningStartHour(){const s=readTable('settings'),legacy=Number(s.shiftSplitHour),h=Number(s.eveningStartHour??(Number.isFinite(legacy)?legacy:undefined));return Number.isFinite(h)&&h>=0&&h<=23?h:DEFAULT_EVENING_START_HOUR;}
function clinicShift(iso){if(!iso)return'';const h=Number(new Intl.DateTimeFormat('en-US',{timeZone:CLINIC_TZ,hour:'numeric',hour12:false}).format(new Date(iso)));return h>=morningStartHour()&&h<eveningStartHour()?'Morning':'Evening';}
function clinicDateKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:CLINIC_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function shiftClinicDateKey(days,ref=new Date()){const [year,month,day]=clinicDateKey(ref).split('-').map(Number);return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);}
function isSameClinicDay(iso,ref=new Date()){return Boolean(iso)&&clinicDateKey(new Date(iso))===clinicDateKey(ref);}
function isYesterdayClinicDay(iso,ref=new Date()){return Boolean(iso)&&clinicDateKey(new Date(iso))===shiftClinicDateKey(-1,ref);}
function isTomorrowClinicDay(iso,ref=new Date()){return Boolean(iso)&&clinicDateKey(new Date(iso))===shiftClinicDateKey(1,ref);}
function withinLastDays(iso,days){if(!iso)return false;if(!days||days<=0)return isSameClinicDay(iso);const key=clinicDateKey(new Date(iso));const today=clinicDateKey();return key>=shiftClinicDateKey(-(days-1))&&key<=today;}
function inDateRange(iso,from,to){if(!iso)return false;const d=new Date(iso).getTime();if(from&&d<new Date(from).getTime())return false;if(to&&d>new Date(to).getTime()+86400000-1)return false;return true;}
function applyDateRange(list,{range,from,to,dateField='createdAt'}={}){
  if(from||to)return list.filter(i=>inDateRange(i[dateField],from,to));
  if(range==='today')return list.filter(i=>isSameClinicDay(i[dateField]));
  if(range==='tomorrow')return list.filter(i=>isTomorrowClinicDay(i[dateField]));
  if(range==='yesterday')return list.filter(i=>isYesterdayClinicDay(i[dateField]));
  if(range==='last3')return list.filter(i=>withinLastDays(i[dateField],3));
  if(range==='last7')return list.filter(i=>withinLastDays(i[dateField],7));
  if(range==='last14')return list.filter(i=>withinLastDays(i[dateField],14));
  if(range==='month'){const currentMonth=clinicDateKey().slice(0,7);return list.filter(i=>clinicDateKey(new Date(i[dateField])).slice(0,7)===currentMonth);}
  return list;
}
function applyStaffEntryLimit(list,settings,dateField='createdAt'){if(!Array.isArray(list)||!list.length)return list;const mode=settings.staffEntryLimitMode||'all';if(mode==='all')return list;const sorted=[...list].sort((a,b)=>new Date(b[dateField])-new Date(a[dateField]));if(mode==='count')return sorted.slice(0,Math.max(1,Number(settings.staffEntryLimitCount)||20));if(mode==='percent')return sorted.slice(0,Math.max(1,Math.ceil(sorted.length*Math.min(100,Math.max(1,Number(settings.staffEntryLimitPercent)||30))/100)));return sorted;}
function staffLimitInfo(settings,totalAvailable,shown){if((settings.staffEntryLimitMode||'all')==='all')return null;return{mode:settings.staffEntryLimitMode,count:settings.staffEntryLimitCount||20,percent:settings.staffEntryLimitPercent||30,totalAvailable,shown};}
function paginate(list,page,pageSize){const p=Math.max(1,Number(page)||1),size=Math.min(1000,Math.max(1,Number(pageSize)||20)),total=list.length,totalPages=Math.max(1,Math.ceil(total/size)),safePage=Math.min(p,totalPages);return{rows:list.slice((safePage-1)*size,safePage*size),total,page:safePage,pageSize:size,totalPages};}
function clinicYearMonth(date=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:CLINIC_TZ,year:'numeric',month:'2-digit'}).formatToParts(date),year=parts.find(p=>p.type==='year').value,month=Number(parts.find(p=>p.type==='month').value);return{year,month,key:`${year}-${String(month).padStart(2,'0')}`};}
function nextId(name){const c=readTable('counters'),next=Number(c[name]||0)+1;c[name]=next;writeTable('counters',c);return next;}
const DEFAULT_INVOICE_MONTH_CODES=['JA','FE','MR','AP','MY','JN','JL','AU','SE','OC','NO','DE'];
function nextInvoiceNumber(){const s=readTable('settings'),{year,month,key}=clinicYearMonth(),c=readTable('counters'),counterKey=`invoice_${key}`,seq=Number(c[counterKey]||0)+1;c[counterKey]=seq;writeTable('counters',c);const prefix=s.invoicePrefix||'RDC',codes=s.invoiceMonthCodes||DEFAULT_INVOICE_MONTH_CODES,monthCode=codes[month-1]||DEFAULT_INVOICE_MONTH_CODES[month-1],digits=Number(s.invoiceDigits)||4,yearPart=s.invoiceIncludeYear!==false?`${year.slice(-2)}-`:'';return`${prefix}-${monthCode}-${yearPart}${String(seq).padStart(digits,'0')}`;}
function generateId(prefix='id'){return`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}
function resolveMongoUri(){for(const raw of[process.env.MONGODB_URI,process.env.MONGODB_URI_2,process.env.MONGODB_URI_3]){if(!raw)continue;const uri=String(raw).trim().replace(/^["']|["']$/g,'');if(uri.startsWith('mongodb://')||uri.startsWith('mongodb+srv://'))return uri;}return'';}
const MONGODB_URI=resolveMongoUri();const MONGODB_DB_NAME=process.env.MONGODB_DB_NAME||'rizvi_diagnostic_center';let mongoClient=null,mongoDb=null,mongoConnectPromise=null;
function getMongoDb(){if(!MONGODB_URI)return Promise.resolve(null);if(mongoDb)return Promise.resolve(mongoDb);if(!mongoConnectPromise){mongoClient=new MongoClient(MONGODB_URI,{serverSelectionTimeoutMS:8000,connectTimeoutMS:10000,socketTimeoutMS:30000,maxPoolSize:10,retryWrites:true});mongoConnectPromise=mongoClient.connect().then(()=>{mongoDb=mongoClient.db(MONGODB_DB_NAME);console.log(`[mongo] Connected to Atlas database "${MONGODB_DB_NAME}" — live sync enabled.`);return mongoDb;}).catch(err=>{console.warn('[mongo] Could not connect to Atlas — continuing on local files only:',err.message);mongoConnectPromise=null;return null;});}return mongoConnectPromise;}
let mongoQueue=Promise.resolve();
function queueMongoSync(table,data){if(!MONGODB_URI)return;mongoQueue=mongoQueue.then(async()=>{try{const db=await getMongoDb();if(!db)return;await db.collection('tables').updateOne({_id:table},{$set:{data,updatedAt:new Date()}},{upsert:true});}catch(err){console.warn(`[mongo] Sync failed for "${table}" (kept locally, will retry on next write):`,err.message);}});return mongoQueue;}
function flushMongoSync(){return mongoQueue;}
async function initDb(){if(!MONGODB_URI){console.warn('[mongo] MONGODB_URI is not configured — desktop is using persistent local data only.');return;}const db=await getMongoDb();if(!db)return;for(const table of TABLES){try{const doc=await db.collection('tables').findOne({_id:table});const localHasData=Array.isArray(memory[table])?memory[table].length>0:Object.keys(memory[table]||{}).length>0;if(doc&&doc.data!==undefined){memory[table]=doc.data;fs.writeFileSync(filePath(table),JSON.stringify(doc.data,null,2));}else if(localHasData)await db.collection('tables').updateOne({_id:table},{$set:{data:memory[table],updatedAt:new Date()}},{upsert:true});}catch(err){console.warn(`[mongo] Could not sync table "${table}" at boot:`,err.message);}}}
let queue=Promise.resolve();function transaction(table,updater){queue=queue.then(()=>{const data=readTable(table),result=updater(data);writeTable(table,data);return result;});return queue;}
module.exports={readTable,writeTable,initDb,flushMongoSync,transaction,nextId,nextInvoiceNumber,generateId,CLINIC_TZ,clinicDateKey,shiftClinicDateKey,isSameClinicDay,isYesterdayClinicDay,isTomorrowClinicDay,inDateRange,applyDateRange,applyStaffEntryLimit,staffLimitInfo,paginate,withinLastDays,clinicYearMonth,DEPARTMENTS,getDepartments,morningStartHour,eveningStartHour,clinicShift,getMongoDb,DATA_DIR,TABLES};
