"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CabinetHeader } from "../cabinet-header";

type Receipt = { id: number; purchased_at: string; registered_at: string; amount: string; status: string; status_label: string; rejection_reason: string };
type Response = { results: Receipt[]; pagination: { page: number; pages: number; count: number; has_next: boolean; has_previous: boolean } };
const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });
const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

function SortIcon({ name }: { name: "sort" | "sort-down" | "sort-up" | "sort-alt" }) {
  return <Image src={`/figma/${name}.svg`} alt="" width={16} height={16} />;
}

export function Cabinet() {
  const [data, setData] = useState<Response | null>(null);
  const [message, setMessage] = useState("Загружаем чеки…");
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setMessage("Загружаем чеки…");
    fetch(`/api/receipts/?page=${page}`, { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) { window.location.assign("/accounts/login/?next=/cabinet"); return null; }
        if (!response.ok) throw new Error();
        return response.json() as Promise<Response>;
      })
      .then((body) => { if (active && body) { setData(body); setMessage(""); } })
      .catch(() => { if (active) setMessage("Не удалось загрузить чеки."); });
    return () => { active = false; };
  }, [page, retry]);

  const receiptCount = data?.pagination.count ?? data?.results.length ?? 0;
  return <main className="cabinet-page"><CabinetHeader /><section className="history-card" aria-labelledby="history-title"><div className="history-heading"><h1 id="history-title">История чеков</h1><p>Чеков внесено: <b>{receiptCount} шт.</b></p></div>{message ? <div className="loading-state" role="status"><span className="loader" aria-hidden />{message}{message.includes("Не удалось") ? <button onClick={() => setRetry((value) => value + 1)}>Повторить</button> : null}</div> : null}{data?.results.length === 0 ? <div className="empty-state"><span className="receipt-illustration" aria-hidden>▤</span><h2>Здесь будет история ваших чеков</h2><p>Вы ещё не добавили ни одного чека</p><Link className="button primary-button" href="/">Зарегистрировать чек</Link></div> : null}{data && data.results.length > 0 ? <><div className="receipt-table" role="table"><div className="table-head" role="row"><span>Дата покупки <SortIcon name="sort" /></span><span>Статус <SortIcon name="sort-down" /></span><span>Сумма чека <SortIcon name="sort-up" /></span><span>Дата регистрации <SortIcon name="sort-alt" /></span><span>Информация</span></div>{data.results.map((receipt) => <article className="receipt-row" role="row" key={receipt.id}><span className="date-cell"><span className="receipt-thumb"><Image src="/figma/receipt.png" alt="" width={44} height={44} /></span>{dateTime.format(new Date(receipt.purchased_at))}</span><span><b className={`badge ${receipt.status}`}><Image src="/figma/clock.svg" alt="" width={20} height={20} />{receipt.status_label}</b></span><span>{money.format(Number(receipt.amount))}</span><span>{dateTime.format(new Date(receipt.registered_at))}</span><span className="receipt-info">{receipt.rejection_reason || (receipt.status === "approved" ? "Чек обработан" : "Чек в обработке")}</span></article>)}</div><div className="history-bottom"><p><Image src="/figma/info.svg" alt="" width={24} height={24} />Иногда проверка вашего чека может занять до 5 рабочих дней</p><Link className="button primary-button" href="/"><Image src="/figma/gift.svg" alt="" width={20} height={20} />Зарегистрировать чек</Link></div>{data.pagination.pages > 1 ? <nav className="pagination" aria-label="Пагинация чеков"><button disabled={!data.pagination.has_previous} onClick={() => setPage((value) => value - 1)}>‹</button><span>{data.pagination.page} из {data.pagination.pages}</span><button disabled={!data.pagination.has_next} onClick={() => setPage((value) => value + 1)}>›</button></nav> : null}</> : null}</section></main>;
}
