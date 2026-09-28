import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Чек на удачу",
  description: "Регистрация чеков в промо-акции",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}

