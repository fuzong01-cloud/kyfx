import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { meta, modules, syllabus, sources } from '../data/syllabus.mjs';
import { topics } from '../data/topics.mjs';
import { examples } from '../data/examples.mjs';
import { evidence } from '../data/evidence.mjs';
export function makeCatalog(){
 const questions=[];
 for(const topic of topics){
  questions.push({id:`learn-${topic.id}`,module:topic.module,topicIds:[topic.id],syllabusIds:topic.syllabusIds,
   prompt:topic.prompt,answer:topic.essentials.join('\n'),status:'direct',source:topic.sources[0],sources:topic.sources,
   kind:'考点自测',provenance:'考纲整理题',note:'依据考纲和学生总结整理，先独立作答再核对参考要点。',
   mappingReason:`围绕“${topic.title}”训练该条款要求的概念、方法或应用。`});
  topic.variations.forEach((v,i)=>questions.push({id:`variant-${topic.id}-${i+1}`,module:topic.module,topicIds:[topic.id],syllabusIds:topic.syllabusIds,
   prompt:v.question,answer:v.answer,status:'direct',source:topic.sources[0],sources:topic.sources,kind:'新编变式',provenance:'新编变式',
   note:'改变条件或场景，训练同一考点的迁移应用。',mappingReason:`改变“${topic.title}”的应用条件，检验能否迁移同一考点。`}));
 }
 for(const q of questions) q.sources=[...new Set([...q.sources,...q.topicIds.flatMap(id=>(evidence[id]||[]).map(e=>e.source))])];
 return {meta:{...meta,updated:'2026-10-21'},modules,syllabus,sources,topics:topics.map(t=>({...t,code:examples[t.id]||null,evidence:evidence[t.id]||[]})),questions};
}
export async function build(){
 const data=makeCatalog();
 const allowedSources=new Set(['outline341','outline821','g-short','i-short','a-short','book-g','book-i']);
 if(data.sources.length!==allowedSources.size||data.sources.some(s=>!allowedSources.has(s.id)))throw new Error('资料清单出现未指定的来源');
 if(data.questions.some(q=>q.status!=='direct'||q.year||!allowedSources.has(q.source)||q.sources.some(id=>!allowedSources.has(id))))throw new Error('题库出现未指定的来源或范围');
 await rm('dist',{recursive:true,force:true});
 await mkdir('dist/content',{recursive:true});
 await cp('public','dist',{recursive:true});
 await writeFile('dist/content/catalog.json',JSON.stringify(data));
 const library=JSON.parse(await readFile('data/library.json','utf8'));
 if(library.some(s=>!['g-short','i-short','a-short'].includes(s.source)||['a-short-2','a-short-3'].includes(s.id)))throw new Error('资料书架出现未指定的章节');
 await writeFile('dist/content/library.json',JSON.stringify(library));
 const safe=x=>String(x).replaceAll('|','／').replaceAll('\n',' ');
 const index=['# 题目与考纲对照索引','',data.meta.scopeNote,'','整理解析与变式均为复习参考。','','| 编号 | 模块 | 类型 | 考点 | 题目 |','| --- | --- | --- | --- | --- |',...data.questions.map(q=>`| ${q.id} | ${modules.find(m=>m.id===q.module)?.title||q.module} | ${q.kind} | ${q.syllabusIds.join('、')} | ${safe(q.prompt)} |`),'','## 考纲原文','',...syllabus.map(s=>`### ${s.id} ${s.section}\n\n${s.text}\n`)];
 await writeFile('dist/question-index.md',index.join('\n'));
 const guide=['# 知禾 · 模块复习提纲','',data.meta.scopeNote,'',data.meta.policy,'','此提纲为答题骨架，结合资料书架中的学生原笔记展开学习。'];
 for(const m of modules){guide.push(`\n## ${m.code} ${m.title}\n`);for(const t of data.topics.filter(t=>t.module===m.id)){guide.push(`### ${t.title}\n`,`考点：${t.syllabusIds.join('、')}\n`,`自测：${t.prompt}\n`,...t.essentials.map(x=>'- '+x),`\n易错点：${t.pitfall}\n`,...t.variations.map((v,i)=>`**变式${i+1}：${v.question}**\n\n${v.answer}\n`),...t.evidence.map(e=>`辅助核对：${sources.find(s=>s.id===e.source).name}，${e.location}\n\n${e.note}\n`));}}
 await writeFile('dist/study-guide.md',guide.join('\n'));
 console.log(`Built ${data.topics.length} topics, ${data.questions.length} questions, ${library.length} reading sections.`);
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await build();
