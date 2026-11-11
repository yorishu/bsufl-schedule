import { useEffect, useMemo } from "react";
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
}

export function WeekView({ weekStart, lessonsByDate, homework, todayISO, nowMinutes, range }: Props) {
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
  useEffect(() => {
    if (!hasToday) return;
    document.getElementById(`day-${todayISO}`)?.scrollIntoView({ block: "start" });
  }, [weekISO, hasToday, todayISO]);

  const outOfRange = range !== null && (toISO(addDays(weekStart, 6)) < range.min || weekISO > range.max);

  return (
    <div>
      {outOfRange && (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Расписание на эту неделю ещё не опубликовано на сайте университета.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
                className={`mb-2 flex flex-wrap items-baseline justify-between gap-x-2 rounded-xl px-3 py-2 ${
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
