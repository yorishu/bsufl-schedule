/** Работа с датами в локальном времени (YYYY-MM-DD, неделя с понедельника). */

export const WEEKDAYS_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
export const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const pad = (n: number): string => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const wd = (d.getDay() + 6) % 7; // пн = 0
  return addDays(d, -wd);
}

export function formatDay(d: Date): string {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function formatISODay(iso: string): string {
  return formatDay(parseISO(iso));
}

export function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}–${sunday.getDate()} ${MONTHS_GEN[sunday.getMonth()]}`;
  }
  return `${formatDay(monday)} – ${formatDay(sunday)}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type DueTone = "overdue" | "soon" | "normal";

/** Подпись срока сдачи и её «тон» для цвета. */
export function describeDue(dueISO: string, todayISO: string): { label: string; tone: DueTone } {
  const diff = Math.round((parseISO(dueISO).getTime() - parseISO(todayISO).getTime()) / 86_400_000);
  if (diff < 0) return { label: `просрочено, ${formatISODay(dueISO)}`, tone: "overdue" };
  if (diff === 0) return { label: "сегодня", tone: "soon" };
  if (diff === 1) return { label: "завтра", tone: "soon" };
  return { label: formatISODay(dueISO), tone: "normal" };
}
