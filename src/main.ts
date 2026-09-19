/* =====================================================================
   Days Alive — logic (TypeScript). Compiled to ../app.js.
   Single-screen: a form flips to a results view. No time-of-birth.
   ===================================================================== */

const LIFESPAN_YEARS = 80;
const MS_PER_DAY = 86_400_000;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- Date helpers (local, no UTC parsing) ---------- */

/** Parse "YYYY-MM-DD" into a local-midnight Date, or null if invalid. */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

function toInputValue(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Big numbers as "1.1 billion", "22.8 million", etc. */
function compact(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} trillion`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  return fmt(n);
}
const formatLong = (d: Date): string => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const formatShort = (d: Date): string => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/* ---------- Computations ---------- */

interface AgeParts { years: number; months: number; days: number; }

function ageBreakdown(birth: Date, now: Date): AgeParts {
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

function nextBirthday(birth: Date, now: Date): { date: Date; daysUntil: number; turningAge: number } {
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(todayMid.getFullYear(), birth.getMonth(), birth.getDate());
  if (next.getTime() < todayMid.getTime()) {
    next = new Date(todayMid.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  const daysUntil = Math.round((next.getTime() - todayMid.getTime()) / MS_PER_DAY);
  return { date: next, daysUntil, turningAge: next.getFullYear() - birth.getFullYear() };
}

/** Golden birthday: the year you turn the age of your birth day-of-month. */
function golden(birth: Date, now: Date, age: AgeParts):
  { passed: boolean; goldenAge: number; date?: Date; daysUntil?: number; goldenYear?: number } {
  const goldenAge = birth.getDate();
  if (age.years >= goldenAge) {
    return { passed: true, goldenAge, goldenYear: birth.getFullYear() + goldenAge };
  }
  const date = new Date(birth.getFullYear() + goldenAge, birth.getMonth(), birth.getDate());
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntil = Math.round((date.getTime() - todayMid.getTime()) / MS_PER_DAY);
  return { passed: false, goldenAge, date, daysUntil };
}

/** Next round-number day: every 1,000 up to 10k, then every 5,000. */
function nextRound(totalDays: number): { target: number; daysUntil: number } {
  const step = totalDays < 10000 ? 1000 : 5000;
  const target = (Math.floor(totalDays / step) + 1) * step;
  return { target, daysUntil: target - totalDays };
}

/* ---------- DOM ---------- */

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const els = {
  formView: $('formView'),
  resultView: $('resultView'),
  form: $('calcForm') as HTMLFormElement,
  input: $('bdate') as HTMLInputElement,
  error: $('error'),
  resetBtn: $('resetBtn') as HTMLButtonElement,
  copyBtn: $('copyBtn') as HTMLButtonElement,

  totalDays: $('totalDays'),
  ticker: $('ticker'),
  born: $('born'),
  age: $('age'),
  weeks: $('weeks'),
  hours: $('hours'),
  pct: $('pct'),
  pctNote: $('pctNote'),

  beats: $('beats'),
  asleep: $('asleep'),
  sun: $('sun'),
  toilet: $('toilet'),

  roundNum: $('roundNum'),
  roundSub: $('roundSub'),
  bdayNum: $('bdayNum'),
  bdaySub: $('bdaySub'),
  goldNum: $('goldNum'),
  goldSub: $('goldSub'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let birth: Date | null = null;
let tickTimer: number | undefined;
let copiedDays = 0;

/* ---------- Persistence ---------- */

const STORAGE_KEY = 'daysalive:dob';
const save = (v: string): void => { try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ } };
const load = (): string | null => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };

/* ---------- Render ---------- */

function animateNumber(el: HTMLElement, to: number): void {
  if (reducedMotion) { el.textContent = fmt(to); return; }
  const duration = 700;
  const start = performance.now();
  const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
  const step = (t: number): void => {
    const p = Math.min((t - start) / duration, 1);
    el.textContent = fmt(ease(p) * to);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function render(animate: boolean): void {
  if (!birth) return;
  const now = new Date();
  const msAlive = now.getTime() - birth.getTime();
  const totalDays = Math.floor(msAlive / MS_PER_DAY);
  const totalHours = Math.floor(msAlive / 3_600_000);
  const totalSeconds = Math.floor(msAlive / 1000);
  const weeks = Math.floor(totalDays / 7);
  copiedDays = totalDays;

  const age = ageBreakdown(birth, now);
  const bday = nextBirthday(birth, now);
  const gold = golden(birth, now, age);
  const round = nextRound(totalDays);
  const pct = Math.min(999, (totalDays / (LIFESPAN_YEARS * 365.25)) * 100);

  if (animate) animateNumber(els.totalDays, totalDays);
  else els.totalDays.textContent = fmt(totalDays);

  els.ticker.hidden = false;
  els.ticker.textContent = `${fmt(totalSeconds)} seconds and counting`;
  els.born.innerHTML = `Born ${formatLong(birth)} &middot; a ${DAYS[birth.getDay()]}`;

  els.age.textContent = `${age.years}y ${age.months}m ${age.days}d`;
  els.weeks.textContent = fmt(weeks);
  els.hours.textContent = fmt(totalHours);
  els.pct.textContent = `${pct.toFixed(1)}%`;
  els.pctNote.textContent = `assumes ${LIFESPAN_YEARS} years`;

  // Just-for-fun stats (all very rough, entirely for laughs).
  const minutes = msAlive / 60_000;
  const heartbeats = minutes * 70;                    // ~70 bpm
  const sleepDays = totalDays / 3;                    // ~a third of life
  const sunKm = (totalSeconds * 29.78);              // Earth orbits at ~29.78 km/s
  const toiletDays = (totalDays * 15) / 1440;        // ~15 min/day on the throne
  els.beats.textContent = `${compact(heartbeats)} beats`;
  els.asleep.textContent = `${(sleepDays / 365.25).toFixed(1)} years`;
  els.sun.textContent = `${compact(sunKm)} km`;
  els.toilet.textContent = `${fmt(toiletDays)} days 💀`;

  const roundDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + round.daysUntil);
  els.roundNum.textContent = `${fmt(round.target)} days`;
  els.roundSub.innerHTML = `in ${fmt(round.daysUntil)} days &middot; ${formatShort(roundDate)}`;

  els.bdayNum.textContent = `Turning ${bday.turningAge}`;
  els.bdaySub.innerHTML = `in ${fmt(bday.daysUntil)} days &middot; ${formatShort(bday.date)}`;

  if (gold.passed) {
    els.goldNum.textContent = 'Golden birthday';
    els.goldSub.textContent = `Already came, in ${gold.goldenYear}`;
  } else {
    els.goldNum.textContent = `Golden birthday: ${gold.goldenAge}`;
    els.goldSub.innerHTML = `in ${fmt(gold.daysUntil!)} days &middot; ${formatShort(gold.date!)}`;
  }
}

/* ---------- View switching ---------- */

function showResult(): void {
  els.formView.hidden = true;
  els.resultView.hidden = false;
  render(true);
  stopTick();
  tickTimer = window.setInterval(() => render(false), 1000);
}

function showForm(): void {
  stopTick();
  els.resultView.hidden = true;
  els.formView.hidden = false;
  els.input.focus();
}

function stopTick(): void {
  if (tickTimer !== undefined) { clearInterval(tickTimer); tickTimer = undefined; }
}

/* ---------- Submit ---------- */

function submit(value: string): void {
  if (!value) {
    showError('Please enter your birth date.');
    return;
  }
  const parsed = parseLocalDate(value);
  if (!parsed) {
    showError("That date doesn't look right — please check it.");
    return;
  }
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  if (parsed.getTime() > todayMid.getTime()) {
    showError("That date hasn't happened yet.");
    return;
  }
  clearError();
  birth = parsed;
  save(value);
  showResult();
}

function showError(msg: string): void {
  els.error.textContent = msg;
  els.error.hidden = false;
}
function clearError(): void {
  els.error.hidden = true;
  els.error.textContent = '';
}

/* ---------- Copy ---------- */

async function copyResult(): Promise<void> {
  const sentence = `I've been alive for ${fmt(copiedDays)} days!`;
  try {
    await navigator.clipboard.writeText(sentence);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = sentence;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta);
  }
  const def = els.copyBtn.querySelector<HTMLElement>('.copy-default')!;
  const done = els.copyBtn.querySelector<HTMLElement>('.copy-done')!;
  def.hidden = true;
  done.hidden = false;
  window.setTimeout(() => { def.hidden = false; done.hidden = true; }, 1600);
}

/* ---------- Init ---------- */

function init(): void {
  els.input.max = toInputValue(new Date());

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(els.input.value);
  });
  els.resetBtn.addEventListener('click', showForm);
  els.copyBtn.addEventListener('click', () => void copyResult());

  const param = new URLSearchParams(window.location.search).get('dob');
  const restored = param ?? load();
  if (restored) {
    els.input.value = restored;
    submit(restored);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
