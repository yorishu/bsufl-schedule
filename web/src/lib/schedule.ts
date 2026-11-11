import type { Lesson, ScheduleData } from "../types";
import { addDays, parseISO, toISO } from "./dates";

/** Загрузка schedule.json. no-cache: всегда проверяем свежесть, офлайн вернёт кэш service worker. */
export async function loadSchedule(): Promise<ScheduleData> {
  const url = new URL("schedule.json", document.baseURI);
  const resp = await fetch(url, { cache: "no-cache" });
  if (!resp.ok) throw new Error(`Не удалось загрузить расписание (HTTP ${resp.status})`);
  const data: unknown = await resp.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as ScheduleData).lessons) ||
    typeof (data as ScheduleData).group !== "string"
  ) {
    throw new Error("Файл расписания имеет неожиданный формат");
  }
  return data as ScheduleData;
}

export function groupByDate(lessons: Lesson[]): Map<string, Lesson[]> {
  const map = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const list = map.get(l.date);
    if (list) list.push(l);
    else map.set(l.date, [l]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start) || a.subject.localeCompare(b.subject, "ru"));
  }
  return map;
}

/** Пары одного времени идут группой: если их несколько, это параллельные (чаще всего спецкурсы на выбор). */
export function groupBySlot(dayLessons: Lesson[]): Lesson[][] {
  const slots: Lesson[][] = [];
  for (const l of dayLessons) {
    const last = slots[slots.length - 1];
    if (last && last[0].start === l.start) last.push(l);
    else slots.push([l]);
  }
  return slots;
}

/** Дата следующей пары того же предмета: по умолчанию именно к ней задают домашку. */
export function buildDefaultDue(lessons: Lesson[]): (lesson: Lesson) => string {
  const bySubject = new Map<string, string[]>();
  for (const l of lessons) {
    const dates = bySubject.get(l.subject);
    if (dates) dates.push(l.date);
    else bySubject.set(l.subject, [l.date]);
  }
  for (const dates of bySubject.values()) dates.sort();
  return (lesson) => {
    const next = bySubject.get(lesson.subject)?.find((d) => d > lesson.date);
    return next ?? toISO(addDays(parseISO(lesson.date), 7));
  };
}

export function dateRange(lessons: Lesson[]): { min: string; max: string } | null {
  if (lessons.length === 0) return null;
  let min = lessons[0].date;
  let max = lessons[0].date;
  for (const l of lessons) {
    if (l.date < min) min = l.date;
    if (l.date > max) max = l.date;
  }
  return { min, max };
}
