import { createContext, useContext } from "react";
import type { Backend, Lesson } from "../types";

export interface AppContextValue {
  backend: Backend;
  /** Все предметы из расписания и из домашек, по алфавиту. */
  subjects: string[];
  /** Сегодняшняя дата, YYYY-MM-DD (обновляется вместе с часами). */
  todayISO: string;
  /** Предлагаемый срок сдачи для домашки, заданной на этой паре. */
  defaultDue: (lesson: Lesson) => string;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp вызван вне AppContext");
  return ctx;
}

export function authorName(members: Backend["members"], id: string): string {
  return members[id]?.name ?? "Одногруппник";
}
