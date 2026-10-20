const content = await fetch('/content.json').then(r => {
  if (!r.ok) throw new Error('复习内容加载失败');
  return r.json();
});

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const KEY = 'zhihe-progress-v1';
const modules = content.modules;
const points = content.syllabus;
const sourceNames = {
  'outline341': '341 考试大纲',
  'outline821': '821 考试大纲',
  'g-short': '农学概论简化版',
  'i-short': '农业信息化终极背诵版',
  'a-short': '人工智能总结'
};
const sourceFiles = {
  'g-short': '农学概论 简化版.docx',
  'i-short': '农业信息化终极背诵版.pdf',
  'a-short': '人工智能.docx'
};
const questions = buildQuestions();
let state = loadState();
let toastTimer;
let practiceQuestionId = null;
let answerShown = false;
let variationShown = false;

function emptyState() {
  return { version: 1, reviews: {}, drafts: {}, notes: {}, variations: {}, history: [], goal: 12 };
}

function buildQuestions() {
  const generated = [];
  for (const point of points) {
    generated.push({
      id: `outline-${point.id}`,
      kind: '考纲主动回忆',
      module: point.module,
      pointId: point.id,
      syllabusIds: [point.id],
      noteIds: content.notes.filter(note => (content.noteMappings[note.id] || []).includes(point.id)).map(note => note.id),
      sourceId: point.module === 'information' ? 'outline821' : 'outline341',
      prompt: `请回忆「${point.section}」的考试要求，并说清这一条考查哪些知识内容。`,
      answer: point.text,
      variationPrompt: variationPrompt(point.module, point.section),
      variationGuide: '先判断新情境对应的考纲概念，再按“条件与目标 → 方法选择 → 实施或分析 → 效果与限制”组织答案。请用模块总结里的具体内容补充，不要只写空泛结论。'
    });
  }
  for (const note of content.notes) {
    const syllabusIds = content.noteMappings[note.id] || [];
    if (!syllabusIds.length) continue;
    generated.push({
      id: `summary-${note.id}`,
      kind: '学生总结主动回忆',
      module: note.module,
      pointId: syllabusIds[0],
      syllabusIds,
      noteIds: [note.id],
      sourceId: note.source,
      prompt: `请合上材料，复述「${note.title}」的核心内容，并说明它对应考纲的哪些要求。`,
      answer: note.text,
      variationPrompt: variationPrompt(note.module, note.title),
      variationGuide: '尝试换一个作物、生产条件或农业应用场景。说明哪些原理仍适用、哪些措施需要随条件调整，并指出判断依据。'
    });
  }
  return generated;
}

function variationPrompt(moduleId, title) {
  const context = {
    program: '输入数据或程序条件',
    ai: '数据类型或实际任务',
    agronomy: '作物、季节或田间条件',
    information: '农业生产场景或管理目标'
  }[moduleId] || '应用场景';
  return `把「${title}」换到另一个${context}中，你会如何迁移所学内容？`;
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (!stored || stored.version !== 1) return emptyState();
    return { ...emptyState(), ...stored };
  } catch {
    return emptyState();
  }
}

function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast('浏览器存储空间不足，请先导出备份。');
  }
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}

function moduleById(id) { return modules.find(item => item.id === id); }
function pointById(id) { return points.find(item => item.id === id); }
function questionById(id) { return questions.find(item => item.id === id); }
function questionsForPoint(id) { return questions.filter(item => item.syllabusIds.includes(id)); }
function pointNotes(id) {
  return content.notes.filter(note => (content.noteMappings[note.id] || []).includes(id));
}
function modulePoints(id) { return points.filter(point => point.module === id); }
function dueQuestions() {
  const now = Date.now();
  return questions.filter(question => {
    const review = state.reviews[question.id];
    return !review || review.due <= now;
  });
}
function reviewState(questionId) { return state.reviews[questionId]; }
function pointStatus(pointId) {
  const related = questionsForPoint(pointId);
  if (!related.length) return 0;
  if (related.every(question => reviewState(question.id)?.quality >= 2)) return 2;
  if (related.some(question => reviewState(question.id))) return 1;
  return 0;
}
function statusName(value) { return ['未开始', '正在复习', '已掌握'][value] || '未开始'; }
function statusPill(pointId) {
  const status = pointStatus(pointId);
  return `<span class="status status-${status}">${statusName(status)}</span>`;
}
function head(kicker, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
function button(label, action, id = '', extra = '', klass = 'button') {
  return `<button type="button" class="${klass}" data-action="${action}" ${id ? `data-id="${esc(id)}"` : ''} ${extra}>${label}</button>`;
}
function empty(title, description, action = '') {
  return `<div class="empty"><span>❧</span><h2>${title}</h2><p>${description}</p>${action}</div>`;
}
function sourceLabel(sourceId) { return sourceFiles[sourceId] || sourceNames[sourceId] || '考纲范围整理'; }
function cardCount(pointId) { return questionsForPoint(pointId).length; }

function moduleCard(module) {
  const modulePointsList = modulePoints(module.id);
  const mastered = modulePointsList.filter(point => pointStatus(point.id) === 2).length;
  const due = questions.filter(question => question.module === module.id && dueQuestions().some(item => item.id === question.id)).length;
  const index = modules.indexOf(module);
  return `<a class="module-card ${['green', 'blue', 'gold', 'terra'][index]}" href="#module/${module.id}">
    <div class="module-top"><span class="module-icon">${['〈/〉', '✧', '❧', '▦'][index]}</span><span>${esc(module.code)} <b>↗</b></span></div>
    <h3>${esc(module.title)}</h3><p>${esc(module.description)}</p>
    <div class="module-progress"><span>${modulePointsList.length} 个考纲点 · ${questions.filter(q => q.module === module.id).length} 道练习</span><b>${Math.round(mastered / Math.max(modulePointsList.length, 1) * 100)}%</b></div>
    <progress value="${mastered}" max="${Math.max(modulePointsList.length, 1)}"></progress>
    <small class="due-line">${due} 道待开始或复习</small></a>`;
}

function renderHome() {
  const due = dueQuestions().length;
  const mastered = points.filter(point => pointStatus(point.id) === 2).length;
  const today = state.history.filter(item => new Date(item.at).toDateString() === new Date().toDateString()).length;
  return `${head('2027 · 备考工作台', '把考纲变成每天能完成的复习。', '每个考点都有对应练习：先自己作答，再核对总结与考纲，最后按掌握程度安排复习。', `<span class="date-pill">${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span>`)}
    <section class="hero"><div class="hero-copy"><span class="hero-label">341 · 821 STUDY PLAN</span><h2>先回忆，再核对，<br>最后举一反三。</h2><p>按考纲分模块练习。<br>上届总结做答案底稿，教材帮助核对关键概念。</p><div class="hero-actions"><a class="button light" href="#practice">开始今日复习 →</a><a class="hero-link" href="#syllabus">查看考纲地图 ↗</a></div></div>
    <div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><img class="sprout" src="/sprout.svg" alt=""><div class="art-label">回忆 / 核对 / 巩固</div></div>
    <div class="hero-footer"><span>341 <b>程序 · 人工智能 · 农学概论</b></span><span>821 <b>现代农业与农业信息化</b></span></div></section>
    <div class="stats-grid"><div class="stat"><strong>${due}</strong><p>待开始 / 复习练习</p></div><div class="stat"><strong>${questions.length}</strong><p>考纲与总结练习</p></div><div class="stat"><strong>${mastered}</strong><p>已掌握考点</p></div><div class="stat"><strong>${today}</strong><p>今日自评次数</p></div></div>
    <div class="section-heading"><h2>选择复习模块</h2><a href="#syllabus">查看完整考纲 →</a></div><div class="module-grid">${modules.map(moduleCard).join('')}</div>
    <section class="panel source-callout"><div><span class="eyebrow">推荐复习步骤</span><h2>读一个主题，练几道卡片，隔天再回忆</h2><p>模块中的每个考点都连着考纲回忆题或学生总结回忆题。答完后给自己打分，系统会把需要巩固的题排到后面复习。</p></div><a class="text-link" href="#practice">进入练习 →</a></section>`;
}

function noteBlock(note) {
  const bookRefs = content.books.flatMap(book => book.refs.filter(ref => ref.noteId === note.id).map(ref => ({ ...ref, book: book.title })));
  return `<details class="note-accordion"><summary><span>${esc(note.title)}</span><small>${esc(sourceLabel(note.source))} · 展开总结</small></summary>
    <div class="student-note-text">${esc(note.text)}</div><div class="source-caption">来源：${esc(sourceLabel(note.source))} · 学生自编或AI辅助整理，请结合考纲理解</div>
    ${bookRefs.map(ref => `<aside class="book-check"><b>教材辅助核对 · ${esc(ref.book)} · ${esc(ref.title)}</b><span>${esc(ref.location)}</span><p>${esc(ref.text)}</p></aside>`).join('')}</details>`;
}

function pointCard(point) {
  const related = questionsForPoint(point.id);
  return `<a class="unit-card" href="#topic/${point.id}"><div class="unit-top"><span>${esc(point.id)}</span>${statusPill(point.id)}</div>
    <h3>${esc(point.section)}</h3><p>${esc(point.text.slice(0, 145))}${point.text.length > 145 ? '…' : ''}</p>
    <small>${related.length} 道练习 · 对应考纲</small></a>`;
}

function renderModule(id) {
  const module = moduleById(id);
  if (!module) return empty('没有找到这个模块', '返回总览继续复习。', '<a class="button" href="#home">返回总览</a>');
  const modulePointList = modulePoints(id);
  const moduleNotes = content.notes.filter(note => note.module === id);
  const due = questions.filter(question => question.module === id && dueQuestions().some(item => item.id === question.id)).length;
  return `${head(esc(module.code), esc(module.title), `${esc(module.description)} · ${due} 道练习待复习`, '<a class="button" href="#practice">开始练习 →</a>')}
    <section class="module-intro panel"><div class="module-intro-meta"><span class="eyebrow">本模块练习路线</span><b>${modulePointList.length} 个考点 · ${questions.filter(q => q.module === id).length} 道练习</b></div><p>先选考点读范围，再做对应练习。作答后展开参考内容，按“还不会、有点模糊、基本会答、能举一反三”自评。</p></section>
    <div class="section-heading"><h2>考纲考点与练习</h2><span>${modulePointList.filter(point => pointStatus(point.id) === 2).length}/${modulePointList.length} 个考点已掌握</span></div>
    <div class="unit-grid">${modulePointList.map(pointCard).join('')}</div>
    ${moduleNotes.length ? `<div class="section-heading notes-heading"><h2>上届学生总结</h2><span>与本模块考点对应</span></div><div class="notes-stack">${moduleNotes.map(noteBlock).join('')}</div>` : ''}
    ${id === 'program' ? '<section class="notice">341 程序设计按考纲保留练习卡和范围说明；指定的三份学生总结中没有程序设计笔记。</section>' : ''}`;
}

function questionRows(list) {
  return `<div class="question-list">${list.map(question => {
    const review = reviewState(question.id);
    const due = !review || review.due <= Date.now();
    return `<a class="question-row" href="#question/${question.id}"><span class="question-marker ${review?.quality >= 2 ? 'mastered' : review ? 'seen' : ''}">${review?.quality >= 2 ? '✓' : review ? '·' : '○'}</span><div class="question-copy"><div class="tag-row"><span class="tag subtle">${esc(question.kind)}</span>${due ? '<span class="tag related">待复习</span>' : '<span class="tag subtle">已安排</span>'}</div><h3>${esc(question.prompt)}</h3><p>考纲：${question.syllabusIds.map(id => esc(pointById(id)?.id)).join(' · ')} · 来源：${esc(sourceLabel(question.sourceId))}</p></div><span class="arrow">↗</span></a>`;
  }).join('')}</div>`;
}

function renderTopic(id) {
  const point = pointById(id);
  if (!point) return empty('没有找到这个考点', '请从模块重新选择。', '<a class="button" href="#syllabus">打开考纲</a>');
  const module = moduleById(point.module);
  const relatedNotes = pointNotes(id);
  const relatedQuestions = questionsForPoint(id);
  return `${head(`${esc(module.code)} · ${esc(module.title)}`, esc(point.section), '先尝试作答，再核对考纲范围和学生总结。', `<a class="button secondary" href="#module/${module.id}">返回模块</a>`)}
    <section class="panel point-detail"><div class="section-heading"><h2>对应考纲</h2>${statusPill(point.id)}</div><blockquote>${esc(point.text)}</blockquote><p class="fine-print">考纲编号：${esc(point.id)} · 以下练习均为按考纲和指定总结整理的学习卡，不是历年真题。</p></section>
    ${relatedNotes.length ? `<div class="section-heading"><h2>相关学生总结</h2><span>${relatedNotes.length} 个章节</span></div><div class="notes-stack">${relatedNotes.map(noteBlock).join('')}</div>` : empty('当前指定总结没有覆盖这条考点', '先以考纲范围为准，再通过练习卡检查自己能否完整复述。')}
    <div class="section-heading"><h2>本考点练习</h2><span>${relatedQuestions.length} 道 · 先作答再核对</span></div>${questionRows(relatedQuestions)}
    <section class="panel own-notes"><h2>我的理解与错因</h2><p>写下自己的答题框架、记忆线索或需要补充的例子。</p><textarea data-note="${esc(point.id)}" rows="5" maxlength="8000" placeholder="这里记录的内容会自动保存在当前浏览器。">${esc(state.notes[point.id] || '')}</textarea><span class="autosave-label">自动保存</span></section>`;
}

function renderSyllabus() {
  return `${head('SYLLABUS MAP', '考纲地图', '逐条浏览341与821考试范围，并从考点直接进入练习。')}${modules.map(module => `<section class="panel syllabus-module"><div class="section-heading"><div><span class="eyebrow">${esc(module.code)}</span><h2>${esc(module.title)}</h2></div><span>${modulePoints(module.id).length} 个考点</span></div><div class="syllabus-list">${modulePoints(module.id).map(point => `<a href="#topic/${point.id}" class="syllabus-row"><span class="syllabus-code">${esc(point.id)}</span><span><b>${esc(point.section)}</b><small>${esc(point.text.slice(0, 165))}${point.text.length > 165 ? '…' : ''}</small></span>${statusPill(point.id)}<span class="arrow">↗</span></a>`).join('')}</div></section>`).join('')}`;
}

function practiceQueue() {
  const now = Date.now();
  const unseen = questions.filter(question => !state.reviews[question.id]);
  const due = questions.filter(question => state.reviews[question.id]?.due <= now)
    .sort((a, b) => state.reviews[a.id].due - state.reviews[b.id].due);
  return [...due, ...unseen];
}

function renderPractice() {
  const queue = practiceQueue();
  if (!practiceQuestionId || !queue.some(question => question.id === practiceQuestionId)) practiceQuestionId = queue[0]?.id || null;
  const question = questionById(practiceQuestionId);
  if (!question) return `${head('ACTIVE RECALL', '今日练习完成。', '待复习卡片已经做完，已安排的卡片会在下次到期时出现。')}${empty('现在可以休息一下', '也可以回模块学习新考点。', '<a class="button" href="#home">返回学习总览</a>')}`;
  const position = queue.findIndex(item => item.id === question.id) + 1;
  return `${head('ACTIVE RECALL', '主动回忆', '先自己组织答案，再展开参考内容。自评会决定这道卡片下次出现的时间。')}
    <section class="panel practice-card"><div class="practice-counter"><span>${esc(moduleById(question.module)?.code)} · ${esc(moduleById(question.module)?.title)}</span><span>队列 ${position} / ${queue.length}</span></div>
      <div class="tag-row"><span class="tag subtle">${esc(question.kind)}</span><span class="tag subtle">资料：${esc(sourceLabel(question.sourceId))}</span></div><h2>${esc(question.prompt)}</h2>
      <textarea class="answer-draft" data-draft="${esc(question.id)}" rows="6" maxlength="12000" placeholder="先在这里写下答案要点，也可以先口头回忆。">${esc(state.drafts[question.id] || '')}</textarea>
      ${answerShown ? `<div class="revealed"><h3>参考内容与考纲对应</h3><div class="answer-body">${esc(question.answer)}</div><p class="mapping-line"><b>考纲：</b>${question.syllabusIds.map(id => `<a href="#topic/${id}">${esc(pointById(id)?.section || id)}</a>`).join('、')}</p>
        ${question.noteIds.length ? `<p class="mapping-line"><b>学生总结：</b>${question.noteIds.map(id => `<a href="#topic/${content.noteMappings[id]?.[0]}">${esc(content.notes.find(note => note.id === id)?.title)}</a>`).join('、')}</p>` : ''}
        <section class="variation-box"><h3>举一反三</h3><p>${esc(question.variationPrompt)}</p><textarea data-variation="${esc(question.id)}" rows="4" maxlength="6000" placeholder="尝试把这个知识点迁移到新情境。">${esc(state.variations?.[question.id] || '')}</textarea>${variationShown ? `<div class="variation-guide"><b>作答检查思路</b><p>${esc(question.variationGuide)}</p></div>` : button('查看迁移思路', 'show-variation')}</section>
        <div class="grade-buttons">${[0, 1, 2, 3].map(quality => `<button class="grade" data-action="grade" data-id="${esc(question.id)}" data-quality="${quality}"><b>${['还不会', '有点模糊', '基本会答', '能举一反三'][quality]}</b><span>${['约10分钟后再练', '明天再练', '3天后再练', '7天后再练'][quality]}</span></button>`).join('')}</div></div>` : button('展开参考内容', 'reveal-answer', question.id)}
      <p class="fine-print">这套卡片按考纲与指定总结整理，不是历年真题或官方答案。</p></section>`;
}

function renderProgress() {
  const mastered = points.filter(point => pointStatus(point.id) === 2).length;
  const inProgress = points.filter(point => pointStatus(point.id) === 1).length;
  const history = state.history.slice(-10).reverse();
  return `${head('YOUR PROGRESS', '复习记录', '查看各模块掌握情况，管理每日目标和学习备份。')}
    <div class="stats-grid"><div class="stat"><strong>${mastered}</strong><p>已掌握考点</p></div><div class="stat"><strong>${inProgress}</strong><p>正在复习</p></div><div class="stat"><strong>${dueQuestions().length}</strong><p>待复习卡片</p></div><div class="stat"><strong>${state.history.length}</strong><p>累计自评</p></div></div>
    <div class="section-heading"><h2>模块进度</h2></div><div class="module-grid progress-modules">${modules.map(module => { const list = modulePoints(module.id), count = list.filter(point => pointStatus(point.id) === 2).length; return `<section class="panel progress-module"><span class="eyebrow">${esc(module.code)}</span><h2>${esc(module.title)}</h2><progress value="${count}" max="${Math.max(list.length, 1)}"></progress><p>${count} / ${list.length} 个考点已掌握</p><a class="text-link" href="#module/${module.id}">继续复习 →</a></section>`; }).join('')}</div>
    <section class="panel goal-panel"><h2>每日复习目标</h2><form id="goal-form" class="goal-form"><label for="goal">每天完成</label><input id="goal" name="goal" type="number" min="1" max="100" value="${state.goal}"><span>道练习</span><button class="button secondary">保存目标</button></form><p class="fine-print">今日已自评 ${state.history.filter(item => new Date(item.at).toDateString() === new Date().toDateString()).length} 次。</p></section>
    <section class="panel history-panel"><h2>最近自评</h2>${history.length ? `<div class="history-list">${history.map(item => `<p>${new Date(item.at).toLocaleString('zh-CN')} · ${esc(questionById(item.id)?.prompt || '练习卡')} · ${['还不会', '有点模糊', '基本会答', '能举一反三'][item.quality]}</p>`).join('')}</div>` : '<p class="muted">完成练习并自评后，这里会显示记录。</p>'}</section>
    <section class="panel backup-panel"><div><h2>学习数据备份</h2><p>备份包含复习评价、作答草稿、个人笔记和举一反三练习记录。清除浏览器数据或更换设备前，请先导出。</p><p class="fine-print">数据保存在当前浏览器，不会自动同步到其他设备。</p></div><div class="button-row">${button('↓ 导出备份', 'export')}${button('↑ 导入备份', 'import', '', '', 'button secondary')}</div></section>`;
}

function render() {
  const rawRoute = location.hash.slice(1) || 'home';
  const [route, id] = rawRoute.split('/');
  const labels = { home: '学习总览', module: '模块学习', topic: '考点练习', question: '题目练习', syllabus: '考纲地图', practice: '主动回忆', progress: '复习记录' };
  $('#breadcrumb').textContent = labels[route] || labels.home;
  $('#nav').innerHTML = `<a class="${route === 'home' ? 'active' : ''}" href="#home"><span class="nav-icon">◫</span>学习总览</a><a class="${route === 'syllabus' || route === 'topic' ? 'active' : ''}" href="#syllabus"><span class="nav-icon">◎</span>考纲地图</a>${modules.map((module, index) => `<a class="${route === 'module' && id === module.id ? 'active' : ''}" href="#module/${module.id}"><span class="nav-icon">${['〈/〉', '✧', '❧', '▦'][index]}</span>${esc(module.title)}</a>`).join('')}<a class="${route === 'practice' || route === 'question' ? 'active' : ''}" href="#practice"><span class="nav-icon">▷</span>主动回忆</a><a class="${route === 'progress' ? 'active' : ''}" href="#progress"><span class="nav-icon">▥</span>复习记录</a>`;
  $('#side-courses').innerHTML = modules.map(module => `<a href="#module/${module.id}"><b>${esc(module.code)}</b><span>${esc(module.title)}</span></a>`).join('');
  const pages = { home: renderHome, syllabus: renderSyllabus, practice: renderPractice, progress: renderProgress };
  let html;
  if (route === 'module') html = renderModule(id);
  else if (route === 'topic') html = renderTopic(id);
  else if (route === 'question') html = renderQuestion(id);
  else html = (pages[route] || renderHome)();
  $('#main').innerHTML = html;
  document.title = `${labels[route] || labels.home} · 知禾`;
  $('#sidebar').classList.remove('open');
  $('#menu-toggle').setAttribute('aria-expanded', 'false');
}

function renderQuestion(id) {
  const question = questionById(id);
  if (!question) return empty('没有找到这道练习', '请从对应考点重新进入。', '<a class="button" href="#home">返回总览</a>');
  practiceQuestionId = id;
  const module = moduleById(question.module);
  const review = reviewState(id);
  const dueDate = review?.due ? new Date(review.due).toLocaleString('zh-CN') : '首次练习';
  return `${head(`${esc(module.code)} · ${esc(module.title)}`, '考点练习', `来源：${esc(sourceLabel(question.sourceId))} · ${review ? `下次复习：${dueDate}` : '新卡片'}`, `<a class="button secondary" href="#topic/${question.pointId}">返回考点</a>`)}
    <section class="panel practice-card"><div class="tag-row"><span class="tag subtle">${esc(question.kind)}</span><span class="tag subtle">考纲 ${question.syllabusIds.map(id => esc(id)).join('、')}</span></div><h2>${esc(question.prompt)}</h2>
      <textarea class="answer-draft" data-draft="${esc(id)}" rows="6" maxlength="12000" placeholder="先写下你的答案或答题框架。">${esc(state.drafts[id] || '')}</textarea>
      ${answerShown ? `<div class="revealed"><h3>参考内容</h3><div class="answer-body">${esc(question.answer)}</div><p class="mapping-line"><b>对应考纲：</b>${question.syllabusIds.map(pointId => `<a href="#topic/${pointId}">${esc(pointById(pointId)?.section)}</a>`).join('、')}</p><p class="mapping-line"><b>资料来源：</b>${esc(sourceLabel(question.sourceId))}</p>
        <section class="variation-box"><h3>举一反三</h3><p>${esc(question.variationPrompt)}</p><textarea data-variation="${esc(id)}" rows="4" maxlength="6000" placeholder="尝试迁移到新的条件或情境。">${esc(state.variations?.[id] || '')}</textarea>${variationShown ? `<div class="variation-guide"><b>自查思路</b><p>${esc(question.variationGuide)}</p></div>` : button('展开自查思路', 'show-variation')}</section>
        <div class="grade-buttons">${[0, 1, 2, 3].map(quality => `<button class="grade" data-action="grade" data-id="${esc(id)}" data-quality="${quality}"><b>${['还不会', '有点模糊', '基本会答', '能举一反三'][quality]}</b><span>${['约10分钟后再练', '明天再练', '3天后再练', '7天后再练'][quality]}</span></button>`).join('')}</div></div>` : button('展开参考内容', 'reveal-answer', id)}
      <p class="fine-print">整理练习，非历年真题；主观题请按考纲和总结自我核对。</p></section>`;
}

function scheduleReview(previous, quality) {
  const now = Date.now();
  const stage = Math.min(5, Math.max(0, (previous?.stage || 0) + (quality === 0 ? -6 : quality === 1 ? 0 : quality === 2 ? 1 : 2)));
  const days = [1, 1, 3, 7, 14, 30][stage];
  return { stage, quality, due: now + (quality === 0 ? 10 * 60 * 1000 : days * 86400000), reviewedAt: now, count: (previous?.count || 0) + 1 };
}

function exportBackup() {
  const file = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `知禾学习备份-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('备份已导出。');
}

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action, id } = control.dataset;
  if (action === 'reveal-answer') { practiceQuestionId = id; answerShown = true; render(); return; }
  if (action === 'show-variation') { variationShown = true; render(); return; }
  if (action === 'grade') {
    const quality = Number(control.dataset.quality);
    state.reviews[id] = scheduleReview(state.reviews[id], quality);
    state.history.push({ id, quality, at: Date.now() });
    state.history = state.history.slice(-20000);
    saveState();
    const queue = practiceQueue();
    practiceQuestionId = queue[0]?.id || null;
    answerShown = false;
    variationShown = false;
    if (location.hash.startsWith('#practice')) render();
    else location.hash = 'practice';
    toast('已记录自评，系统安排了下次复习。');
    return;
  }
  if (action === 'export') { exportBackup(); return; }
  if (action === 'import') { $('#backup-file').click(); }
});

document.addEventListener('input', event => {
  const field = event.target;
  if (field.matches('[data-draft]')) {
    state.drafts[field.dataset.draft] = field.value;
    saveState();
  }
  if (field.matches('[data-note]')) {
    state.notes[field.dataset.note] = field.value;
    saveState();
  }
  if (field.matches('[data-variation]')) {
    state.variations ||= {};
    state.variations[field.dataset.variation] = field.value;
    saveState();
  }
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'goal-form') return;
  event.preventDefault();
  state.goal = Math.max(1, Math.min(100, Number(new FormData(event.target).get('goal')) || 12));
  saveState();
  toast('每日目标已更新。');
});

$('#backup-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (incoming.version !== 1 || typeof incoming.reviews !== 'object' || typeof incoming.notes !== 'object') throw new Error('文件不是知禾学习备份。');
    if (!confirm('导入备份将合并学习记录和个人笔记，继续吗？')) return;
    state.reviews = { ...state.reviews, ...incoming.reviews };
    state.drafts = { ...state.drafts, ...(incoming.drafts || {}) };
    state.notes = { ...state.notes, ...incoming.notes };
    state.variations = { ...state.variations, ...(incoming.variations || {}) };
    state.history = [...state.history, ...(incoming.history || [])].slice(-20000);
    state.goal = incoming.goal || state.goal;
    saveState();
    render();
    toast('学习备份已导入。');
  } catch (error) {
    toast(`导入失败：${error.message}`);
  } finally {
    event.target.value = '';
  }
});

$('#menu-toggle').addEventListener('click', () => {
  const open = $('#sidebar').classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') $('#sidebar').classList.remove('open');
});
window.addEventListener('hashchange', () => {
  answerShown = false;
  variationShown = false;
  render();
});

render();
