import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <SideNav />
      <BottomNav />
      <main className="md:ml-80">
        <div className="pb-24 md:pb-8">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
