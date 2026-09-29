"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

type Notification = {
  id: number;
  receipt_id: number;
  status: string;
  status_label: string;
  message: string;
  created_at: string;
  read_at: string | null;
};
type RealtimeEvent = {
  type: "receipt.status_changed";
  receipt: { id: number };
  notification: Notification;
  unread_count: number;
};
type ContextValue = {
  username: string | null;
  notifications: Notification[];
  unreadCount: number;
  receiptVersion: number;
  markNotificationsRead: () => Promise<void>;
  signOut: () => Promise<void>;
};

const RealtimeContext = createContext<ContextValue | null>(null);

function getCookie(name: string) {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")[1] ?? ""
  );
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [receiptVersion, setReceiptVersion] = useState(0);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;

    const loadNotifications = async () => {
      const response = await fetch("/api/notifications/", {
        credentials: "same-origin",
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        results: Notification[];
        unread_count: number;
      };
      if (!stopped) {
        setNotifications(body.results);
        setUnreadCount(body.unread_count);
      }
    };

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(
        `${protocol}://${window.location.host}/ws/receipts/`,
      );
      socket.onopen = () => {
        reconnectDelay = 1000;
      };
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as RealtimeEvent;
        if (payload.type !== "receipt.status_changed") return;
        setReceiptVersion((value) => value + 1);
        setNotifications((current) =>
          [
            payload.notification,
            ...current.filter((item) => item.id !== payload.notification.id),
          ].slice(0, 20),
        );
        setUnreadCount(payload.unread_count);
      };
      socket.onclose = () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };
    };

    fetch("/api/auth/me/", { credentials: "same-origin" })
      .then((response) =>
        response.ok ? (response.json() as Promise<{ username: string }>) : null,
      )
      .then(async (user) => {
        if (!user || stopped) return;
        setUsername(user.username);
        await loadNotifications();
        if (!stopped) connect();
      });

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  const markNotificationsRead = async () => {
    if (!unreadCount) return;
    const csrfResponse = await fetch("/api/csrf/", {
      credentials: "same-origin",
    });
    const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
    const response = await fetch("/api/notifications/read/", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRFToken":
          csrfBody.csrfToken ?? decodeURIComponent(getCookie("csrftoken")),
      },
    });
    if (response.ok) {
      setUnreadCount(0);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at ?? new Date().toISOString(),
        })),
      );
    }
  };

  const signOut = async () => {
    const csrfResponse = await fetch("/api/csrf/", {
      credentials: "same-origin",
    });
    const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
    const response = await fetch("/api/auth/logout/", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-CSRFToken":
          csrfBody.csrfToken ?? decodeURIComponent(getCookie("csrftoken")),
      },
    });
    if (response.ok) window.location.assign("/accounts/login/");
  };

  return (
    <RealtimeContext.Provider
      value={{
        username,
        notifications,
        unreadCount,
        receiptVersion,
        markNotificationsRead,
        signOut,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value)
    throw new Error("useRealtime must be used inside RealtimeProvider");
  return value;
}
