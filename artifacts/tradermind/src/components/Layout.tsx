import { Sidebar } from "./Sidebar";
import { NavRail } from "./shell/NavRail";
import { AppHeader } from "./shell/AppHeader";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* موبایل: نوار بالا + Drawer + Bottom Nav (در Sidebar) | دسکتاپ: ریل شناور + هدر */}
      <Sidebar />
      <NavRail />
      {/*
        دسکتاپ: فضای ریل شناور در سمت راست (RTL) رزرو می‌شود (--tm-rail-space).
        موبایل: padding-top برای نوار بالا + padding-bottom برای bottom nav
      */}
      <main
        className="tm-main pt-14 md:pt-0 min-h-[100dvh] flex flex-col"
        style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        <div className="hidden md:block tm-header-slot">
          <AppHeader />
        </div>
        <div className="tradermind-page-shell flex-1 p-4 md:px-6 md:py-5 max-w-[96rem] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
