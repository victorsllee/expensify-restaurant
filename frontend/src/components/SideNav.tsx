import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Inbox, History, Settings, LogOut, Receipt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';

export default function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Home', icon: LayoutDashboard },
    { path: '/review', label: 'Review Queue', icon: Inbox },
    { path: '/history', label: 'Expense History', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-64 fixed h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 z-30">
      <div className="px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <Receipt className="h-7 w-7 text-zinc-900 dark:text-zinc-50" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Expensify</h1>
        </Link>
      </div>
      
      <div className="flex-1 flex flex-col justify-between">
        <nav className="px-4 py-2">
          <ul>
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 my-1 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </div>
    </aside>
  );
}
