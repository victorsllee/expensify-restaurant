import { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Search, Calendar as CalendarIcon, FileText, CheckCircle, 
  Loader2, Cloud, AlertCircle, RefreshCw, X, ArrowDown, 
  ArrowUp, SlidersHorizontal, RotateCcw, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatCurrency, cn } from '../lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, isValid } from "date-fns";

interface FilterState {
  search: string;
  dateRange: { from: Date | undefined; to: Date | undefined };
  statuses: string[];
  syncStatus: 'all' | 'synced' | 'not_synced';
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const isPdf = (url: string) => url?.split('?')[0].toLowerCase().endsWith('.pdf');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'receipts' | 'lineItems'>('receipts');
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateRange: { from: undefined, to: undefined },
    statuses: [],
    syncStatus: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/history');
      setReceipts(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const handleResync = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessingId(id);
      await api.post(`/zoho/resync/${id}`);
      setReceipts((prev: any[]) => prev.map((r: any) => 
        r.id === id ? { ...r, error_message: null, status: 'PROCESSING' } : r
      ));
      toast.info("Re-sync triggered");
      setTimeout(() => {
        fetchHistory();
        setProcessingId(null);
      }, 5000); 
    } catch (err: any) {
      toast.error("Failed to trigger re-sync: " + (err.response?.data?.detail || err.message));
      setProcessingId(null);
    }
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      dateRange: { from: undefined, to: undefined },
      statuses: [],
      syncStatus: 'all',
      sortBy: 'date',
      sortOrder: 'desc',
    });
  };

  const filteredAndSortedData = useMemo(() => {
    const data = Array.isArray(receipts) ? receipts : [];
    
    let processed = data.map(r => ({
      ...r,
      parsedDate: r.date ? parseISO(r.date) : new Date(0),
    }));

    processed = processed.filter(r => {
      const searchMatch = !filters.search || 
        r.vendor?.toLowerCase().includes(filters.search.toLowerCase()) ||
        r.total_amount?.toString().includes(filters.search) ||
        r.line_items?.some((li: any) => li.description?.toLowerCase().includes(filters.search.toLowerCase()));

      let dateMatch = true;
      if (filters.dateRange.from) {
        const start = startOfDay(filters.dateRange.from);
        const end = filters.dateRange.to ? endOfDay(filters.dateRange.to) : endOfDay(filters.dateRange.from);
        const receiptDate = r.date ? parseISO(r.date) : null;
        dateMatch = (receiptDate && isValid(receiptDate)) ? isWithinInterval(receiptDate, { start, end }) : false;
      }

      const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(r.status);
      let syncMatch = true;
      if (filters.syncStatus === 'synced') syncMatch = !!r.zoho_expense_id;
      if (filters.syncStatus === 'not_synced') syncMatch = !r.zoho_expense_id;

      return searchMatch && dateMatch && statusMatch && syncMatch;
    });

    processed.sort((a, b) => {
      const valA = filters.sortBy === 'date' ? (isValid(a.parsedDate) ? a.parsedDate.getTime() : 0) : (a.total_amount || 0);
      const valB = filters.sortBy === 'date' ? (isValid(b.parsedDate) ? b.parsedDate.getTime() : 0) : (b.total_amount || 0);
      return filters.sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    if (viewMode === 'lineItems') {
      return processed.flatMap(r => 
        (r.line_items || []).map((li: any) => ({
          ...li,
          receipt_id: r.id,
          receipt_date: r.date,
          vendor: r.vendor,
          currency: r.currency,
          image_url: r.image_url,
          status: r.status,
          zoho_expense_id: r.zoho_expense_id,
          error_message: r.error_message
        }))
      );
    }

    return processed;
  }, [receipts, filters, viewMode]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 px-4 py-4 space-y-4 shadow-sm backdrop-blur-md bg-white/90 dark:bg-zinc-900/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Expense History</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="view-mode"
              checked={viewMode === 'lineItems'}
              onCheckedChange={(checked) => setViewMode(checked ? 'lineItems' : 'receipts')}
            />
            <Label htmlFor="view-mode" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {viewMode === 'receipts' ? 'Receipts' : 'Items'}
            </Label>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search vendor, amount, items..."
              className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all shadow-inner"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="ghost" size="icon" onClick={fetchHistory} className="rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
               <RefreshCw className={cn("h-4 w-4 text-zinc-500", loading && "animate-spin")} />
            </Button>
            <Popover>
              <PopoverTrigger className="flex items-center justify-center h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors gap-2 outline-none">
                  <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
                  <span>Filters</span>
                  {(filters.statuses.length > 0 || filters.syncStatus !== 'all' || filters.dateRange.from) && (
                    <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-50 text-[10px]">
                      {(filters.statuses.length > 0 ? 1 : 0) + (filters.syncStatus !== 'all' ? 1 : 0) + (filters.dateRange.from ? 1 : 0)}
                    </Badge>
                  )}
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 rounded-2xl shadow-2xl border-zinc-200 dark:border-zinc-800" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm uppercase tracking-widest text-zinc-400">Filters</h4>
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs gap-1 text-zinc-500">
                      <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Date Range</Label>
                    <Popover>
                      <PopoverTrigger>
                        <div className="w-full flex items-center px-3 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                          {filters.dateRange.from ? (
                            filters.dateRange.to ? (
                              <>{format(filters.dateRange.from, "LLL dd, y")} - {format(filters.dateRange.to, "LLL dd, y")}</>
                            ) : (format(filters.dateRange.from, "LLL dd, y"))
                          ) : (<span>Pick a date range</span>)}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={filters.dateRange.from}
                          selected={filters.dateRange}
                          onSelect={(range: any) => setFilters({ ...filters, dateRange: range || { from: undefined, to: undefined } })}
                          numberOfMonths={1}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Approval Status</Label>
                    <div className="flex flex-wrap gap-2">
                      {['APPROVED', 'PENDING', 'FAILED'].map(status => (
                        <Badge 
                          key={status}
                          variant={filters.statuses.includes(status) ? 'default' : 'outline'}
                          className="cursor-pointer px-3 py-1 rounded-lg text-[10px] uppercase font-black"
                          onClick={() => {
                            const newStatuses = filters.statuses.includes(status)
                              ? filters.statuses.filter(s => s !== status)
                              : [...filters.statuses, status];
                            setFilters({ ...filters, statuses: newStatuses });
                          }}
                        >
                          {status}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Zoho Sync</Label>
                    <div className="flex gap-2">
                      {[{ label: 'All', value: 'all' }, { label: 'Synced', value: 'synced' }, { label: 'Not Synced', value: 'not_synced' }].map(opt => (
                        <Button
                          key={opt.value}
                          variant={filters.syncStatus === opt.value ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-[10px] rounded-lg font-black uppercase"
                          onClick={() => setFilters({ ...filters, syncStatus: opt.value as any })}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors gap-2 outline-none">
                  {filters.sortOrder === 'desc' ? <ArrowDown className="h-4 w-4 text-zinc-500" /> : <ArrowUp className="h-4 w-4 text-zinc-500" />}
                  <span>Sort</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl z-50">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500 font-black tracking-widest">Sort By</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setFilters({ ...filters, sortBy: 'date' })} className="flex items-center justify-between text-sm font-medium cursor-pointer">
                    Date {filters.sortBy === 'date' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilters({ ...filters, sortBy: 'amount' })} className="flex items-center justify-between text-sm font-medium cursor-pointer">
                    Amount {filters.sortBy === 'amount' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] uppercase text-zinc-500 font-black tracking-widest">Order</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setFilters({ ...filters, sortOrder: 'desc' })} className="flex items-center justify-between text-sm font-medium cursor-pointer">
                    Newest / Highest {filters.sortOrder === 'desc' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilters({ ...filters, sortOrder: 'asc' })} className="flex items-center justify-between text-sm font-medium cursor-pointer">
                    Oldest / Lowest {filters.sortOrder === 'asc' && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden max-w-[1600px] mx-auto w-full">
        {error && (
          <div className="p-4 mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/30 rounded-md border border-red-100 dark:border-red-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin text-zinc-900 dark:text-zinc-50" size={40} />
            <p className="text-sm font-medium text-zinc-500 animate-pulse">Fetching history...</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full gap-6">
            <div className={cn("flex-1 overflow-y-auto pr-2 space-y-4 transition-all duration-300", selectedReceiptId ? 'hidden md:block md:w-1/3 lg:w-1/4 xl:w-1/5' : 'w-full')}>
              {filteredAndSortedData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-full mb-4"><FileText size={32} className="text-zinc-300" /></div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-50">No results found</p>
                  <Button variant="link" onClick={resetFilters} className="mt-2 text-zinc-900 dark:text-zinc-50">Clear all filters</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAndSortedData.map((item: any) => {
                    const isReceipt = viewMode === 'receipts';
                    const itemId = isReceipt ? item.id : `${item.receipt_id}-${item.id}`;
                    const isSelected = selectedReceiptId === (isReceipt ? item.id : item.receipt_id);
                    return (
                      <div key={itemId} onClick={() => setSelectedReceiptId(isReceipt ? item.id : item.receipt_id)} className={cn("p-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border transition-all cursor-pointer group", isSelected ? 'border-zinc-900 dark:border-zinc-50 ring-1 ring-zinc-900 dark:ring-zinc-50 scale-[0.98]' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600')}>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-100 dark:border-zinc-700">
                            {item.image_url ? (<img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />) : (<FileText size={20} className="text-zinc-400" />)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate">{isReceipt ? item.vendor : item.description}</p>
                              {!isReceipt && item.category && (<div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.category.color_code }} />)}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                              <span className="flex items-center gap-1 uppercase tracking-tight"><CalendarIcon size={10} />{item.date || item.receipt_date || 'Unknown'}</span>
                              {!isReceipt && <span className="truncate max-w-[80px]">{item.vendor}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{item.currency || "$"}{formatCurrency(isReceipt ? item.total_amount : item.amount, item.currency || "$")}</p>
                            <div className="flex justify-end mt-1">
                               {item.zoho_expense_id ? (<Cloud size={12} className="text-blue-500" />) : item.error_message?.toLowerCase().includes("zoho") ? (<AlertCircle size={12} className="text-red-500" />) : item.status === 'APPROVED' ? (<CheckCircle size={12} className="text-green-500" />) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedReceiptId && (
              <div className="flex flex-col flex-1 bg-white dark:bg-zinc-900 md:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden absolute inset-0 z-40 md:relative md:inset-auto md:z-0 animate-in slide-in-from-right-10 duration-300">
                <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl z-10 h-14">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedReceiptId(null)}><ArrowLeft className="h-5 w-5" /></Button>
                    <div className="flex flex-wrap gap-2">
                       {(() => {
                         const receipt = receipts.find((r: any) => r.id === selectedReceiptId);
                         if (!receipt) return null;
                         return (
                           <>
                             <Badge className={cn("px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border-none", receipt.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600')}>{receipt.status}</Badge>
                             {receipt.zoho_expense_id ? (<Badge className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border-none shadow-sm">Synced to Zoho</Badge>) : (<Badge variant="outline" className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">Offline Record</Badge>)}
                           </>
                         );
                       })()}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedReceiptId(null)} className="rounded-full h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                  {(() => {
                    const receipt = receipts.find((r: any) => r.id === selectedReceiptId);
                    if (!receipt) return null;
                    return (
                      <div className="space-y-6 pb-20">
                        <div className="w-full bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 aspect-[4/3] flex items-center justify-center relative group shadow-inner">
                          {receipt.image_url ? (isPdf(receipt.image_url) ? (<iframe src={`${receipt.image_url}#toolbar=0&view=FitH`} className="w-full h-full border-0 absolute inset-0" title="Receipt PDF" />) : (<img src={receipt.image_url} alt="Receipt" className="max-w-full max-h-full object-contain group-hover:scale-[1.02] transition-transform duration-700" />)) : (<FileText size={64} className="text-zinc-200" />)}
                          <a href={receipt.image_url} target="_blank" rel="noreferrer" className="absolute bottom-6 right-6 bg-white dark:bg-zinc-900 px-4 py-2 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95">Expand Image</a>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
                          <div className="space-y-6">
                            <div className="space-y-1"><Label className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em]">Merchant</Label><p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{receipt.vendor}</p></div>
                            <div className="space-y-1"><Label className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em]">Description</Label><p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{receipt.description || '—'}</p></div>
                            <div className="space-y-1"><Label className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em]">Transaction Date</Label><div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-bold"><CalendarIcon size={18} className="text-zinc-400" /><span>{receipt.date ? format(parseISO(receipt.date), "PPP") : 'Unknown Date'}</span></div></div>
                          </div>
                          <div className="space-y-6 sm:text-right">
                            <div className="space-y-1"><Label className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em]">Total Amount</Label><p className="text-4xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter"><span className="text-lg mr-1 opacity-50 font-medium">{receipt.currency}</span>{formatCurrency(receipt.total_amount || 0, receipt.currency)}</p></div>
                            <div className="space-y-2 sm:flex sm:flex-col sm:items-end"><Label className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.2em]">Category</Label>{receipt.main_category ? (<div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm w-fit"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: receipt.main_category.color_code }} /><span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{receipt.main_category.name}</span></div>) : (<span className="text-xs text-zinc-400 italic font-bold">Uncategorized</span>)}</div>
                          </div>
                        </div>
                        {receipt.error_message?.toLowerCase().includes("zoho") && (
                          <div className="p-6 rounded-[2rem] bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-4"><div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-2xl"><RefreshCw className="h-6 w-6 text-red-600" /></div><div><h4 className="text-sm font-black text-red-900 dark:text-red-400 uppercase tracking-wider">Sync Error</h4><p className="text-xs text-red-700/70 dark:text-red-400/60 font-medium line-clamp-1">{receipt.error_message}</p></div></div>
                            <Button size="sm" onClick={(e) => handleResync(receipt.id, e)} disabled={processingId === receipt.id} className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 font-bold">{processingId === receipt.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}Retry Zoho Sync</Button>
                          </div>
                        )}
                        {receipt.line_items && receipt.line_items.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between"><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Line Itemized Details</h3><Badge variant="outline" className="text-[10px] rounded-full px-2 py-0 h-5">{receipt.line_items.length} Items</Badge></div>
                            <div className="rounded-[2rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
                              <Table>
                                <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/30">
                                  <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Item</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Category</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 pr-6">Amount</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {receipt.line_items.map((item: any) => (
                                    <TableRow key={item.id} className="border-zinc-100 dark:border-zinc-800 group/row">
                                      <TableCell className="font-bold text-xs py-4">{item.description}</TableCell>
                                      <TableCell>{item.category ? (<div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category.color_code }} /><span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{item.category.name}</span></div>) : (<span className="text-[10px] text-zinc-300 font-bold uppercase">—</span>)}</TableCell>
                                      <TableCell className="text-right pr-6"><span className="text-xs font-black text-zinc-900 dark:text-zinc-50 group-hover/row:scale-110 inline-block transition-transform">{receipt.currency}{formatCurrency(item.amount, receipt.currency)}</span></TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-end pt-6 border-t border-zinc-100 dark:border-zinc-800">
                           <Button onClick={() => navigate('/review')} variant="outline" className="rounded-xl font-bold uppercase text-[10px] tracking-widest">Edit Transaction Data</Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
