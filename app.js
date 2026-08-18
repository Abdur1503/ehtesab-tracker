/* ---------- config ---------- */
const PRAYERS = ['Fajr', 'Zohr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_STATES = ['qazaa', 'prayed', 'mosque']; // 'none' is the unset default
const HABITS  = ['Gym', 'Upskilling'];
const READING = [
  { key: 'Book', label: 'Book', unit: 'pages' },
  { key: 'Ayat', label: 'Ayat', unit: 'ayat' }
];
const REVISION = ['Daily', 'Weekly', 'Monthly'];
const DEFAULT_NEGATIVES = ['Missed Fajr', 'Junk food', 'Doomscrolling', 'Procrastinated', 'Lost temper', 'Skipped gym', 'M'];

const STORAGE_KEY = 'ehtesab_days_v2';
const OLD_STORAGE_KEY = 'ehtesab_days_v1'; // v1: boolean prayers, single reflection field
const CUSTOM_NEG_KEY = 'ehtesab_custom_negatives_v1';
const MILESTONES = [3, 7, 14, 30, 60, 100];
const ARC_CAP = 30; // streak length at which the arc reads "full"
const TOTAL_ITEMS = PRAYERS.length + HABITS.length + READING.length + REVISION.length; // 12

/* ---------- date helpers ---------- */
function pad(n){ return n.toString().padStart(2, '0'); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromKey(k){ const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); }
function isSameDay(a,b){ return toKey(a) === toKey(b); }

const today = new Date();
today.setHours(0,0,0,0);

let selectedOffset = 0; // 0 = today, 1 = yesterday
function selectedDate(){
  const d = new Date(today);
  d.setDate(d.getDate() - selectedOffset);
  return d;
}

/* ---------- state ---------- */
function emptyDay(){
  const prayers = {}; PRAYERS.forEach(p => prayers[p] = 'none');
  const habits = {}; HABITS.forEach(h => habits[h] = false);
  const reading = {}; READING.forEach(r => reading[r.key] = 0);
  const revision = {}; REVISION.forEach(r => revision[r] = false);
  return { prayers, habits, reading, revision, negatives: [], mood: 0, win: '', slip: '' };
}

function migrateFromV1(){
  try{
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if(!raw) return {};
    const old = JSON.parse(raw);
    const migrated = {};
    Object.keys(old).forEach(key => {
      const oldDay = old[key];
      const day = emptyDay();
      PRAYERS.forEach(p => { day.prayers[p] = oldDay.prayers && oldDay.prayers[p] ? 'prayed' : 'none'; });
      HABITS.forEach(h => { day.habits[h] = !!(oldDay.habits && oldDay.habits[h]); });
      // old 'Book' and 'Ayat' habit booleans -> nominal counts
      if(oldDay.habits && oldDay.habits['Book']) day.reading['Book'] = 1;
      if(oldDay.habits && oldDay.habits['Ayat']) day.reading['Ayat'] = 1;
      day.win = oldDay.reflection || '';
      migrated[key] = day;
    });
    return migrated;
  }catch(e){ return {}; }
}

function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
    // no v2 data yet — attempt a one-time migration from v1
    const migrated = migrateFromV1();
    if(Object.keys(migrated).length){ saveAll(migrated); }
    return migrated;
  }catch(e){ return {}; }
}
function saveAll(data){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch(e){ console.error('Could not save — storage may be full or blocked.', e); }
}

function loadCustomNegatives(){
  try{
    const raw = localStorage.getItem(CUSTOM_NEG_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveCustomNegatives(list){
  try{ localStorage.setItem(CUSTOM_NEG_KEY, JSON.stringify(list)); }catch(e){}
}

let allData = loadAll();
let customNegatives = loadCustomNegatives();
let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function negativeOptions(){
  const custom = customNegatives.filter(n => !DEFAULT_NEGATIVES.includes(n));
  return [...DEFAULT_NEGATIVES, ...custom];
}

function getDay(key){
  if(!allData[key]) allData[key] = emptyDay();
  const fresh = emptyDay();
  const d = allData[key];
  d.prayers  = { ...fresh.prayers,  ...(d.prayers||{}) };
  d.habits   = { ...fresh.habits,   ...(d.habits||{}) };
  d.reading  = { ...fresh.reading,  ...(d.reading||{}) };
  d.revision = { ...fresh.revision, ...(d.revision||{}) };
  d.negatives = Array.isArray(d.negatives) ? d.negatives : [];
  d.mood = typeof d.mood === 'number' ? d.mood : 0;
  d.win = d.win || '';
  d.slip = d.slip || '';
  return d;
}

function prayerDone(state){ return state && state !== 'none'; }
function countChecked(day){
  const p = PRAYERS.filter(k => prayerDone(day.prayers[k])).length;
  const h = HABITS.filter(k => day.habits[k]).length;
  const r = READING.filter(r => (day.reading[r.key]||0) > 0).length;
  const v = REVISION.filter(k => day.revision[k]).length;
  return p + h + r + v;
}

/* ---------- net score ----------
   Prayed = +1, Mosque = +2, Qazaa = -1, none = 0
   Habit done = +1 each. Reading logged (>0) = +1 each.
   Revision checked = +1 each. Each negative tag = -1.
*/
function computeDayScore(day){
  let score = 0;
  PRAYERS.forEach(p => {
    const s = day.prayers[p];
    if(s === 'qazaa') score -= 1;
    else if(s === 'prayed') score += 1;
    else if(s === 'mosque') score += 2;
  });
  HABITS.forEach(h => { if(day.habits[h]) score += 1; });
  READING.forEach(r => { if((day.reading[r.key]||0) > 0) score += 1; });
  REVISION.forEach(r => { if(day.revision[r]) score += 1; });
  score -= (day.negatives || []).length;
  return score;
}
function allPrayersDone(day){
  return PRAYERS.every(k => prayerDone(day.prayers[k]));
}
function hasSlip(day){
  return day.negatives.length > 0 || PRAYERS.some(k => day.prayers[k] === 'qazaa');
}

/* ---------- streak calculation ---------- */
function currentStreak(){
  let streak = 0;
  let cursor = new Date(today);
  const todayKey = toKey(today);
  const todayDone = allData[todayKey] && allPrayersDone(allData[todayKey]);
  if(!todayDone) cursor.setDate(cursor.getDate() - 1);
  while(true){
    const key = toKey(cursor);
    const day = allData[key];
    if(day && allPrayersDone(day)){
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}
function bestStreakEver(){
  const keys = Object.keys(allData).sort();
  let best = 0, run = 0, prev = null;
  keys.forEach(k => {
    const day = allData[k];
    const done = day && allPrayersDone(day);
    if(done){
      if(prev){
        const diffDays = Math.round((fromKey(k) - fromKey(prev)) / 86400000);
        run = diffDays === 1 ? run + 1 : 1;
      } else run = 1;
      best = Math.max(best, run);
      prev = k;
    } else {
      run = 0; prev = null;
    }
  });
  return Math.max(best, currentStreak());
}

/* ---------- rendering: today card ---------- */
const prayerList = document.getElementById('prayerList');
const habitRow  = document.getElementById('habitRow');
const readingRow = document.getElementById('readingRow');
const revisionRow = document.getElementById('revisionRow');
const negativeRow = document.getElementById('negativeRow');
const moodRow = document.getElementById('moodRow');
const winField = document.getElementById('winField');
const slipField = document.getElementById('slipField');
const todayLabel = document.getElementById('todayLabel');
const todayProgress = document.getElementById('todayProgress');
const todayScore = document.getElementById('todayScore');
const dayToggle = document.getElementById('dayToggle');

dayToggle.querySelectorAll('button').forEach(btn => {
  btn.onclick = () => {
    selectedOffset = Number(btn.dataset.offset);
    renderAll();
  };
});

const STATE_LABEL = { qazaa: 'Qazaa', prayed: 'Prayed', mosque: 'Mosque' };
const MOODS = ['😞','🙁','😐','🙂','😄'];

function renderPrayers(){
  const key = toKey(selectedDate());
  const day = getDay(key);
  prayerList.innerHTML = '';

  PRAYERS.forEach(name => {
    const row = document.createElement('div');
    row.className = 'prayer-item';

    const label = document.createElement('span');
    label.className = 'prayer-name';
    label.textContent = name;
    row.appendChild(label);

    const btnWrap = document.createElement('div');
    btnWrap.className = 'prayer-states';
    PRAYER_STATES.forEach(state => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `state-btn state-${state}` + (day.prayers[name] === state ? ' on' : '');
      btn.textContent = STATE_LABEL[state];
      btn.setAttribute('aria-pressed', day.prayers[name] === state ? 'true' : 'false');
      btn.onclick = () => {
        day.prayers[name] = (day.prayers[name] === state) ? 'none' : state;
        saveAll(allData);
        renderAll();
      };
      btnWrap.appendChild(btn);
    });
    row.appendChild(btnWrap);
    prayerList.appendChild(row);
  });
}

function renderHabits(){
  const day = getDay(toKey(selectedDate()));
  habitRow.innerHTML = '';
  HABITS.forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip habit' + (day.habits[name] ? ' on' : '');
    chip.textContent = name;
    chip.setAttribute('aria-pressed', day.habits[name] ? 'true' : 'false');
    chip.onclick = () => {
      day.habits[name] = !day.habits[name];
      saveAll(allData);
      renderAll();
    };
    habitRow.appendChild(chip);
  });
}

function renderReading(){
  const day = getDay(toKey(selectedDate()));
  readingRow.innerHTML = '';
  READING.forEach(r => {
    const wrap = document.createElement('div');
    wrap.className = 'reading-item';

    const label = document.createElement('span');
    label.className = 'reading-label';
    label.textContent = `${r.label} (${r.unit})`;

    const stepper = document.createElement('div');
    stepper.className = 'stepper';

    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'stepper-btn';
    minus.textContent = '−';
    minus.setAttribute('aria-label', `Decrease ${r.label}`);
    minus.onclick = () => {
      day.reading[r.key] = Math.max(0, (day.reading[r.key]||0) - 1);
      saveAll(allData); renderAll();
    };

    const val = document.createElement('input');
    val.type = 'number';
    val.className = 'stepper-input';
    val.min = '0';
    val.value = day.reading[r.key] || 0;
    val.inputMode = 'numeric';
    val.onchange = () => {
      const n = Math.max(0, parseInt(val.value, 10) || 0);
      day.reading[r.key] = n;
      saveAll(allData); renderAll();
    };

    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'stepper-btn';
    plus.textContent = '+';
    plus.setAttribute('aria-label', `Increase ${r.label}`);
    plus.onclick = () => {
      day.reading[r.key] = (day.reading[r.key]||0) + 1;
      saveAll(allData); renderAll();
    };

    stepper.append(minus, val, plus);
    wrap.append(label, stepper);
    readingRow.appendChild(wrap);
  });
}

function renderNegatives(){
  const day = getDay(toKey(selectedDate()));
  negativeRow.innerHTML = '';
  negativeOptions().forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip negative' + (day.negatives.includes(tag) ? ' on' : '');
    chip.textContent = tag;
    chip.setAttribute('aria-pressed', day.negatives.includes(tag) ? 'true' : 'false');
    chip.onclick = () => {
      const idx = day.negatives.indexOf(tag);
      if(idx >= 0) day.negatives.splice(idx, 1);
      else day.negatives.push(tag);
      saveAll(allData);
      renderAll();
    };
    negativeRow.appendChild(chip);
  });
}

document.getElementById('addNegativeBtn').onclick = () => {
  const val = window.prompt('Name the slip you want to start tracking (e.g. "Skipped workout", "Snapped at someone"):');
  if(val && val.trim()){
    const trimmed = val.trim();
    if(!negativeOptions().includes(trimmed)){
      customNegatives.push(trimmed);
      saveCustomNegatives(customNegatives);
    }
    const day = getDay(toKey(selectedDate()));
    if(!day.negatives.includes(trimmed)) day.negatives.push(trimmed);
    saveAll(allData);
    renderAll();
  }
};

function renderMood(){
  const day = getDay(toKey(selectedDate()));
  moodRow.innerHTML = '';
  MOODS.forEach((emoji, i) => {
    const level = i + 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mood-btn' + (day.mood === level ? ' on' : '');
    btn.textContent = emoji;
    btn.setAttribute('aria-label', `Mood ${level} of 5`);
    btn.onclick = () => {
      day.mood = (day.mood === level) ? 0 : level;
      saveAll(allData);
      renderAll();
    };
    moodRow.appendChild(btn);
  });
}

function renderRevision(){
  const day = getDay(toKey(selectedDate()));
  revisionRow.innerHTML = '';
  REVISION.forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip revision' + (day.revision[name] ? ' on' : '');
    chip.textContent = name;
    chip.setAttribute('aria-pressed', day.revision[name] ? 'true' : 'false');
    chip.onclick = () => {
      day.revision[name] = !day.revision[name];
      saveAll(allData);
      renderAll();
    };
    revisionRow.appendChild(chip);
  });
}

function renderDayToggle(){
  dayToggle.querySelectorAll('button').forEach(btn => {
    const offset = Number(btn.dataset.offset);
    btn.classList.toggle('on', offset === selectedOffset);
  });
}

function renderTodayHeader(){
  const day = getDay(toKey(selectedDate()));
  todayProgress.textContent = `${countChecked(day)}/${TOTAL_ITEMS}`;
  const score = computeDayScore(day);
  todayScore.textContent = score > 0 ? `+${score}` : `${score}`;
  todayScore.classList.toggle('positive', score > 0);
  todayScore.classList.toggle('negative', score < 0);
  todayScore.classList.toggle('neutral', score === 0);
  const d = selectedDate();
  const dateStr = d.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
  todayLabel.textContent = selectedOffset === 0 ? dateStr : `Yesterday · ${dateStr}`;
}

winField.addEventListener('input', () => {
  const day = getDay(toKey(selectedDate()));
  day.win = winField.value;
  saveAll(allData);
});
slipField.addEventListener('input', () => {
  const day = getDay(toKey(selectedDate()));
  day.slip = slipField.value;
  saveAll(allData);
});

function syncTextFields(){
  const day = getDay(toKey(selectedDate()));
  if(document.activeElement !== winField) winField.value = day.win || '';
  if(document.activeElement !== slipField) slipField.value = day.slip || '';
}

/* ---------- rendering: streak arc + badges ---------- */
const arcFill = document.getElementById('arcFill');
const ARC_LENGTH = 283;
const streakCountEl = document.getElementById('streakCount');
const streakMessageEl = document.getElementById('streakMessage');
const badgeRow = document.getElementById('badgeRow');

function renderStreak(){
  const streak = currentStreak();
  streakCountEl.textContent = streak;

  const fraction = Math.min(streak / ARC_CAP, 1);
  arcFill.style.strokeDashoffset = String(ARC_LENGTH * (1 - fraction));

  const todayKey = toKey(today);
  const day = allData[todayKey];
  const todayDone = day && allPrayersDone(day);

  if(streak === 0){
    streakMessageEl.textContent = 'Log all five prayers today to start a streak.';
  } else if(!todayDone){
    streakMessageEl.textContent = `${streak}-day streak — log today's five prayers to keep it alive.`;
  } else {
    streakMessageEl.textContent = `${streak} days strong. Keep the arc lit tomorrow.`;
  }

  const best = bestStreakEver();
  badgeRow.innerHTML = '';
  MILESTONES.forEach(m => {
    const b = document.createElement('span');
    b.className = 'badge' + (best >= m ? ' earned' : '');
    b.textContent = `${m}d`;
    badgeRow.appendChild(b);
  });
}

/* ---------- rendering: month mosaic ---------- */
const mosaicGrid = document.getElementById('mosaicGrid');
const monthLabel = document.getElementById('monthLabel');

function levelFor(day){
  if(!day) return 0;
  const n = countChecked(day);
  if(n === 0) return 0;
  if(n <= 2) return 1;
  if(n <= 5) return 2;
  if(n <= 8) return 3;
  return 4;
}

function renderMosaic(){
  monthLabel.textContent = viewMonth.toLocaleDateString(undefined, { month:'long', year:'numeric' });
  mosaicGrid.innerHTML = '';

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadBlanks = firstDay.getDay();

  for(let i=0;i<leadBlanks;i++){
    const blank = document.createElement('div');
    blank.className = 'mosaic-cell empty';
    mosaicGrid.appendChild(blank);
  }

  for(let d=1; d<=daysInMonth; d++){
    const cellDate = new Date(year, month, d);
    const key = toKey(cellDate);
    const day = allData[key];
    const lvl = levelFor(day);
    const cell = document.createElement('div');
    cell.className = `mosaic-cell l${lvl}` + (isSameDay(cellDate, today) ? ' today' : '');
    cell.textContent = d;
    if(day && hasSlip(day)){
      const dot = document.createElement('span');
      dot.className = 'slip-dot';
      cell.appendChild(dot);
    }
    cell.title = day ? `${countChecked(day)}/${TOTAL_ITEMS} logged` : 'No entry';
    mosaicGrid.appendChild(cell);
  }
}

document.getElementById('prevMonth').onclick = () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  renderMosaic();
};
document.getElementById('nextMonth').onclick = () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  renderMosaic();
};

/* ---------- rendering: stats ---------- */
const statMonthDays = document.getElementById('statMonthDays');
const statBestStreak = document.getElementById('statBestStreak');
const statPrayerRate = document.getElementById('statPrayerRate');

function renderStats(){
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let logged = 0, prayerChecks = 0, possiblePrayerChecks = 0;
  for(let d=1; d<=daysInMonth; d++){
    const cellDate = new Date(year, month, d);
    if(cellDate > today) continue;
    const key = toKey(cellDate);
    const day = allData[key];
    possiblePrayerChecks += PRAYERS.length;
    if(day){
      if(countChecked(day) > 0) logged++;
      prayerChecks += PRAYERS.filter(p => prayerDone(day.prayers[p])).length;
    }
  }
  statMonthDays.textContent = logged;
  statBestStreak.textContent = bestStreakEver();
  statPrayerRate.textContent = possiblePrayerChecks
    ? `${Math.round((prayerChecks / possiblePrayerChecks) * 100)}%`
    : '0%';
}

/* ---------- reset ---------- */
document.getElementById('resetBtn').onclick = () => {
  if(confirm('Clear all tracker data on this device? This cannot be undone.')){
    allData = {};
    saveAll(allData);
    renderAll();
  }
};

/* ---------- master render ---------- */
function renderAll(){
  renderDayToggle();
  renderPrayers();
  renderHabits();
  renderReading();
  renderRevision();
  renderNegatives();
  renderMood();
  renderTodayHeader();
  syncTextFields();
  renderStreak();
  renderMosaic();
  renderStats();
}
renderAll();
