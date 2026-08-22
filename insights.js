/* ---------- shared config (kept in sync with app.js) ---------- */
const PRAYERS = ['Fajr', 'Zohr', 'Asr', 'Maghrib', 'Isha'];
const STORAGE_KEY = 'ehtesab_days_v2';
const WEEKDAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function pad(n){ return n.toString().padStart(2, '0'); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromKey(k){ const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); }

function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

const allData = loadAll();
const dayKeys = Object.keys(allData).sort();
const today = new Date(); today.setHours(0,0,0,0);

function prayerDone(state){ return state && state !== 'none'; }

const HABITS = ['Gym', 'Upskilling'];
const READING = [{ key:'Book' }, { key:'Ayat' }];
const REVISION = ['Daily', 'Weekly', 'Monthly'];

function computeDayScore(day){
  let score = 0;
  PRAYERS.forEach(p => {
    const s = day.prayers && day.prayers[p];
    if(s === 'qazaa') score -= 1;
    else if(s === 'prayed') score += 1;
    else if(s === 'mosque') score += 2;
  });
  HABITS.forEach(h => { if(day.habits && day.habits[h]) score += 1; });
  READING.forEach(r => { if(day.reading && (day.reading[r.key]||0) > 0) score += 1; });
  REVISION.forEach(r => { if(day.revision && day.revision[r]) score += 1; });
  score -= (day.negatives || []).length;
  score += (day.positives || []).length;
  return score;
}

/* ---------- guard: no data yet ---------- */
if(dayKeys.length === 0){
  document.querySelector('main').innerHTML = `
    <div class="card">
      <p class="empty-note">No entries yet. Log a few days on the tracker and your patterns will show up here.</p>
      <p style="text-align:center;margin-top:10px;">
        <a href="index.html" class="insights-cta" style="border:none;">← Go log today</a>
      </p>
    </div>`;
} else {
  renderInsightText();
  renderScoreTrend();
  renderMonthCompare();
  renderStreakList();
  renderPrayerBreakdown();
  renderWeekdayPanels();
  renderRevisionPanel();
  renderTagFrequency();
  renderPosFrequency();
  renderMoodSpark();
  renderReadingStats();
  renderRevisionStats();
  renderMonthlyReport();
}

/* ---------- net score trend (last 14 days) ---------- */
function renderScoreTrend(){
  const el = document.getElementById('scoreTrend');
  el.innerHTML = '';
  const scores = [];
  for(let i = 13; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const day = allData[toKey(d)];
    scores.push({ date: d, score: day ? computeDayScore(day) : null });
  }
  const maxAbs = Math.max(1, ...scores.map(s => Math.abs(s.score || 0)));

  scores.forEach(({date, score}) => {
    const col = document.createElement('div');
    col.className = 'score-col';
    const baseline = document.createElement('div');
    baseline.className = 'score-baseline';
    const wrap = document.createElement('div');
    wrap.className = 'score-bar-wrap';
    if(score !== null && score !== 0){
      const bar = document.createElement('div');
      bar.className = 'score-bar ' + (score > 0 ? 'pos' : 'neg');
      const pct = (Math.abs(score) / maxAbs) * 48; // max 48% of half-height
      bar.style.height = `${pct}%`;
      wrap.appendChild(bar);
    }
    const label = document.createElement('span');
    label.className = 'score-date';
    label.textContent = `${date.getDate()}`;
    col.append(baseline, wrap, label);
    el.appendChild(col);
  });
}

/* ---------- month-over-month net score comparison ---------- */
function monthTotalScore(year, month){
  let total = 0, any = false;
  dayKeys.forEach(key => {
    const d = fromKey(key);
    if(d.getFullYear() === year && d.getMonth() === month){
      total += computeDayScore(allData[key]);
      any = true;
    }
  });
  return any ? total : null;
}

function renderMonthCompare(){
  const el = document.getElementById('monthCompare');
  const thisMonth = monthTotalScore(today.getFullYear(), today.getMonth());
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonth = monthTotalScore(lastMonthDate.getFullYear(), lastMonthDate.getMonth());

  const fmt = v => v === null ? '—' : (v > 0 ? `+${v}` : `${v}`);
  let deltaNote = '';
  if(thisMonth !== null && lastMonth !== null){
    const delta = thisMonth - lastMonth;
    deltaNote = delta === 0 ? 'same as last month' : (delta > 0 ? `up ${delta} from last month` : `down ${Math.abs(delta)} from last month`);
  }

  el.innerHTML = `
    <div class="stat-card"><span class="stat-num">${fmt(thisMonth)}</span><span class="stat-label">this month${deltaNote ? ' — ' + deltaNote : ''}</span></div>
    <div class="stat-card"><span class="stat-num">${fmt(lastMonth)}</span><span class="stat-label">last month</span></div>
  `;
}

/* ---------- per-habit streaks ---------- */
function currentStreakFor(doneFn){
  let streak = 0;
  let cursor = new Date(today);
  const todayDay = allData[toKey(today)];
  if(!(todayDay && doneFn(todayDay))) cursor.setDate(cursor.getDate() - 1);
  while(true){
    const day = allData[toKey(cursor)];
    if(day && doneFn(day)){ streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}
function bestStreakFor(doneFn){
  let best = 0, run = 0, prev = null;
  dayKeys.forEach(key => {
    const day = allData[key];
    const done = day && doneFn(day);
    if(done){
      if(prev){
        const diff = Math.round((fromKey(key) - fromKey(prev)) / 86400000);
        run = diff === 1 ? run + 1 : 1;
      } else run = 1;
      best = Math.max(best, run);
      prev = key;
    } else { run = 0; prev = null; }
  });
  return Math.max(best, currentStreakFor(doneFn));
}

function renderStreakList(){
  const items = [
    { name: 'Gym', doneFn: day => !!(day.habits && day.habits['Gym']) },
    { name: 'Upskilling', doneFn: day => !!(day.habits && day.habits['Upskilling']) },
    { name: 'Book reading', doneFn: day => !!(day.reading && day.reading['Book'] > 0) },
    { name: 'Ayat reading', doneFn: day => !!(day.reading && day.reading['Ayat'] > 0) },
    { name: 'Daily revision', doneFn: day => !!(day.revision && day.revision['Daily']) },
  ];
  const list = document.getElementById('streakList');
  list.innerHTML = '';
  items.forEach(({name, doneFn}) => {
    const cur = currentStreakFor(doneFn);
    const best = bestStreakFor(doneFn);
    const row = document.createElement('div');
    row.className = 'streak-row';
    row.innerHTML = `
      <span class="streak-row-name">${name}</span>
      <div class="streak-row-nums">
        <div class="streak-row-num"><span>${cur}</span><label>current</label></div>
        <div class="streak-row-num"><span>${best}</span><label>best</label></div>
      </div>
    `;
    list.appendChild(row);
  });
}

/* ---------- weekday helpers ---------- */
function weekdayAverages(fractionFn){
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  dayKeys.forEach(key => {
    const wd = fromKey(key).getDay();
    const day = allData[key];
    sums[wd] += fractionFn(day);
    counts[wd]++;
  });
  return sums.map((s,i) => counts[i] ? s / counts[i] : 0);
}

function renderBars(containerId, values, negative){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  values.forEach((v, i) => {
    const col = document.createElement('div');
    col.className = 'weekday-col';
    const track = document.createElement('div');
    track.className = 'weekday-bar-track';
    const fill = document.createElement('div');
    fill.className = 'weekday-bar-fill' + (negative ? ' neg' : '');
    fill.style.height = `${Math.round(v*100)}%`;
    track.appendChild(fill);
    const label = document.createElement('span');
    label.className = 'weekday-label';
    label.textContent = WEEKDAY_NAMES[i];
    col.append(track, label);
    el.appendChild(col);
  });
}

/* ---------- weekly rhythm panels ---------- */
function renderWeekdayPanels(){
  const gymVals = weekdayAverages(day => day.habits && day.habits['Gym'] ? 1 : 0);
  renderBars('gymBars', gymVals, false);
  document.getElementById('gymRateLabel').textContent =
    `${(gymVals.reduce((a,b)=>a+b,0)).toFixed(1)} days/week avg`;

  const upVals = weekdayAverages(day => day.habits && day.habits['Upskilling'] ? 1 : 0);
  renderBars('upskillBars', upVals, false);
  document.getElementById('upskillRateLabel').textContent =
    `${(upVals.reduce((a,b)=>a+b,0)).toFixed(1)} days/week avg`;

  const onTimeVals = weekdayAverages(day => {
    const n = PRAYERS.filter(p => ['prayed','mosque'].includes(day.prayers && day.prayers[p])).length;
    return n / PRAYERS.length;
  });
  renderBars('onTimeBars', onTimeVals, false);

  const qazaaVals = weekdayAverages(day => {
    const n = PRAYERS.filter(p => day.prayers && day.prayers[p] === 'qazaa').length;
    return n / PRAYERS.length;
  });
  renderBars('qazaaBars', qazaaVals, true);
}

/* ---------- per-prayer breakdown ---------- */
function renderPrayerBreakdown(){
  const el = document.getElementById('prayerBreakdownRows');
  el.innerHTML = '';
  const total = dayKeys.length;
  PRAYERS.forEach(name => {
    let mosque = 0, prayed = 0, qazaa = 0;
    dayKeys.forEach(key => {
      const s = allData[key].prayers && allData[key].prayers[name];
      if(s === 'mosque') mosque++;
      else if(s === 'prayed') prayed++;
      else if(s === 'qazaa') qazaa++;
    });
    const mosquePct = total ? (mosque/total)*100 : 0;
    const prayedPct = total ? (prayed/total)*100 : 0;
    const qazaaPct = total ? (qazaa/total)*100 : 0;

    const row = document.createElement('div');
    row.className = 'pb-row';
    row.innerHTML = `
      <div class="pb-row-head">
        <span>${name}</span>
        <span class="pb-pct">${Math.round(qazaaPct)}% qazaa</span>
      </div>
      <div class="pb-track">
        <div class="pb-seg-mosque" style="width:${mosquePct}%"></div>
        <div class="pb-seg-prayed" style="width:${prayedPct}%"></div>
        <div class="pb-seg-qazaa" style="width:${qazaaPct}%"></div>
      </div>
    `;
    el.appendChild(row);
  });
}

/* ---------- negative tag frequency ---------- */
function renderTagFrequency(){
  const counts = {};
  dayKeys.forEach(key => {
    const day = allData[key];
    (day.negatives || []).forEach(tag => { counts[tag] = (counts[tag]||0) + 1; });
  });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const list = document.getElementById('tagFreqList');
  list.innerHTML = '';
  if(entries.length === 0){
    list.innerHTML = '<p class="empty-note">No slips logged yet — nice, or you just haven\'t tagged any.</p>';
    return;
  }
  const max = entries[0][1];
  entries.forEach(([tag, count]) => {
    const row = document.createElement('div');
    row.className = 'tag-freq-row';
    row.innerHTML = `
      <span class="tag-freq-name">${tag}</span>
      <span class="tag-freq-track"><span class="tag-freq-fill" style="width:${(count/max)*100}%"></span></span>
      <span class="tag-freq-count">${count}</span>
    `;
    list.appendChild(row);
  });
}

/* ---------- positive tag frequency ---------- */
function renderPosFrequency(){
  const counts = {};
  dayKeys.forEach(key => {
    const day = allData[key];
    (day.positives || []).forEach(tag => { counts[tag] = (counts[tag]||0) + 1; });
  });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const list = document.getElementById('posFreqList');
  list.innerHTML = '';
  if(entries.length === 0){
    list.innerHTML = '<p class="empty-note">No boosts logged yet — tag a few wins on the tracker page.</p>';
    return;
  }
  const max = entries[0][1];
  entries.forEach(([tag, count]) => {
    const row = document.createElement('div');
    row.className = 'tag-freq-row';
    row.innerHTML = `
      <span class="tag-freq-name">${tag}</span>
      <span class="tag-freq-track"><span class="tag-freq-fill pos-fill" style="width:${(count/max)*100}%"></span></span>
      <span class="tag-freq-count">${count}</span>
    `;
    list.appendChild(row);
  });
}

/* ---------- mood sparkline ---------- */
function renderMoodSpark(){
  const el = document.getElementById('moodSpark');
  el.innerHTML = '';
  for(let i = 13; i >= 0; i--){
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toKey(d);
    const day = allData[key];
    const mood = day ? (day.mood || 0) : 0;
    const col = document.createElement('div');
    col.className = 'spark-col';
    const bar = document.createElement('div');
    bar.className = 'spark-bar' + (mood > 0 ? ' has-mood' : '');
    bar.style.height = mood > 0 ? `${(mood/5)*100}%` : '4%';
    const label = document.createElement('span');
    label.className = 'spark-date';
    label.textContent = `${d.getDate()}`;
    col.append(bar, label);
    el.appendChild(col);
  }
}

/* ---------- revision panel ---------- */
function renderRevisionPanel(){
  const vals = weekdayAverages(day => day.revision && day.revision['Daily'] ? 1 : 0);
  renderBars('revisionBars', vals, false);
  const rate = vals.reduce((a,b)=>a+b,0);
  document.getElementById('revisionRateLabel').textContent = `${rate.toFixed(1)} days/week avg`;
}

function renderRevisionStats(){
  const year = today.getFullYear(), month = today.getMonth();
  let daily = 0, weekly = 0, monthly = 0;
  dayKeys.forEach(key => {
    const d = fromKey(key);
    if(d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = allData[key];
    if(day.revision){
      if(day.revision.Daily) daily++;
      if(day.revision.Weekly) weekly++;
      if(day.revision.Monthly) monthly++;
    }
  });
  const el = document.getElementById('revisionStats');
  el.innerHTML = `
    <div class="stat-card"><span class="stat-num">${daily}</span><span class="stat-label">daily revisions logged</span></div>
    <div class="stat-card"><span class="stat-num">${weekly}</span><span class="stat-label">weekly revisions logged</span></div>
    <div class="stat-card"><span class="stat-num">${monthly}</span><span class="stat-label">monthly revisions logged</span></div>
  `;
}

/* ---------- reading stats, this month ---------- */
function renderReadingStats(){
  const year = today.getFullYear(), month = today.getMonth();
  let pages = 0, ayat = 0, daysWithReading = 0;
  dayKeys.forEach(key => {
    const d = fromKey(key);
    if(d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = allData[key];
    const p = (day.reading && day.reading.Book) || 0;
    const a = (day.reading && day.reading.Ayat) || 0;
    pages += p; ayat += a;
    if(p > 0 || a > 0) daysWithReading++;
  });
  const el = document.getElementById('readingStats');
  el.innerHTML = `
    <div class="stat-card"><span class="stat-num">${pages}</span><span class="stat-label">pages read</span></div>
    <div class="stat-card"><span class="stat-num">${ayat}</span><span class="stat-label">ayat read</span></div>
    <div class="stat-card"><span class="stat-num">${daysWithReading}</span><span class="stat-label">days with reading</span></div>
  `;
}

/* ---------- auto-generated insight bullets ---------- */
function renderInsightText(){
  const bullets = [];

  // Gym pattern
  const gymVals = weekdayAverages(day => day.habits && day.habits['Gym'] ? 1 : 0);
  const gymWeeklyRate = gymVals.reduce((a,b)=>a+b,0);
  const gymDays = WEEKDAY_NAMES.filter((_,i) => gymVals[i] >= 0.5);
  if(gymWeeklyRate > 0){
    bullets.push(`You hit the gym about <strong>${gymWeeklyRate.toFixed(1)} days a week</strong>${gymDays.length ? `, most consistently on <strong>${gymDays.join(', ')}</strong>` : ''}.`);
  }

  // Qazaa pattern
  const qazaaVals = weekdayAverages(day => {
    const n = PRAYERS.filter(p => day.prayers && day.prayers[p] === 'qazaa').length;
    return n / PRAYERS.length;
  });
  const worstQazaaIdx = qazaaVals.indexOf(Math.max(...qazaaVals));
  if(qazaaVals[worstQazaaIdx] > 0){
    bullets.push(`Prayers most often become <strong>qazaa on ${WEEKDAY_NAMES[worstQazaaIdx]}</strong> — worth a closer look at what's different about that day.`);
  }

  // Mosque rate
  let mosqueCount = 0, prayerTotal = 0;
  dayKeys.forEach(key => {
    const day = allData[key];
    PRAYERS.forEach(p => {
      const s = day.prayers && day.prayers[p];
      if(s && s !== 'none'){ prayerTotal++; if(s === 'mosque') mosqueCount++; }
    });
  });
  if(prayerTotal > 0){
    bullets.push(`<strong>${Math.round((mosqueCount/prayerTotal)*100)}%</strong> of your logged prayers were in the mosque.`);
  }

  // Weakest specific prayer (highest qazaa rate)
  const total = dayKeys.length;
  if(total > 0){
    let weakest = null, weakestRate = 0;
    PRAYERS.forEach(name => {
      const qazaaCount = dayKeys.filter(key => allData[key].prayers && allData[key].prayers[name] === 'qazaa').length;
      const rate = qazaaCount / total;
      if(rate > weakestRate){ weakestRate = rate; weakest = name; }
    });
    if(weakest){
      bullets.push(`<strong>${weakest}</strong> is your prayer most often marked qazaa — <strong>${Math.round(weakestRate*100)}%</strong> of logged days.`);
    }
  }

  // Top negative tag
  const negCounts = {};
  dayKeys.forEach(key => (allData[key].negatives||[]).forEach(t => negCounts[t] = (negCounts[t]||0)+1));
  const topNeg = Object.entries(negCounts).sort((a,b)=>b[1]-a[1])[0];
  if(topNeg){
    bullets.push(`Your most logged slip is <strong>"${topNeg[0]}"</strong> — ${topNeg[1]} time${topNeg[1]>1?'s':''} so far.`);
  }

  // Top positive tag
  const posCounts = {};
  dayKeys.forEach(key => (allData[key].positives||[]).forEach(t => posCounts[t] = (posCounts[t]||0)+1));
  const topPos = Object.entries(posCounts).sort((a,b)=>b[1]-a[1])[0];
  if(topPos){
    bullets.push(`Your most logged boost is <strong>"${topPos[0]}"</strong> — ${topPos[1]} time${topPos[1]>1?'s':''} so far.`);
  }

  // Mood trend, last 7 vs previous 7
  const moodVal = (offsetStart, offsetEnd) => {
    let sum = 0, n = 0;
    for(let i = offsetStart; i < offsetEnd; i++){
      const d = new Date(today); d.setDate(d.getDate() - i);
      const day = allData[toKey(d)];
      if(day && day.mood){ sum += day.mood; n++; }
    }
    return n ? sum/n : null;
  };
  const recentMood = moodVal(0, 7);
  const priorMood = moodVal(7, 14);
  if(recentMood !== null && priorMood !== null){
    if(recentMood > priorMood + 0.3){
      bullets.push(`Your logged mood is <strong>trending up</strong> this week compared to last.`);
    } else if(recentMood < priorMood - 0.3){
      bullets.push(`Your logged mood dipped a bit this week — worth checking what changed.`);
    }
  }

  // Revision consistency
  const revisionVals = weekdayAverages(day => day.revision && day.revision['Daily'] ? 1 : 0);
  const revisionRate = revisionVals.reduce((a,b)=>a+b,0);
  if(revisionRate > 0){
    bullets.push(`You log daily revision about <strong>${revisionRate.toFixed(1)} days a week</strong>.`);
  }

  if(bullets.length === 0){
    bullets.push('Keep logging — patterns need a week or two of data to become clear.');
  }

  const list = document.getElementById('insightList');
  list.innerHTML = bullets.map(b => `<li>${b}</li>`).join('');
}

/* ================= MONTHLY REPORT ================= */
let reportMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function monthKeysFor(year, month){
  return dayKeys.filter(k => {
    const d = fromKey(k);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function computeMonthlyReportData(year, month){
  const keys = monthKeysFor(year, month).sort();
  const total = keys.length;
  const daysInCalendarMonth = new Date(year, month + 1, 0).getDate();

  let netScoreTotal = 0;
  let prayerLogged = 0, mosque = 0, prayed = 0, qazaa = 0;
  let moodSum = 0, moodCount = 0;
  let pagesRead = 0, ayatRead = 0, daysWithReading = 0;
  let dailyRevision = 0, weeklyRevision = 0, monthlyRevision = 0;
  const negCounts = {}, posCounts = {};
  const perPrayer = {};
  PRAYERS.forEach(p => perPrayer[p] = { mosque:0, prayed:0, qazaa:0 });

  keys.forEach(key => {
    const day = allData[key];
    netScoreTotal += computeDayScore(day);

    PRAYERS.forEach(p => {
      const s = day.prayers && day.prayers[p];
      if(s && s !== 'none'){
        prayerLogged++;
        if(s === 'mosque'){ mosque++; perPrayer[p].mosque++; }
        else if(s === 'prayed'){ prayed++; perPrayer[p].prayed++; }
        else if(s === 'qazaa'){ qazaa++; perPrayer[p].qazaa++; }
      }
    });

    if(day.mood){ moodSum += day.mood; moodCount++; }

    const p = (day.reading && day.reading.Book) || 0;
    const a = (day.reading && day.reading.Ayat) || 0;
    pagesRead += p; ayatRead += a;
    if(p > 0 || a > 0) daysWithReading++;

    if(day.revision){
      if(day.revision.Daily) dailyRevision++;
      if(day.revision.Weekly) weeklyRevision++;
      if(day.revision.Monthly) monthlyRevision++;
    }

    (day.negatives||[]).forEach(t => negCounts[t] = (negCounts[t]||0)+1);
    (day.positives||[]).forEach(t => posCounts[t] = (posCounts[t]||0)+1);
  });

  return {
    year, month, keys, total, daysInCalendarMonth,
    netScoreTotal,
    prayerCompletionPct: total ? Math.round((prayerLogged/(PRAYERS.length*total))*100) : 0,
    mosquePct: prayerLogged ? Math.round((mosque/prayerLogged)*100) : 0,
    qazaaPct: prayerLogged ? Math.round((qazaa/prayerLogged)*100) : 0,
    moodAvg: moodCount ? (moodSum/moodCount) : null,
    perPrayer,
    topSlips: Object.entries(negCounts).sort((a,b)=>b[1]-a[1]).slice(0,8),
    topBoosts: Object.entries(posCounts).sort((a,b)=>b[1]-a[1]).slice(0,8),
    pagesRead, ayatRead, daysWithReading,
    dailyRevision, weeklyRevision, monthlyRevision
  };
}

function renderMonthlyReport(){
  const data = computeMonthlyReportData(reportMonth.getFullYear(), reportMonth.getMonth());

  document.getElementById('reportMonthLabel').textContent =
    reportMonth.toLocaleDateString(undefined, { month:'long', year:'numeric' });

  document.getElementById('reportSummaryStats').innerHTML = `
    <div class="stat-card"><span class="stat-num">${data.total}</span><span class="stat-label">days logged</span></div>
    <div class="stat-card"><span class="stat-num">${data.netScoreTotal > 0 ? '+' : ''}${data.netScoreTotal}</span><span class="stat-label">net score total</span></div>
    <div class="stat-card"><span class="stat-num">${data.prayerCompletionPct}%</span><span class="stat-label">prayer completion</span></div>
    <div class="stat-card"><span class="stat-num">${data.mosquePct}%</span><span class="stat-label">mosque rate</span></div>
    <div class="stat-card"><span class="stat-num">${data.moodAvg !== null ? data.moodAvg.toFixed(1) : '—'}</span><span class="stat-label">avg mood /5</span></div>
  `;

  const pbEl = document.getElementById('reportPrayerBreakdown');
  pbEl.innerHTML = '';
  PRAYERS.forEach(name => {
    const pd = data.perPrayer[name];
    const t = data.total || 1;
    const mosquePct = (pd.mosque/t)*100, prayedPct = (pd.prayed/t)*100, qazaaPct = (pd.qazaa/t)*100;
    const row = document.createElement('div');
    row.className = 'pb-row';
    row.innerHTML = `
      <div class="pb-row-head">
        <span>${name}</span>
        <span class="pb-pct">${data.total ? Math.round((pd.qazaa/data.total)*100) : 0}% qazaa</span>
      </div>
      <div class="pb-track">
        <div class="pb-seg-mosque" style="width:${mosquePct}%"></div>
        <div class="pb-seg-prayed" style="width:${prayedPct}%"></div>
        <div class="pb-seg-qazaa" style="width:${qazaaPct}%"></div>
      </div>
    `;
    pbEl.appendChild(row);
  });

  function renderTagList(elId, entries, positive){
    const el = document.getElementById(elId);
    el.innerHTML = '';
    if(entries.length === 0){
      el.innerHTML = `<p class="empty-note">None logged this month.</p>`;
      return;
    }
    const max = entries[0][1];
    entries.forEach(([tag, count]) => {
      const row = document.createElement('div');
      row.className = 'tag-freq-row';
      row.innerHTML = `
        <span class="tag-freq-name">${tag}</span>
        <span class="tag-freq-track"><span class="tag-freq-fill${positive ? ' pos-fill' : ''}" style="width:${(count/max)*100}%"></span></span>
        <span class="tag-freq-count">${count}</span>
      `;
      el.appendChild(row);
    });
  }
  renderTagList('reportSlips', data.topSlips, false);
  renderTagList('reportBoosts', data.topBoosts, true);

  document.getElementById('reportReadingRevision').innerHTML = `
    <div class="stat-card"><span class="stat-num">${data.pagesRead}</span><span class="stat-label">pages read</span></div>
    <div class="stat-card"><span class="stat-num">${data.ayatRead}</span><span class="stat-label">ayat read</span></div>
    <div class="stat-card"><span class="stat-num">${data.dailyRevision}</span><span class="stat-label">daily revisions</span></div>
    <div class="stat-card"><span class="stat-num">${data.weeklyRevision}</span><span class="stat-label">weekly revisions</span></div>
    <div class="stat-card"><span class="stat-num">${data.monthlyRevision}</span><span class="stat-label">monthly revisions</span></div>
  `;
}

document.getElementById('prevReportMonth').onclick = () => {
  reportMonth = new Date(reportMonth.getFullYear(), reportMonth.getMonth() - 1, 1);
  renderMonthlyReport();
};
document.getElementById('nextReportMonth').onclick = () => {
  reportMonth = new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1, 1);
  renderMonthlyReport();
};

/* ---------- lazy script loading for export libraries ---------- */
function loadScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)){ resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

const exportStatus = document.getElementById('exportStatus');
function setStatus(msg){ exportStatus.textContent = msg; }

/* ---------- Excel export ---------- */
document.getElementById('exportExcelBtn').onclick = async () => {
  try{
    setStatus('Loading export tools…');
    if(typeof XLSX === 'undefined'){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }
    setStatus('Building spreadsheet…');

    const data = computeMonthlyReportData(reportMonth.getFullYear(), reportMonth.getMonth());
    const monthName = reportMonth.toLocaleDateString(undefined, { month:'long', year:'numeric' });

    const summaryRows = [
      ['Ehtesab — Monthly Report', monthName],
      [],
      ['Metric', 'Value'],
      ['Days logged', data.total],
      ['Net score total', data.netScoreTotal],
      ['Prayer completion %', data.prayerCompletionPct],
      ['Mosque rate % (of logged prayers)', data.mosquePct],
      ['Qazaa rate % (of logged prayers)', data.qazaaPct],
      ['Average mood (/5)', data.moodAvg !== null ? Number(data.moodAvg.toFixed(2)) : ''],
      ['Pages read', data.pagesRead],
      ['Ayat read', data.ayatRead],
      ['Days with reading', data.daysWithReading],
      ['Daily revisions logged', data.dailyRevision],
      ['Weekly revisions logged', data.weeklyRevision],
      ['Monthly revisions logged', data.monthlyRevision],
      [],
      ['Prayer breakdown', 'Mosque', 'Prayed', 'Qazaa', '% Qazaa'],
      ...PRAYERS.map(p => {
        const pd = data.perPrayer[p];
        return [p, pd.mosque, pd.prayed, pd.qazaa, data.total ? Math.round((pd.qazaa/data.total)*100) + '%' : '0%'];
      }),
      [],
      ['Top slips', 'Count'],
      ...(data.topSlips.length ? data.topSlips : [['—', '']]),
      [],
      ['Top boosts', 'Count'],
      ...(data.topBoosts.length ? data.topBoosts : [['—', '']]),
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet['!cols'] = [{wch:26},{wch:14},{wch:10},{wch:10},{wch:10}];

    const logHeader = ['Date','Weekday','Fajr','Zohr','Asr','Maghrib','Isha','Gym','Upskilling',
      'Book (pages)','Ayat','Daily Revision','Weekly Revision','Monthly Revision',
      'Negatives','Positives','Mood (/5)','Went well','Pulled off track','Net score'];
    const logRows = [logHeader];
    for(let d = 1; d <= data.daysInCalendarMonth; d++){
      const cellDate = new Date(data.year, data.month, d);
      const key = toKey(cellDate);
      const day = allData[key];
      if(!day){
        logRows.push([key, WEEKDAY_NAMES[cellDate.getDay()], '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        continue;
      }
      logRows.push([
        key,
        WEEKDAY_NAMES[cellDate.getDay()],
        day.prayers.Fajr, day.prayers.Zohr, day.prayers.Asr, day.prayers.Maghrib, day.prayers.Isha,
        day.habits.Gym ? 'Yes' : 'No',
        day.habits.Upskilling ? 'Yes' : 'No',
        day.reading.Book || 0,
        day.reading.Ayat || 0,
        day.revision && day.revision.Daily ? 'Yes' : 'No',
        day.revision && day.revision.Weekly ? 'Yes' : 'No',
        day.revision && day.revision.Monthly ? 'Yes' : 'No',
        (day.negatives||[]).join(', '),
        (day.positives||[]).join(', '),
        day.mood || '',
        day.win || '',
        day.slip || '',
        computeDayScore(day)
      ]);
    }
    const logSheet = XLSX.utils.aoa_to_sheet(logRows);
    logSheet['!cols'] = logHeader.map(h => ({ wch: Math.max(10, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
    XLSX.utils.book_append_sheet(wb, logSheet, 'Daily Log');

    const filename = `ehtesab-report-${data.year}-${String(data.month+1).padStart(2,'0')}.xlsx`;
    XLSX.writeFile(wb, filename);
    setStatus('Downloaded ' + filename);
  }catch(err){
    console.error(err);
    setStatus('Export failed — check your internet connection and try again.');
  }
};

/* ---------- Image export ---------- */
document.getElementById('exportImageBtn').onclick = async () => {
  try{
    setStatus('Loading export tools…');
    if(typeof html2canvas === 'undefined'){
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    setStatus('Rendering image…');

    const node = document.getElementById('monthlyReportCard');
    const canvas = await html2canvas(node, {
      backgroundColor: '#141A2E',
      scale: 2,
      useCORS: true,
      ignoreElements: (el) => el.classList && (el.classList.contains('report-export-row') || el.classList.contains('export-status'))
    });
    const data = computeMonthlyReportData(reportMonth.getFullYear(), reportMonth.getMonth());
    const filename = `ehtesab-report-${data.year}-${String(data.month+1).padStart(2,'0')}.png`;

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('Downloaded ' + filename);
    }, 'image/png');
  }catch(err){
    console.error(err);
    setStatus('Export failed — check your internet connection and try again.');
  }
};
