/** Пара из public/schedule.json (формат описан в CLAUDE.md, Этап 2). */
export interface Lesson {
  id: string;
  date: string; // YYYY-MM-DD
  weekday: number; // 1 = пн … 7 = вс
  start: string; // HH:MM
  end: string;
  subject: string;
  type: string;
  teacher: string;
  room: string;
}

export interface ScheduleData {
  group: string;
  updated_at: string;
  lessons: Lesson[];
}

/** Домашнее задание (коллекция homework в Firestore). Время в миллисекундах. */
export interface Homework {
  id: string;
  subject: string;
  lesson_id: string | null;
  due_date: string; // YYYY-MM-DD
  text: string;
  author_id: string;
  created_at: number | null;
  updated_at: number | null;
}

export interface Member {
  id: string;
  name: string;
}

export interface NewHomework {
  subject: string;
  lesson_id: string | null;
  due_date: string;
  text: string;
}

export interface HomeworkPatch {
  text: string;
  due_date: string;
}

export type AuthStatus = "loading" | "signedOut" | "signedIn";

/** Всё, что приложению нужно от хранилища домашек и входа. Реализации: Firebase и демо. */
export interface Backend {
  status: AuthStatus;
  user: Member | null;
  members: Record<string, Member>;
  homework: Homework[];
  homeworkReady: boolean;
  /** Ошибка подписки на данные (например, нет доступа). */
  error: string | null;
  signIn(id: string, key: string): Promise<void>;
  signOut(): Promise<void>;
  addHomework(data: NewHomework): Promise<void>;
  updateHomework(id: string, patch: HomeworkPatch): Promise<void>;
  removeHomework(id: string): Promise<void>;
}
