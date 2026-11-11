import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

// Эти значения не секретны (защищает доступ firestore.rules), но по правилам проекта
// лежат в переменных окружения Vite: web/.env.local и GitHub Secrets.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

// В проекте база называется "default" (без скобок), см. firebase.json.
const DATABASE_ID = (import.meta.env.VITE_FIRESTORE_DATABASE as string | undefined) || "default";

export const DEMO_MODE = import.meta.env.VITE_DEMO === "1";
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

interface Firebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let instance: Firebase | null = null;

export function getFirebase(): Firebase {
  if (instance) return instance;
  const app = initializeApp(config);
  instance = {
    app,
    auth: getAuth(app),
    // Офлайн-кэш в IndexedDB: домашки открываются без сети и синхронизируются при появлении связи.
    db: initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      DATABASE_ID,
    ),
  };
  return instance;
}

/** Служебная почта для входа по ID и ключу (см. admin/members.py). */
export function loginToEmail(id: string): string {
  return `${id.trim().toLowerCase()}@schedule.invalid`;
}
