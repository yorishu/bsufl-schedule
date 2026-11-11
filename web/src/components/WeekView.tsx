import { useEffect, useMemo, useRef } from "react";
import type { Homework, Lesson } from "../types";
import { addDays, formatDay, timeToMinutes, toISO, WEEKDAYS_FULL } from "../lib/dates";
import { groupBySlot } from "../lib/schedule";
import { LessonCard } from "./LessonCard";

interface Props {
  weekStart: Date;
  lessonsByDate: Map<string, Lesson[]>;
  homework: Homework[];
  todayISO: string;
  nowMinutes: number;
  /** Диапазон дат, за который в расписании есть данные. */
  range: { min: string; max: string } | null;
  /** Статус сайта уже загружен: до этого не знаем, есть ли предупреждения, и не прокручиваем страницу. */
  ready: boolean;
  /** Есть предупреждения вверху страницы: при открытии не уводим пользователя мимо них. */
  hasBanners: boolean;
}

export function WeekView({ weekStart, lessonsByDate, homework, todayISO, nowMinutes, range, ready, hasBanners }: Props) {
  const days = useMemo(() => {
    const all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    // Воскресенье показываем, только если в нём есть пары.
    return all.filter((d, i) => i < 6 || (lessonsByDate.get(toISO(d))?.length ?? 0) > 0);
  }, [weekStart, lessonsByDate]);

  const homeworkByLesson = useMemo(() => {
    const map = new Map<string, Homework[]>();
    for (const hw of homework) {
      if (!hw.lesson_id) continue;
      const list = map.get(hw.lesson_id);
      if (list) list.push(hw);
      else map.set(hw.lesson_id, [hw]);
    }
    for (const list of map.values()) list.sort((a, b) => a.due_date.localeCompare(b.due_date));
    return map;
  }, [homework]);

  const weekISO = toISO(weekStart);
  const hasToday = days.some((d) => toISO(d) === todayISO);

  // На телефоне при открытии текущей недели прокручиваем к сегодняшнему дню.
  // При первом открытии с предупреждениями (сайт университета недоступен и т.п.) не прокручиваем,
  // иначе они окажутся выше экрана и пользователь их не увидит.
  // Решение принимается один раз на неделю (так повторный запуск эффекта, например в StrictMode, ничего не меняет).
  const handledWeek = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || handledWeek.current === weekISO) return;
    const initial = handledWeek.current === null;
    handledWeek.current = weekISO;
    if (!hasToday || (initial && hasBanners)) return;
    document.getElementById(`day-${todayISO}`)?.scrollIntoView({ block: "start" });
  }, [weekISO, hasToday, todayISO, ready]);

  const outOfRange = range !== null && (toISO(addDays(weekStart, 6)) < range.min || weekISO > range.max);

  return (
    <div>
      {outOfRange && (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Расписание на эту неделю ещё не опубликовано на сайте университета.
        </p>
      )}
      <div className="grid grid-cols-1 gap-x-4 gap-y-10 md:gap-y-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {days.map((day) => {
          const iso = toISO(day);
          const isToday = iso === todayISO;
          const dayLessons = lessonsByDate.get(iso) ?? [];
          const slots = groupBySlot(dayLessons);
          return (
            <section
              key={iso}
              id={`day-${iso}`}
              aria-label={`${WEEKDAYS_FULL[(day.getDay() + 6) % 7]}, ${formatDay(day)}`}
              className="scroll-mt-32 md:scroll-mt-36"
            >
              <header
                className={`mb-3 flex flex-wrap items-baseline justify-between gap-x-2 rounded-xl px-3 py-2 ${
                  isToday ? "bg-primary text-on-primary" : "bg-surface-2"
                }`}
              >
                <h2 className="font-semibold">{WEEKDAYS_FULL[(day.getDay() + 6) % 7]}</h2>
                <span className={`text-sm ${isToday ? "font-medium" : "text-muted"}`}>
                  {isToday ? "Сегодня, " : ""}
                  {formatDay(day)}
                </span>
              </header>
              {slots.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">Пар нет</p>
              ) : (
                <div className="space-y-3">
                  {slots.map((slot) =>
                    slot.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        homework={homeworkByLesson.get(lesson.id) ?? []}
                        parallel={slot.length > 1}
                        isNow={
                          isToday &&
                          nowMinutes >= timeToMinutes(lesson.start) &&
                          nowMinutes < timeToMinutes(lesson.end)
                        }
                      />
                    )),
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
