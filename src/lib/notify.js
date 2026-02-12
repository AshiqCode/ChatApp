// lib/notify.js

export function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotifyPermission() {
  if (!canUseNotifications()) return false;

  // If already decided, don't re-request
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  // MUST be called from a user gesture (button click) for best reliability
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function showDesktopNotification(title, body) {
  if (!canUseNotifications()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const n = new Notification(title, { body });
    n.onclick = () => window.focus();
    return true;
  } catch (e) {
    return false;
  }
}
