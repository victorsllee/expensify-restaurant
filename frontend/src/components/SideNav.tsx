import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Inbox, History, Settings, LogOut, Receipt, Plus } from 'lucide-react';
import { auth } from '../lib/firebase';
import { Button } from './ui/button';

export default function SideNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: LayoutDashboard },
    { path: '/review', label: 'Review Queue', icon: Inbox },
    { path: '/history', label: 'Expense History', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <aside className="hidden md:flex flex-col w-80 fixed h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 z-30">
      <div className="px-6 py-8">
        <Link to="/" className="flex items-center gap-3 mb-8 px-1">
          <div className="bg-zinc-900 dark:bg-zinc-50 p-2 rounded-xl shadow-sm">
            <Receipt className="h-5 w-5 text-white dark:text-zinc-900" />
          </div>
          <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter">EXPENSIFY</h1>
        </Link>

        <Button 
          onClick={() => navigate('/capture')}
          className="w-full justify-start gap-3 h-12 shadow-sm hover:shadow-md transition-all rounded-xl px-4 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-bold"
        >
          <Plus className="h-5 w-5" />
          Scan Receipt
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col justify-between overflow-y-auto">
        <nav className="px-4 py-2">
          <ul className="space-y-1.5">
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 h-11 rounded-xl text-sm font-bold transition-all ${
                    isActive(item.path)
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                      : 'text-zinc-500 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-50'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-4 py-6 border-t border-zinc-100 dark:border-zinc-900">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 h-11 rounded-xl text-sm font-bold text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 transition-all" 
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 text-zinc-400 group-hover:text-red-600" />
            Log Out
          </Button>
        </div>
      </div>
    </aside>
  );
}
