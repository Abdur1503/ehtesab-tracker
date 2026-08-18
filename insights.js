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
  renderWeekdayPanels();
  renderTagFrequency();
  renderMoodSpark();
  renderReadingStats();
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

  // Top negative tag
  const negCounts = {};
  dayKeys.forEach(key => (allData[key].negatives||[]).forEach(t => negCounts[t] = (negCounts[t]||0)+1));
  const topNeg = Object.entries(negCounts).sort((a,b)=>b[1]-a[1])[0];
  if(topNeg){
    bullets.push(`Your most logged slip is <strong>"${topNeg[0]}"</strong> — ${topNeg[1]} time${topNeg[1]>1?'s':''} so far.`);
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

  if(bullets.length === 0){
    bullets.push('Keep logging — patterns need a week or two of data to become clear.');
  }

  const list = document.getElementById('insightList');
  list.innerHTML = bullets.map(b => `<li>${b}</li>`).join('');
}
