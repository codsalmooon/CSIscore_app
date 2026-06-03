import { ReactNode } from "react";

type PageShellProps = {
  title: string;
  children: ReactNode;
};

export function PageShell({ children, title }: PageShellProps) {
  return (
    <main className="mx-auto w-[min(1120px,calc(100%-2rem))] px-0 pb-12 pt-4">
      <header className="flex items-center justify-between gap-4 pb-5 pt-2 max-[760px]:grid max-[760px]:items-stretch">
        <a className="text-[1.05rem] font-bold">{title}</a>
      </header>
      {children}
    </main>
  );
}
