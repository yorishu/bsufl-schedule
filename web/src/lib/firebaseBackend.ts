import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import type { AuthStatus, Backend, Homework, HomeworkPatch, Member, NewHomework } from "../types";
import { firebaseConfigured, getFirebase, loginToEmail } from "./firebase";

function toHomework(d: QueryDocumentSnapshot): Homework {
  const x = d.data({ serverTimestamps: "estimate" });
  const ms = (t: unknown): number | null => (t ? (t as Timestamp).toMillis() : null);
  return {
    id: d.id,
    subject: String(x.subject ?? ""),
    lesson_id: (x.lesson_id as string | null | undefined) ?? null,
    due_date: String(x.due_date ?? ""),
    text: String(x.text ?? ""),
    author_id: String(x.author_id ?? ""),
    created_at: ms(x.created_at),
    updated_at: ms(x.updated_at),
  };
}

function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found")
    return "Неверный ID или ключ";
  if (code === "auth/too-many-requests") return "Слишком много попыток. Подождите немного";
  if (code === "auth/network-request-failed") return "Нет соединения с интернетом";
  if (code === "auth/user-disabled") return "Доступ для этого ID отключён";
  return "Не удалось войти. Попробуйте ещё раз";
}

export function useFirebaseBackend(): Backend {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(firebaseConfigured ? "loading" : "signedOut");
  const [guest, setGuest] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [homework, setHomework] = useState<Homework[]>([]);
  const [homeworkReady, setHomeworkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(getFirebase().auth, (u) => {
      setUid(u ? u.uid : null);
      setAuthStatus(u ? "signedIn" : "signedOut");
    });
  }, []);

  // Гость: не вошёл, но выбрал просмотр. После входа гостевой режим не нужен.
  const status: AuthStatus = authStatus === "signedOut" && guest ? "guest" : authStatus;

  useEffect(() => {
    if (status !== "signedIn" && status !== "guest") {
      setMembers({});
      setHomework([]);
      setHomeworkReady(false);
      return;
    }
    const { db } = getFirebase();
    const onError = (e: Error) => setError(`Нет доступа к данным: ${e.message}`);
    const offMembers = onSnapshot(
      collection(db, "members"),
      (snap) => {
        const next: Record<string, Member> = {};
        for (const d of snap.docs) next[d.id] = { id: d.id, name: String(d.data().name ?? d.id) };
        setMembers(next);
      },
      onError,
    );
    const offHomework = onSnapshot(
      collection(db, "homework"),
      (snap) => {
        setError(null);
        setHomework(snap.docs.map(toHomework));
        setHomeworkReady(true);
      },
      onError,
    );
    return () => {
      offMembers();
      offHomework();
    };
  }, [status]);

  const enterGuest = useCallback(() => setGuest(true), []);
  const leaveGuest = useCallback(() => setGuest(false), []);

  const signIn = useCallback(async (id: string, key: string) => {
    try {
      await signInWithEmailAndPassword(getFirebase().auth, loginToEmail(id), key.trim());
    } catch (e) {
      throw new Error(authMessage(e));
    }
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(getFirebase().auth);
  }, []);

  const addHomework = useCallback(
    async (data: NewHomework) => {
      if (!uid) throw new Error("Нужно войти");
      await addDoc(collection(getFirebase().db, "homework"), {
        subject: data.subject,
        lesson_id: data.lesson_id,
        due_date: data.due_date,
        text: data.text.trim(),
        author_id: uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    },
    [uid],
  );

  const updateHomework = useCallback(async (id: string, patch: HomeworkPatch) => {
    await updateDoc(doc(getFirebase().db, "homework", id), {
      text: patch.text.trim(),
      due_date: patch.due_date,
      updated_at: serverTimestamp(),
    });
  }, []);

  const removeHomework = useCallback(async (id: string) => {
    await deleteDoc(doc(getFirebase().db, "homework", id));
  }, []);

  const user = useMemo<Member | null>(
    () => (uid ? (members[uid] ?? { id: uid, name: uid }) : null),
    [uid, members],
  );

  return {
    status,
    user,
    members,
    homework,
    homeworkReady,
    error,
    signIn,
    signOut,
    enterGuest,
    leaveGuest,
    addHomework,
    updateHomework,
    removeHomework,
  };
}
