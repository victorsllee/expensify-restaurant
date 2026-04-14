import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Inbox, PlusCircle, History, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: LayoutDashboard },
    { path: '/review', label: 'Review', icon: Inbox },
    { path: '/history', label: 'History', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 w-full bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-center h-16 pb-safe z-20 md:hidden">
      {navItems.slice(0, 2).map(item => (
        <button 
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 w-16 transition-colors ${isActive(item.path) ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50'}`}
        >
          <item.icon className="h-6 w-6" />
          <span className="text-[11px] font-medium">{item.label}</span>
        </button>
      ))}
      
      {/* Floating Quick Add Button */}
      <div className="relative -top-6">
        <Button 
          onClick={() => navigate('/capture')}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      </div>

      {navItems.slice(2).map(item => (
         <button 
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-1 w-16 transition-colors ${isActive(item.path) ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50'}`}
        >
          <item.icon className="h-6 w-6" />
          <span className="text-[11px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
