/* ---------- config ---------- */
const PRAYERS = ['Fajr', 'Zohr', 'Asr', 'Maghrib', 'Isha'];
const HABITS  = ['Gym', 'Upskilling', 'Book', 'Ayat'];
const STORAGE_KEY = 'ehtesab_days_v1';
const MILESTONES = [3, 7, 14, 30, 60, 100];
const ARC_CAP = 30; // streak length at which the arc reads "full"

/* ---------- date helpers ---------- */
function pad(n){ return n.toString().padStart(2, '0'); }
function toKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fromKey(k){ const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); }
function isSameDay(a,b){ return toKey(a) === toKey(b); }

const today = new Date();
today.setHours(0,0,0,0);

/* ---------- state ---------- */
function loadAll(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveAll(data){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch(e){ console.error('Could not save — storage may be full or blocked.', e); }
}

let allData = loadAll();
let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function emptyDay(){
  const prayers = {}; PRAYERS.forEach(p => prayers[p] = false);
  const habits = {}; HABITS.forEach(h => habits[h] = false);
  return { prayers, habits, reflection: '' };
}
function getDay(key){
  if(!allData[key]) allData[key] = emptyDay();
  // guard against older/partial records
  allData[key].prayers = { ...emptyDay().prayers, ...(allData[key].prayers||{}) };
  allData[key].habits  = { ...emptyDay().habits,  ...(allData[key].habits||{}) };
  return allData[key];
}
function countChecked(day){
  const p = PRAYERS.filter(k => day.prayers[k]).length;
  const h = HABITS.filter(k => day.habits[k]).length;
  return p + h;
}
function allPrayersDone(day){
  return PRAYERS.every(k => day.prayers[k]);
}

/* ---------- streak calculation ---------- */
// A day "counts" toward the streak if all 5 prayers are logged.
// Streak = consecutive counted days ending today (or yesterday, so an
// unfinished "today" doesn't zero it out mid-day).
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
        const prevDate = fromKey(prev);
        const curDate = fromKey(k);
        const diffDays = Math.round((curDate - prevDate) / 86400000);
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
const prayerRow = document.getElementById('prayerRow');
const habitRow  = document.getElementById('habitRow');
const reflectionEl = document.getElementById('reflection');
const todayLabel = document.getElementById('todayLabel');
const todayProgress = document.getElementById('todayProgress');

function renderChips(){
  const key = toKey(today);
  const day = getDay(key);

  prayerRow.innerHTML = '';
  PRAYERS.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'chip prayer' + (day.prayers[name] ? ' on' : '');
    chip.textContent = name;
    chip.setAttribute('aria-pressed', day.prayers[name] ? 'true' : 'false');
    chip.onclick = () => {
      day.prayers[name] = !day.prayers[name];
      saveAll(allData);
      renderAll();
    };
    prayerRow.appendChild(chip);
  });

  habitRow.innerHTML = '';
  HABITS.forEach(name => {
    const chip = document.createElement('button');
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

  todayProgress.textContent = `${countChecked(day)}/${PRAYERS.length + HABITS.length}`;
  todayLabel.textContent = today.toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });

  reflectionEl.value = day.reflection || '';
}
reflectionEl.addEventListener('input', () => {
  const day = getDay(toKey(today));
  day.reflection = reflectionEl.value;
  saveAll(allData);
});

/* ---------- rendering: streak arc + badges ---------- */
const arcFill = document.getElementById('arcFill');
const ARC_LENGTH = 283; // matches the path's approximate length
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
  const leadBlanks = firstDay.getDay(); // 0=Sun

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
    cell.title = day ? `${countChecked(day)}/9 logged` : 'No entry';
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
      prayerChecks += PRAYERS.filter(p => day.prayers[p]).length;
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
  renderChips();
  renderStreak();
  renderMosaic();
  renderStats();
}
renderAll();
