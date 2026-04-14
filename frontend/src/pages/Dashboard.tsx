import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { LogOut, Inbox, History, Loader2, Sparkles, X, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '../lib/utils';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [query, setQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  const [totalSpend, setTotalSpend] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const [defaultCurrency, setDefaultCurrency] = useState('$');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [historyRes, queueRes, settingsRes] = await Promise.all([
        api.get('/history'),
        api.get('/review/queue'),
        api.get('/settings')
      ]);
      
      const allReceipts = historyRes.data.data;
      const total = allReceipts.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);
      setTotalSpend(total);
      
      setPendingCount(queueRes.data.data.length);
      setDefaultCurrency(settingsRes.data.default_currency);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const handleAskAI = async () => {
    if (!query.trim()) return;
    
    try {
      setIsQuerying(true);
      setQueryError(null);
      const response = await api.post('/analytics/query', { query });
      setQueryResult(response.data);
    } catch (err: any) {
      setQueryError(err.response?.data?.detail || err.message || 'Failed to process query');
      setQueryResult(null);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Expensify</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400 hidden sm:block">
              {currentUser?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={() => auth.signOut()}>
              <LogOut className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats Column */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-white dark:bg-zinc-900 border-none shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Total Spend</CardTitle>
                <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                   <History className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">
                  {defaultCurrency}{formatCurrency(totalSpend, defaultCurrency)}
                </div>
                <p className="text-xs text-zinc-500 mt-1">Across all approved receipts</p>
              </CardContent>
            </Card>
            
            <Card 
              className="cursor-pointer bg-white dark:bg-zinc-900 border-none shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-zinc-400 dark:hover:ring-zinc-600 transition-all group"
              onClick={() => navigate('/review')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Pending Review</CardTitle>
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                   <Inbox className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-black ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-900 dark:text-zinc-50'}`}>
                  {pendingCount > 0 ? pendingCount : '0'}
                </div>
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  {pendingCount > 0 ? (
                    <>Needs your attention <ArrowLeft className="h-3 w-3 rotate-180 group-hover:translate-x-1 transition-transform" /></>
                  ) : 'All receipts processed'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* AI Column */}
          <div className="lg:col-span-2">
            <Card className="h-full bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 border-none shadow-xl overflow-hidden relative">
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-zinc-800 dark:bg-zinc-200 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
              
              <CardHeader className="pb-3 relative z-10">
                <CardTitle className="text-lg flex items-center gap-2 font-bold">
                  <Sparkles className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                  Ask AI Intelligence
                </CardTitle>
                <p className="text-sm text-zinc-400 dark:text-zinc-500">Query your expenses using natural language.</p>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                <div className="flex gap-2 p-1.5 bg-zinc-800 dark:bg-zinc-200 rounded-xl">
                  <Input 
                    placeholder="e.g. 'How much did I spend at Kim Yen last month?'" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    className="bg-transparent border-none text-zinc-50 dark:text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-0 h-11"
                  />
                  <Button 
                    onClick={handleAskAI} 
                    disabled={isQuerying || !query.trim()}
                    className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg px-6"
                  >
                    {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
                  </Button>
                </div>

                {/* Query Results Area */}
                {queryError && (
                  <div className="p-4 text-sm text-red-200 bg-red-900/50 rounded-xl border border-red-800/50">
                    {queryError}
                  </div>
                )}

                {queryResult && (
                  <Card className="relative overflow-hidden mt-4 shadow-2xl border-none bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 animate-in zoom-in-95 duration-200">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-2 top-2 h-7 w-7 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      onClick={() => setQueryResult(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    
                    <div className="py-3 px-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Query Result</h4>
                      <div className="text-[10px] text-zinc-400 font-mono">SQL GENERATED</div>
                    </div>
                    
                    {queryResult.data && queryResult.data.length > 0 ? (
                      <div className="max-h-[300px] overflow-auto">
                        <Table>
                          <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 sticky top-0 backdrop-blur-sm z-10">
                            <TableRow>
                              {Object.keys(queryResult.data[0]).map((key) => (
                                <TableHead key={key} className="text-[10px] font-bold h-9 uppercase tracking-wider">{key.replace('_', ' ')}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {queryResult.data.map((row: any, i: number) => (
                              <TableRow key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                                {Object.values(row).map((val: any, j: number) => (
                                  <TableCell key={j} className="text-sm py-3 font-medium">
                                    {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(2) : val) : String(val)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-sm text-zinc-500 italic">No data matched your criteria.</p>
                      </div>
                    )}
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
