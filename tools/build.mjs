import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { meta, modules, syllabus, sources } from '../data/syllabus.mjs';
import { topics } from '../data/topics.mjs';
import { recalls } from '../data/recalls.mjs';
import { examples } from '../data/examples.mjs';
import { evidence } from '../data/evidence.mjs';
export function makeCatalog(){
 const topicById=Object.fromEntries(topics.map(t=>[t.id,t]));
 const sourceById=Object.fromEntries(sources.map(s=>[s.id,s]));
 const questions=[];
 for(const topic of topics){
  questions.push({id:`learn-${topic.id}`,module:topic.module,topicIds:[topic.id],syllabusIds:topic.syllabusIds,
   prompt:topic.prompt,answer:topic.essentials.join('\n'),status:'direct',source:'editorial',sources:topic.sources,
   kind:'考点自测',provenance:'考纲整理题',note:'由学生资料按考纲重新组织的问题，不冒充历年真题。',
   mappingReason:`围绕“${topic.title}”训练该条款要求的概念、方法或应用。`});
  topic.variations.forEach((v,i)=>questions.push({id:`variant-${topic.id}-${i+1}`,module:topic.module,topicIds:[topic.id],syllabusIds:topic.syllabusIds,
   prompt:v.question,answer:v.answer,status:'direct',source:'editorial',sources:topic.sources,kind:'新编变式',provenance:'新编变式',
   note:'改变条件或场景的新编训练题，不是历年真题。',mappingReason:`改变“${topic.title}”的应用条件，检验能否迁移同一考点。`}));
 }
 for(const q of recalls){
  const ts=q.topicIds.map(id=>topicById[id]);
  let syllabusIds=[...new Set(ts.flatMap(t=>t.syllabusIds))];
  if(q.module==='information'&&ts.some(t=>t.module==='ai'))syllabusIds=['I1','I6'];
  questions.push({...q,syllabusIds,year:sourceById[q.source].year,sources:[q.source,...new Set(ts.flatMap(t=>t.sources))],
   mappingReason:q.status==='retired'?'最新341三部分未列出这一旧网络/数据库专题。':
    q.status==='related'?'该主题不是本科目考纲的明确独立列项；以下条款仅作应用背景或跨科联系，不据此扩大必背范围。':
    `题目要求与“${ts.map(t=>t.title).join('、')}”直接关联，按下列条款准备。`});
 }
 for(const q of questions) q.sources=[...new Set([...q.sources,...q.topicIds.flatMap(id=>(evidence[id]||[]).map(e=>e.source))])];
 return {meta:{...meta,updated:'2026-10-21'},modules,syllabus,sources,topics:topics.map(t=>({...t,code:examples[t.id]||null,evidence:evidence[t.id]||[]})),questions};
}
export async function build(){
 const data=makeCatalog();
 await rm('dist',{recursive:true,force:true});
 await mkdir('dist/content',{recursive:true});
 await cp('public','dist',{recursive:true});
 await writeFile('dist/content/catalog.json',JSON.stringify(data));
 const library=JSON.parse(await readFile('data/library.json','utf8'));
 await writeFile('dist/content/library.json',JSON.stringify(library));
 const safe=x=>String(x).replaceAll('|','／').replaceAll('\n',' ');
 const index=['# 题目与考纲对照索引','',data.meta.scopeNote,'','回忆资料可能缺题干或选项；整理解析与变式并非官方答案。','','| 编号 | 模块 | 来源 | 范围 | 考点 | 题目 |','| --- | --- | --- | --- | --- | --- |',...data.questions.map(q=>`| ${q.id} | ${modules.find(m=>m.id===q.module)?.title||q.module} | ${q.year?q.year+'回忆':q.kind} | ${{direct:'考纲内',related:'相关拓展',retired:'旧纲归档'}[q.status]} | ${q.syllabusIds.join('、')||'无'} | ${safe(q.prompt)} |`),'','## 考纲原文','',...syllabus.map(s=>`### ${s.id} ${s.section}\n\n${s.text}\n`)];
 await writeFile('dist/question-index.md',index.join('\n'));
 const guide=['# 知禾 · 模块复习提纲','',data.meta.scopeNote,'',data.meta.policy,'','此提纲为答题骨架，结合资料书架中的学生原笔记展开学习。'];
 for(const m of modules){guide.push(`\n## ${m.code} ${m.title}\n`);for(const t of data.topics.filter(t=>t.module===m.id)){guide.push(`### ${t.title}\n`,`考点：${t.syllabusIds.join('、')}\n`,`自测：${t.prompt}\n`,...t.essentials.map(x=>'- '+x),`\n易错点：${t.pitfall}\n`,...t.variations.map((v,i)=>`**变式${i+1}：${v.question}**\n\n${v.answer}\n`),...t.evidence.map(e=>`辅助核对：${sources.find(s=>s.id===e.source).name}，${e.location}\n\n${e.note}\n`));}}
 await writeFile('dist/study-guide.md',guide.join('\n'));
 console.log(`Built ${data.topics.length} topics, ${data.questions.length} questions, ${library.length} reading sections.`);
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await build();
