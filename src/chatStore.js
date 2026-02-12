// chatStore.js
import { db } from "./firebase";
import {
  ref,
  push,
  serverTimestamp,
  onValue,
  off,
  update,
  query,
  orderByChild,
  remove,
} from "firebase/database";

// ✅ localStorage keys (persistent across sessions)
export const USER_ID_KEY = "chat_user_id";
export const USER_NAME_KEY = "chat_user_name";

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return String(Date.now()) + "_" + Math.random().toString(16).slice(2);
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/** ✅ persistent user id */
export function getUserId() {
  if (!canUseStorage()) return randomId();
  let id = safeGet(USER_ID_KEY);
  if (!id) {
    id = randomId();
    safeSet(USER_ID_KEY, id);
  }
  return id;
}

/** ✅ persistent name */
export function getUserName() {
  if (!canUseStorage()) return "";
  return safeGet(USER_NAME_KEY) || "";
}

export function setUserName(name) {
  if (!canUseStorage()) return;
  safeSet(USER_NAME_KEY, name);
}

export function clearUserIdentity() {
  if (!canUseStorage()) return;
  safeRemove(USER_ID_KEY);
  safeRemove(USER_NAME_KEY);
}

export async function ensureUserProfile(userId, name) {
  const uid = String(userId);
  const userRef = ref(db, `support/users/${uid}`);

  await update(userRef, {
    name,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function sendUserMessage(userId, name, text) {
  const uid = String(userId);

  const msgRef = ref(db, `support/messages/${uid}`);
  await push(msgRef, {
    text,
    sender: "user",
    createdAt: serverTimestamp(),
  });

  const userRef = ref(db, `support/users/${uid}`);
  await update(userRef, {
    name,
    lastMessage: text,
    lastAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function sendAdminMessage(userId, text) {
  const uid = String(userId);

  const msgRef = ref(db, `support/messages/${uid}`);
  await push(msgRef, {
    text,
    sender: "admin",
    createdAt: serverTimestamp(),
  });

  const userRef = ref(db, `support/users/${uid}`);
  await update(userRef, {
    lastMessage: text,
    lastAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToMessages(userId, callback) {
  const uid = String(userId);
  const msgsRef = ref(db, `support/messages/${uid}`);

  const unsub = onValue(msgsRef, (snap) => {
    const val = snap.val() || {};
    const arr = Object.keys(val).map((id) => ({ id, ...val[id] }));

    // RTDB serverTimestamp isn't a number at read time sometimes; stable sort by key
    arr.sort((a, b) => (a.id > b.id ? 1 : -1));

    callback(arr);
  });

  return () => {
    off(msgsRef);
    unsub();
  };
}

export function subscribeToUsers(callback) {
  const usersRef = query(ref(db, "support/users"), orderByChild("lastAt"));

  const unsub = onValue(usersRef, (snap) => {
    const val = snap.val() || {};
    const arr = Object.keys(val).map((id) => ({
      userId: id,
      ...val[id],
    }));

    // newest first (lastAt might be non-number until resolved)
    arr.sort((a, b) => {
      const ta = typeof a.lastAt === "number" ? a.lastAt : 0;
      const tb = typeof b.lastAt === "number" ? b.lastAt : 0;
      return tb - ta;
    });

    callback(arr);
  });

  return () => {
    off(ref(db, "support/users"));
    unsub();
  };
}

/** ✅ Admin: hard delete user profile + all messages */
export async function deleteUserThread(userId) {
  const uid = String(userId);

  await remove(ref(db, `support/messages/${uid}`));
  await remove(ref(db, `support/users/${uid}`));
}
