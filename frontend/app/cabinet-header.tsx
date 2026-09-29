import Link from "next/link";

type Props = { active?: "cabinet" | "form" };

export function CabinetHeader({ active = "cabinet" }: Props) {
  return <header className="cabinet-header"><Link className="wordmark" href="/">ЧЕК<br />НА УДАЧУ</Link><Link className="back-link" href="/">← На сайт</Link><nav className="cabinet-nav" aria-label="Основная навигация"><Link className={`nav-link${active === "cabinet" ? " active" : ""}`} href="/cabinet">⌂ Личный кабинет</Link><span className="nav-link" aria-disabled="true">◇ Правила</span><span className="nav-link" aria-disabled="true">♙ Профиль</span></nav><div className="profile-summary"><span className="notification" aria-hidden>♧</span><span className="avatar" aria-hidden>ЕИ</span><span><b>Елена Иванова</b><small>nameuser@email.com</small></span></div></header>;
}
