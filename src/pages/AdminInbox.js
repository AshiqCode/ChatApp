import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  subscribeToUsers,
  subscribeToMessages,
  sendAdminMessage,
  deleteUserThread, // ✅ new
} from "../chatStore";
import {
  requestNotifyPermission,
  showDesktopNotification,
  canUseNotifications,
} from "../lib/notify";

function fmtTime(ts) {
  if (!ts || typeof ts !== "number") return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  const n = (name || "U").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "U").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

export default function AdminInbox() {
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [unread, setUnread] = useState({});
  const [notifyEnabled, setNotifyEnabled] = useState(
    canUseNotifications() && typeof Notification !== "undefined"
      ? Notification.permission === "granted"
      : false
  );

  const listRef = useRef(null);

  // mobile view: list vs chat
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"

  // delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // search + filter
  const [q, setQ] = useState("");
  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const name = String(u.name || "").toLowerCase();
      const id = String(u.userId || "").toLowerCase();
      const last = String(u.lastMessage || "").toLowerCase();
      return name.includes(s) || id.includes(s) || last.includes(s);
    });
  }, [users, q]);

  // track last message id per user so we don't notify on initial load
  const lastSeenMsgIdByUserRef = useRef({});
  const unsubByUserRef = useRef({});

  useEffect(() => {
    const unsub = subscribeToUsers(setUsers);
    return unsub;
  }, []);

  // active thread messages
  useEffect(() => {
    if (!active?.userId) return;
    const unsub = subscribeToMessages(active.userId, setMessages);
    return unsub;
  }, [active?.userId]);

  // autoscroll
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // ✅ Subscribe to each user's messages to detect new incoming user messages reliably
  useEffect(() => {
    if (!users.length) return;

    const currentIds = new Set(users.map((u) => String(u.userId)));

    // cleanup removed users subscriptions
    Object.keys(unsubByUserRef.current).forEach((uid) => {
      if (!currentIds.has(uid)) {
        try {
          unsubByUserRef.current[uid]?.();
        } catch {}
        delete unsubByUserRef.current[uid];
        delete lastSeenMsgIdByUserRef.current[uid];
      }
    });

    // subscribe to new users threads
    users.forEach((u) => {
      const userId = String(u.userId);

      if (unsubByUserRef.current[userId]) return;

      unsubByUserRef.current[userId] = subscribeToMessages(userId, (thread) => {
        if (!Array.isArray(thread) || thread.length === 0) return;

        const last = thread[thread.length - 1];
        if (!last?.id) return;

        const prevId = lastSeenMsgIdByUserRef.current[userId];

        // first time: set baseline and don't notify
        if (!prevId) {
          lastSeenMsgIdByUserRef.current[userId] = last.id;
          return;
        }

        // no change
        if (prevId === last.id) return;

        // update baseline
        lastSeenMsgIdByUserRef.current[userId] = last.id;

        // only notify for USER messages
        if (last.sender !== "user") return;

        // if admin is currently viewing this thread, don't unread/notify
        if (active?.userId === userId) return;

        setUnread((prev) => ({
          ...prev,
          [userId]: (prev[userId] || 0) + 1,
        }));

        // notify only when tab hidden (your rule)
        if (document.visibilityState === "visible") return;

        showDesktopNotification(
          `New message from ${u.name || "User"}`,
          last.text || "New message"
        );
      });
    });

    return () => {
      Object.values(unsubByUserRef.current).forEach((fn) => {
        try {
          fn?.();
        } catch {}
      });
      unsubByUserRef.current = {};
    };
  }, [users, active?.userId]);

  const enableNotifications = async () => {
    const ok = await requestNotifyPermission();
    setNotifyEnabled(ok);
  };

  const openThread = (u) => {
    setActive(u);
    setUnread((prev) => ({ ...prev, [u.userId]: 0 }));
    setMobileView("chat");
  };

  const backToList = () => {
    setMobileView("list");
  };

  const send = async () => {
    const t = text.trim();
    if (!t || !active?.userId) return;
    setText("");
    await sendAdminMessage(active.userId, t);
  };

  const confirmDelete = async () => {
    if (!active?.userId) return;

    setDeleting(true);
    const uid = String(active.userId);

    try {
      await deleteUserThread(uid);

      // cleanup local ui
      setShowDelete(false);
      setActive(null);
      setMessages([]);
      setText("");
      setUnread((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      setMobileView("list");
    } finally {
      setDeleting(false);
    }
  };

  const activeUnread = active?.userId ? unread[active.userId] || 0 : 0;
  const totalUnread = Object.values(unread).reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="min-h-screen bg-[#07080A] text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#060608]/80 backdrop-blur px-3 sm:px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 via-indigo-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
              <span className="text-sm font-black">AI</span>
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-base truncate">
                Admin Inbox
              </div>
              <div className="text-xs text-white/55 truncate">
                Live support • {users.length} users
                {totalUnread > 0 ? ` • ${totalUnread} unread` : ""}
              </div>
            </div>
          </div>

          <button
            onClick={enableNotifications}
            className={[
              "text-xs font-extrabold rounded-xl px-3 py-2 border border-white/10 transition whitespace-nowrap",
              notifyEnabled
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-white/10 hover:bg-white/15",
            ].join(" ")}
          >
            {notifyEnabled ? "Notifications: ON" : "Enable"}
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="mx-auto max-w-6xl p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3 sm:gap-4">
        {/* Left: Users */}
        <div
          className={[
            "rounded-3xl border border-white/10 bg-[#0A0B0E] overflow-hidden shadow-[0_18px_70px_rgba(0,0,0,0.55)]",
            "lg:block",
            mobileView === "list" ? "block" : "hidden",
          ].join(" ")}
        >
          {/* Search */}
          <div className="p-3 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-[11px] font-black text-white/70">🔎</span>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search users..."
                className="flex-1 h-10 rounded-2xl bg-black/40 border border-white/10 px-3 text-sm outline-none focus:border-white/20"
              />
              {q.trim() && (
                <button
                  onClick={() => setQ("")}
                  className="h-10 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-extrabold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Users list */}
          <div className="p-3 space-y-2 max-h-[calc(100vh-210px)] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-sm text-white/60 px-2 py-6">
                No users found
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isActive = active?.userId === u.userId;
                const count = unread[u.userId] || 0;

                return (
                  <button
                    key={u.userId}
                    onClick={() => openThread(u)}
                    className={[
                      "w-full text-left rounded-3xl border transition p-3",
                      isActive
                        ? "border-white/20 bg-white/10"
                        : "border-white/10 bg-transparent hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          "h-11 w-11 rounded-2xl flex items-center justify-center border shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex-shrink-0",
                          isActive
                            ? "bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 border-white/15"
                            : "bg-white/5 border-white/10",
                        ].join(" ")}
                      >
                        <span className="text-xs font-black text-white/80">
                          {initials(u.name)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold truncate">
                            {u.name || "Unknown"}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {count > 0 && (
                              <span className="min-w-[22px] h-[22px] px-2 rounded-full bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center">
                                {count > 99 ? "99+" : count}
                              </span>
                            )}
                            <span className="text-[11px] text-white/55 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
                              {String(u.userId).slice(0, 8)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-white/60 line-clamp-2">
                          {u.lastMessage || "—"}
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="text-[11px] text-white/45">
                            {typeof u.lastAt === "number"
                              ? fmtTime(u.lastAt)
                              : ""}
                          </div>

                          <div className="text-[11px] font-extrabold text-white/55">
                            {isActive ? "Viewing" : count > 0 ? "Unread" : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Chat */}
        <div
          className={[
            "rounded-3xl border border-white/10 bg-[#0A0B0E] overflow-hidden shadow-[0_18px_70px_rgba(0,0,0,0.55)] flex flex-col min-h-[70vh]",
            "lg:flex",
            mobileView === "chat" ? "flex" : "hidden lg:flex",
          ].join(" ")}
        >
          {/* Chat header */}
          <div className="p-4 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent">
            {active ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={backToList}
                    className="lg:hidden h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80"
                    aria-label="Back"
                  >
                    ←
                  </button>

                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/15 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black">
                      {initials(active.name)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="font-extrabold truncate">
                      {active.name || "Unknown"}
                    </div>
                    <div className="text-xs text-white/55 truncate">
                      UserId: {active.userId}
                      {activeUnread > 0 ? ` • ${activeUnread} unread` : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowDelete(true)}
                    className="h-9 px-3 rounded-2xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/25 text-xs font-extrabold text-rose-200"
                  >
                    Delete
                  </button>

                  <span className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70">
                    Live
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/60">
                Select a user to start replying.
              </div>
            )}
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-[#07070A] via-[#060609] to-[#050507]"
          >
            {!active ? (
              <div className="text-sm text-white/60">
                Pick a user from the left.
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-white/60">No messages</div>
            ) : (
              messages.map((m) => {
                const mine = m.sender === "admin";
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={[
                        "max-w-[88%] sm:max-w-[82%] rounded-3xl border px-3 py-2 text-sm whitespace-pre-wrap leading-snug",
                        mine
                          ? "bg-gradient-to-b from-white/12 to-white/6 border-white/15"
                          : "bg-white/5 border-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="text-[11px] text-white/60">
                          {mine ? "Admin" : "User"}
                        </div>
                        <div className="text-[11px] text-white/40">
                          {typeof m.createdAt === "number"
                            ? fmtTime(m.createdAt)
                            : ""}
                        </div>
                      </div>
                      <div>{m.text}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-white/10 bg-[#070707]">
            <div className="flex gap-2 items-end">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={!active}
                placeholder={
                  active
                    ? "Write a reply… (Enter to send, Shift+Enter for new line)"
                    : "Select a user first"
                }
                rows={2}
                className={[
                  "flex-1 resize-none rounded-2xl bg-black/60 text-white px-3 py-2 text-sm outline-none border border-white/10",
                  "focus:border-white/20",
                  !active ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              />

              <button
                onClick={send}
                disabled={!active || !text.trim()}
                className={[
                  "h-10 rounded-2xl px-4 text-sm font-extrabold transition whitespace-nowrap",
                  active && text.trim()
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/10 text-white/40 border border-white/10 cursor-not-allowed",
                ].join(" ")}
              >
                Send
              </button>
            </div>

            <div className="mt-2 text-[11px] text-white/40 flex items-center justify-between">
              <span>{active ? "Tip: Shift+Enter for new line" : "—"}</span>
              <span>{active ? `${text.length}/2000` : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {showDelete && active && (
        <div className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0b0b] text-white p-4 shadow-[0_22px_80px_rgba(0,0,0,0.75)]">
            <div className="font-extrabold text-base">Delete user thread?</div>
            <div className="text-xs text-white/60 mt-1">
              This will permanently delete this user profile and all messages.
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="font-extrabold truncate">
                {active.name || "Unknown"}
              </div>
              <div className="text-xs text-white/60 mt-1">
                UserId: {active.userId}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="flex-1 h-10 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-extrabold"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={[
                  "flex-1 h-10 rounded-2xl text-sm font-extrabold border",
                  deleting
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-200/60 cursor-not-allowed"
                    : "bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/25 text-rose-200",
                ].join(" ")}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>

            <div className="text-[11px] text-white/40 mt-3">
              Tip: you can disable this button for non-admin users by checking a
              role flag.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
