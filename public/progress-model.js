export const emptyState=()=>({version:1,reviews:{},drafts:{},notes:{},bookmarks:[],history:[],goal:12});
export function dayKey(time=Date.now()){
 const d=new Date(time);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function schedule(previous,quality,now=Date.now()){
 const stage=Math.min(5,Math.max(0,(previous?.stage||0)+(quality===0?-6:quality===1?0:quality===2?1:2)));
 const days=[1,1,3,7,14,30][stage];
 return {stage,due:now+(quality===0?10*60*1000:days*86400000),reviewedAt:now,
   count:(previous?.count||0)+1,lapses:(previous?.lapses||0)+(quality===0?1:0),quality};
}
export function eligible(q){return q.status==='direct';}
export function normalizeBackup(raw,ids){
 if(!raw||raw.version!==1||typeof raw!=='object')throw new Error('不支持的备份格式');
 const next=emptyState();
 for(const [id,r] of Object.entries(raw.reviews||{})){
  if(!ids.has(id)||!r||!Number.isInteger(r.stage)||r.stage<0||r.stage>5||
     !Number.isFinite(r.due)||r.due<0||r.due>8640000000000000||
     !Number.isFinite(r.reviewedAt)||r.reviewedAt<0||!Number.isInteger(r.quality)||r.quality<0||r.quality>3)continue;
  next.reviews[id]={stage:r.stage,due:r.due,reviewedAt:r.reviewedAt,
   count:Math.min(100000,Math.max(0,Number.isFinite(r.count)?Math.floor(r.count):0)),
   lapses:Math.min(100000,Math.max(0,Number.isFinite(r.lapses)?Math.floor(r.lapses):0)),quality:r.quality};
 }
 for(const key of ['drafts','notes'])for(const [id,text] of Object.entries(raw[key]||{})){
  if(ids.has(id)&&typeof text==='string')next[key][id]=text.slice(0,15000);
 }
 next.bookmarks=[...new Set(Array.isArray(raw.bookmarks)?raw.bookmarks.filter(id=>ids.has(id)):[])];
 next.history=(Array.isArray(raw.history)?raw.history:[]).filter(h=>h&&ids.has(h.id)&&Number.isFinite(h.at)&&h.at>=0&&h.at<=8640000000000000&&Number.isInteger(h.quality)&&h.quality>=0&&h.quality<=3).slice(-20000).map(h=>({id:h.id,at:h.at,quality:h.quality}));
 if(Number.isInteger(raw.goal)&&raw.goal>=1&&raw.goal<=100)next.goal=raw.goal;
 return next;
}
export function mergeState(a,b){
 const result={...a,reviews:{...a.reviews},drafts:{...a.drafts},notes:{...a.notes},
  bookmarks:[...new Set([...a.bookmarks,...b.bookmarks])],history:[]};
 for(const [id,r] of Object.entries(b.reviews))if(!a.reviews[id]||r.reviewedAt>a.reviews[id].reviewedAt)result.reviews[id]=r;
 for(const key of ['drafts','notes'])for(const [id,text] of Object.entries(b[key]))if(!result[key][id])result[key][id]=text;
 result.history=[...new Map([...a.history,...b.history].map(h=>[`${h.id}-${h.at}`,h])).values()].sort((x,y)=>x.at-y.at).slice(-20000);
 return result;
}
