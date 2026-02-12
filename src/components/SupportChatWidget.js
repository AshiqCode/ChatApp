import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getUserId,
  getUserName,
  setUserName,
  clearUserIdentity,
  ensureUserProfile,
  sendUserMessage,
  subscribeToMessages,
} from "../chatStore";
import {
  requestNotifyPermission,
  showDesktopNotification,
  canUseNotifications,
} from "../lib/notify";

export default function SupportChatHome() {
  const [userId, setUserId] = useState(() => getUserId());

  const [name, setName] = useState(() => getUserName() || "");
  const [isNamed, setIsNamed] = useState(() => !!getUserName());
  const [showNamePopup, setShowNamePopup] = useState(() => !getUserName());

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const listRef = useRef(null);

  // avoid duplicate notifications
  const lastNotifiedIdRef = useRef(null);

  // notify UI state
  const [notifyEnabled, setNotifyEnabled] = useState(
    canUseNotifications() && typeof Notification !== "undefined"
      ? Notification.permission === "granted"
      : false
  );

  // subscribe messages
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToMessages(userId, setMessages);
    return unsub;
  }, [userId]);

  // autoscroll
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // keep name/id state synced with localStorage changes (across tabs/windows)
  useEffect(() => {
    const applyFromStorage = () => {
      const storedName = getUserName() || "";
      setName(storedName);
      setIsNamed(!!storedName);
      setShowNamePopup(!storedName);

      // if userId was cleared somewhere else, regenerate
      const nextUserId = getUserId();
      setUserId(nextUserId);
    };

    applyFromStorage();

    const onStorage = (e) => {
      if (!e?.key) return;
      if (e.key === "chat_user_name" || e.key === "chat_user_id") {
        applyFromStorage();
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Notify when NEW admin message arrives (only when tab not visible)
  useEffect(() => {
    if (!isNamed) return;
    if (!messages.length) return;

    const last = messages[messages.length - 1];
    if (!last) return;

    // only notify admin messages
    if (last.sender !== "admin") return;

    // only notify if new message not already notified
    if (lastNotifiedIdRef.current === last.id) return;
    lastNotifiedIdRef.current = last.id;

    // only notify when tab is not visible
    if (document.visibilityState === "visible") return;

    showDesktopNotification("Agent replied", last.text || "New message");
  }, [messages, isNamed]);

  const enableNotifications = async () => {
    const ok = await requestNotifyPermission(); // user gesture
    setNotifyEnabled(ok);
    if (ok) {
      showDesktopNotification(
        "Notifications enabled",
        "You will receive replies from the agent."
      );
    }
  };

  const saveName = async () => {
    const n = name.trim();
    if (n.length < 2) return;

    setUserName(n);
    await ensureUserProfile(userId, n);

    setIsNamed(true);
    setShowNamePopup(false);

    // request permission right after a user action
    const ok = await requestNotifyPermission();
    setNotifyEnabled(ok);
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;

    const storedName = getUserName();
    if (!storedName) {
      setShowNamePopup(true);
      return;
    }

    setText("");
    await sendUserMessage(userId, storedName, t);
  };

  const logout = () => {
    clearUserIdentity();

    // reset UI state
    setName("");
    setIsNamed(false);
    setShowNamePopup(true);
    setMessages([]);
    setText("");

    // generate a new userId after logout (fresh session)
    const freshId = getUserId();
    setUserId(freshId);

    // reset notification baseline
    lastNotifiedIdRef.current = null;
  };

  return (
    <div className="bg-black flex justify-center p-4 sm:p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b0b0b] text-white overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.65)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#070707] border-b border-white/10">
          <div>
            <div className="font-extrabold text-base">Incognito Chat</div>
            <div className="text-xs text-white/60 mt-0.5">
              Talk to Agent in real-time
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-white/70 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              ID: {String(userId).slice(0, 8)}
            </div>

            {isNamed && (
              <>
                {/* <button
                    onClick={enableNotifications}
                    className={[
                      "text-xs font-extrabold rounded-xl px-3 py-2 border border-white/10",
                      notifyEnabled
                        ? "bg-green-500/20"
                        : "bg-white/10 hover:bg-white/15",
                    ].join(" ")}
                  >
                    {notifyEnabled ? "Notifications: ON" : "Notifications"}
                  </button> */}

                <button
                  onClick={logout}
                  className="text-xs font-extrabold rounded-xl px-3 py-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={listRef}
          className="h-[520px] overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-[#060606] to-[#050505]"
        >
          {messages.length === 0 ? (
            <div className="text-sm text-white/60 pt-2">
              <p className="m-4">No messages yet. Say hi 👋</p>
              <p className="m-4">
                Maybe the agent is not available right now. They will contact
                you soon, so please leave your message.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender === "user";
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[82%] rounded-2xl border border-white/10 px-3 py-2 text-sm whitespace-pre-wrap leading-snug",
                      mine ? "bg-white/10" : "bg-white/5",
                    ].join(" ")}
                  >
                    <div className="text-[11px] text-white/60 mb-1">
                      {mine ? "You" : "Agent"}
                    </div>
                    <div>{m.text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <div className="flex gap-2 p-3 bg-[#070707] border-t border-white/10">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={
              isNamed ? "Type a message..." : "Enter name to start..."
            }
            disabled={!isNamed}
            className={[
              "flex-1 rounded-xl bg-black text-white px-3 py-2 text-sm outline-none border border-white/10",
              "focus:border-white/20",
              !isNamed ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          />

          <button
            onClick={send}
            disabled={!isNamed}
            className={[
              "rounded-xl px-4 py-2 text-sm font-extrabold",
              "bg-white text-black hover:bg-white/90",
              !isNamed ? "opacity-60 cursor-not-allowed hover:bg-white" : "",
            ].join(" ")}
          >
            Send
          </button>
        </div>
      </div>

      {/* Name Required Modal */}
      {showNamePopup && (
        <div className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] text-white p-4 shadow-[0_22px_80px_rgba(0,0,0,0.75)]">
            <div className="font-extrabold text-base">Enter your name</div>
            <div className="text-xs text-white/60 mt-1">
              Name is required to start chat with admin.
            </div>

            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
              }}
              placeholder="Your name..."
              className="mt-3 w-full rounded-xl bg-black text-white px-3 py-2 text-sm outline-none border border-white/10 focus:border-white/20"
            />

            <button
              onClick={saveName}
              disabled={name.trim().length < 2}
              className={[
                "mt-3 w-full rounded-xl px-4 py-2 text-sm font-extrabold",
                "bg-white text-black hover:bg-white/90",
                name.trim().length < 2
                  ? "opacity-60 cursor-not-allowed hover:bg-white"
                  : "",
              ].join(" ")}
            >
              Start Chat
            </button>

            <div className="text-xs text-white/50 mt-2">
              After starting, you can allow browser notifications.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
