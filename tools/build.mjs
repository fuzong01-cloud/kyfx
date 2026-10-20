import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { meta, modules, syllabus, sources } from '../data/syllabus.mjs';
import { topics } from '../data/topics.mjs';
import { evidence } from '../data/evidence.mjs';

const allowedModules = new Set(['ai', 'agronomy', 'information']);
const allowedSources = new Set(['outline341', 'outline821', 'g-short', 'i-short', 'a-short', 'book-g', 'book-i']);
const newExerciseNote = '本题由系统根据考纲编写，不是资料中的原题；参考要点请结合原文核对。';

export function makeCatalog() {
  const questions = [];
  for (const topic of topics) {
    const base = {
      module: topic.module,
      topicIds: [topic.id],
      syllabusIds: topic.syllabusIds,
      status: 'direct',
      source: topic.sources[0],
      sources: [...new Set([...topic.sources, ...(evidence[topic.id] || []).map(item => item.source)])],
      provenance: '新编练习',
      note: newExerciseNote,
    };
    questions.push({
      ...base,
      id: `learn-${topic.id}`,
      prompt: topic.prompt,
      answer: topic.essentials.join('\n'),
      kind: '考点自测',
      mappingReason: `根据“${topic.title}”对应的考纲条款新编，用于练习概念、方法和应用。`,
    });
    topic.variations.forEach((variation, index) => questions.push({
      ...base,
      id: `variant-${topic.id}-${index + 1}`,
      prompt: variation.question,
      answer: variation.answer,
      kind: '变式练习',
      mappingReason: `根据“${topic.title}”对应的考纲条款新编，通过更换条件练习迁移。`,
    }));
  }
  return {
    meta: { ...meta, updated: '2026-10-21' },
    modules,
    syllabus,
    sources,
    topics: topics.map(topic => ({ ...topic, code: null, evidence: evidence[topic.id] || [] })),
    questions,
  };
}

function validate(data, library) {
  if (data.modules.length !== allowedModules.size || data.modules.some(module => !allowedModules.has(module.id))) {
    throw new Error('模块列表含有已删除的内容');
  }
  if (data.syllabus.some(item => !allowedModules.has(item.module))) throw new Error('考纲列表含有已删除的模块');
  if (data.topics.some(topic => !allowedModules.has(topic.module))) throw new Error('复习主题含有已删除的模块');
  if (data.sources.length !== allowedSources.size || data.sources.some(source => !allowedSources.has(source.id))) {
    throw new Error('资料清单含有未指定的来源');
  }
  if (data.questions.some(question => !allowedModules.has(question.module) || question.provenance !== '新编练习' || question.status !== 'direct' || !allowedSources.has(question.source) || question.sources.some(id => !allowedSources.has(id)))) {
    throw new Error('题库含有未标注来源的新题或已删除的模块');
  }
  if (library.some(section => !['g-short', 'i-short', 'a-short'].includes(section.source) || ['a-short-2', 'a-short-3'].includes(section.id))) {
    throw new Error('资料书架含有未指定的章节');
  }
}

export async function build() {
  const data = makeCatalog();
  const library = JSON.parse(await readFile('data/library.json', 'utf8'));
  validate(data, library);
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist/content', { recursive: true });
  await cp('public', 'dist', { recursive: true });
  await writeFile('dist/content/catalog.json', JSON.stringify(data));
  await writeFile('dist/content/library.json', JSON.stringify(library));
  const safe = value => String(value).replaceAll('|', '／').replaceAll('\n', ' ');
  const index = [
    '# 题目与考纲对照索引', '',
    '以下全部是按考纲新编的练习，不是资料原题，也不是官方试题。', '',
    '| 编号 | 模块 | 类型 | 对应考点 | 题目 |',
    '| --- | --- | --- | --- | --- |',
    ...data.questions.map(question => `| ${question.id} | ${modules.find(module => module.id === question.module)?.title} | 新编练习 · ${question.kind} | ${question.syllabusIds.join('、')} | ${safe(question.prompt)} |`),
    '', '## 考纲原文', '',
    ...syllabus.map(item => `### ${item.id} ${item.section}\n\n${item.text}\n`),
  ];
  await writeFile('dist/question-index.md', index.join('\n'));
  const guide = ['# 知禾 · 模块复习提纲', '', meta.scopeNote, '', '以下自测与变式均为新编练习，参考要点需结合原文核对。'];
  for (const module of modules) {
    guide.push(`\n## ${module.code} ${module.title}\n`);
    for (const topic of data.topics.filter(item => item.module === module.id)) {
      guide.push(`### ${topic.title}\n`, `考点：${topic.syllabusIds.join('、')}\n`, `新编自测：${topic.prompt}\n`, ...topic.essentials.map(item => '- ' + item), `\n易错点：${topic.pitfall}\n`, ...topic.variations.map((variation, index) => `**新编变式${index + 1}：${variation.question}**\n\n${variation.answer}\n`));
      for (const item of topic.evidence) {
        const source = sources.find(source => source.id === item.source);
        guide.push(`辅助核对：${source.name}，${item.location}\n\n${item.note}\n`);
      }
    }
  }
  await writeFile('dist/study-guide.md', guide.join('\n'));
  console.log(`Built ${data.modules.length} modules, ${data.topics.length} topics, ${data.questions.length} new exercises, ${library.length} reading sections.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await build();
