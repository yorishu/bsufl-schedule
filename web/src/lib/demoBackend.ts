import { useCallback, useMemo, useState } from "react";
import type { Backend, Homework, HomeworkPatch, Member, NewHomework } from "../types";

/**
 * Демо-режим (VITE_DEMO=1): данные в памяти, без Firebase.
 * Нужен только для разработки и проверки интерфейса, в продакшн-сборку не включается.
 */
const ME: Member = { id: "u01", name: "Сергей" };
const MEMBERS: Record<string, Member> = {
  u01: ME,
  u02: { id: "u02", name: "Анна" },
  u03: { id: "u03", name: "Мария" },
};

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const now = Date.now();
const SEED: Homework[] = [
  {
    id: "h1",
    subject: "Зарубежная литература",
    lesson_id: null,
    due_date: daysFromNow(1),
    text: "Прочитать главы 3–5, подготовить 3 вопроса к обсуждению.\nПринести распечатку.",
    author_id: "u02",
    created_at: now - 3_600_000 * 5,
    updated_at: now - 3_600_000 * 5,
  },
  {
    id: "h2",
    subject: "Язык средств массовой информации",
    lesson_id: null,
    due_date: daysFromNow(4),
    text: "Эссе на 250 слов по теме «Заголовки в онлайн-СМИ».",
    author_id: "u03",
    created_at: now - 86_400_000,
    updated_at: now - 3_600_000 * 2,
  },
  {
    id: "h3",
    subject: "Методика преподавания иностранных языков",
    lesson_id: null,
    due_date: daysFromNow(-2),
    text: "Конспект урока (аудирование).",
    author_id: "u01",
    created_at: now - 86_400_000 * 4,
    updated_at: now - 86_400_000 * 4,
  },
];

export function useDemoBackend(): Backend {
  const [homework, setHomework] = useState<Homework[]>(SEED);

  const addHomework = useCallback(async (data: NewHomework) => {
    const t = Date.now();
    setHomework((prev) => [
      ...prev,
      { ...data, text: data.text.trim(), id: `h${t}`, author_id: ME.id, created_at: t, updated_at: t },
    ]);
  }, []);

  const updateHomework = useCallback(async (id: string, patch: HomeworkPatch) => {
    setHomework((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...patch, text: patch.text.trim(), updated_at: Date.now() } : h)),
    );
  }, []);

  const removeHomework = useCallback(async (id: string) => {
    setHomework((prev) => prev.filter((h) => h.id !== id));
  }, []);

  return useMemo(
    () => ({
      status: "signedIn" as const,
      user: ME,
      members: MEMBERS,
      homework,
      homeworkReady: true,
      error: null,
      signIn: async () => {},
      signOut: async () => {},
      addHomework,
      updateHomework,
      removeHomework,
    }),
    [homework, addHomework, updateHomework, removeHomework],
  );
}
