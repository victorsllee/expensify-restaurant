import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SideNav />
      <main className="md:ml-64">
        <div className="pb-16 md:pb-0">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
