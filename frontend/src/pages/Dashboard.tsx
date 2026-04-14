import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';
import { LogOut, PlusCircle, Inbox, LayoutDashboard, History, Loader2, Sparkles, X, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">Total Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{defaultCurrency}{totalSpend.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card 
            className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            onClick={() => navigate('/review')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-500' : ''}`}>
                {pendingCount > 0 ? `${pendingCount} items →` : 'All clear ✓'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Query Interface */}
        <Card className="bg-zinc-100/50 dark:bg-zinc-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-zinc-900 dark:text-zinc-50" />
              Ask AI about your expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="e.g. 'What is my total spend grouped by vendor?'" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                className="bg-white dark:bg-zinc-950"
              />
              <Button onClick={handleAskAI} disabled={isQuerying || !query.trim()}>
                {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
              </Button>
            </div>

            {/* Query Results Area */}
            {queryError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                {queryError}
              </div>
            )}

            {queryResult && (
              <Card className="relative overflow-hidden mt-4 shadow-none">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-2 top-2 h-6 w-6 rounded-full"
                  onClick={() => setQueryResult(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
                
                <div className="py-3 px-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Result</h4>
                </div>
                
                {queryResult.data && queryResult.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(queryResult.data[0]).map((key) => (
                            <TableHead key={key}>{key.replace('_', ' ')}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryResult.data.map((row: any, i: number) => (
                          <TableRow key={i}>
                            {Object.values(row).map((val: any, j: number) => (
                              <TableCell key={j}>
                                {typeof val === 'number' ? (val % 1 !== 0 ? val.toFixed(2) : val) : String(val)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6">
                    <p className="text-sm text-zinc-500 italic text-center">No data returned for this query.</p>
                  </div>
                )}
                
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-500 break-all">
                  Generated SQL: {queryResult.query_used}
                </div>
              </Card>
            )}
          </CardContent>
        </Card>
      </main>


    </div>
  );
}