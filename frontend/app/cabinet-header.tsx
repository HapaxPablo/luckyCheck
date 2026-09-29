"use client";

import {
  Bell,
  ChevronLeft,
  ClipboardList,
  FileText,
  LogIn,
  LogOut,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRealtime } from "./realtime-provider";

type Props = { active?: "cabinet" | "form" };

export function CabinetHeader({ active = "cabinet" }: Props) {
  const {
    username,
    notifications,
    unreadCount,
    markNotificationsRead,
    signOut,
  } = useRealtime();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const displayName = username ?? "Гость";
  const initials = displayName.slice(0, 2).toUpperCase();

  const openNotifications = async () => {
    setNotificationsOpen((current) => !current);
    if (!notificationsOpen) await markNotificationsRead();
  };

  return (
    <header className="cabinet-header">
      <Link className="wordmark" href="/">
        ЧЕК
        <br />
        НА УДАЧУ
      </Link>
      <Link className="back-link" href="/">
        <ChevronLeft aria-hidden size={17} />
        На сайт
      </Link>
      <nav className="cabinet-nav" aria-label="Основная навигация">
        <Link
          className={`nav-link${active === "cabinet" ? " active" : ""}`}
          href="/cabinet"
        >
          <ClipboardList aria-hidden size={16} />
          Личный кабинет
        </Link>
        <span className="nav-link" aria-disabled="true">
          <FileText aria-hidden size={16} />
          Правила
        </span>
        <span className="nav-link" aria-disabled="true">
          <UserRound aria-hidden size={16} />
          Профиль
        </span>
      </nav>
      <div className="profile-summary">
        <div className="notification-menu">
          <button
            className="notification-button"
            type="button"
            aria-label="Уведомления"
            aria-expanded={notificationsOpen}
            onClick={openNotifications}
          >
            <Bell aria-hidden size={19} />
            {unreadCount ? (
              <b className="notification-count">
                {unreadCount > 99 ? "99+" : unreadCount}
              </b>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div className="notification-dropdown">
              {notifications.length ? (
                notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={notification.read_at ? "" : "unread"}
                  >
                    <b>{notification.status_label}</b>
                    <span>{notification.message}</span>
                    <time>
                      {new Date(notification.created_at).toLocaleString(
                        "ru-RU",
                      )}
                    </time>
                  </article>
                ))
              ) : (
                <p>Нет уведомлений</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="profile-menu">
          <button
            className="profile-trigger"
            type="button"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((current) => !current)}
          >
            <span className="avatar" aria-hidden>
              {initials}
            </span>
            <span>
              <b>{displayName}</b>
              <small>{username ? "Авторизован" : "Войдите в аккаунт"}</small>
            </span>
          </button>
          {profileOpen ? (
            <div className="profile-dropdown" role="menu">
              {username ? (
                <button type="button" role="menuitem" onClick={signOut}>
                  <LogOut aria-hidden size={16} />
                  Выйти из аккаунта
                </button>
              ) : (
                <Link role="menuitem" href="/accounts/login/">
                  <LogIn aria-hidden size={16} />
                  Войти в аккаунт
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
