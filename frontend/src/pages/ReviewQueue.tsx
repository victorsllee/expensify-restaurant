import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, FileText, Loader2, Calendar, ChevronDown, ChevronUp, Edit3, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/utils";

export default function ReviewQueue() {
  const navigate = useNavigate();
  const isPdf = (url: string) => url?.split('?')[0].toLowerCase().endsWith('.pdf');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState('$');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showLineItemsId, setShowLineItemsId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedIds([]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    fetchQueue();
    fetchCategories();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setDefaultCurrency(res.data.default_currency || '$');
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  };

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get('/review/queue');
      setReceipts(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch queue');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setProcessingId(id);
      await api.put(`/review/${id}/approve`);
      setReceipts(prev => prev.filter(r => r.id !== id));
      toast.success("Receipt approved");
    } catch (err: any) {
      toast.error("Failed to approve receipt: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const startEditing = (receipt: any) => {
    setEditingId(receipt.id);
    setEditForm({
      image_url: receipt.image_url, // <-- ADDED THIS LINE
      vendor: receipt.vendor,
      date: receipt.date,
      total_amount: receipt.total_amount,
      tax_amount: receipt.tax_amount,
      description: receipt.description || '',
      currency: receipt.currency || defaultCurrency,
      main_category_id: receipt.main_category?.id || null,
      track_line_items: receipt.track_line_items || false,
      line_items: receipt.line_items?.map((li: any) => ({
        id: li.id,
        description: li.description,
        amount: li.amount,
        category_id: li.category?.id || null
      })) || []
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: number) => {
    try {
      setProcessingId(id);
      await api.put(`/review/${id}`, editForm);
      setReceipts(prev => prev.map(r => {
        if (r.id === id) {
          const updatedReceipt = { ...r, ...editForm, status: 'PENDING' };
          if (editForm.main_category_id) {
            updatedReceipt.main_category = categories.find(c => c.id === editForm.main_category_id);
          }
          if (editForm.line_items) {
             updatedReceipt.line_items = updatedReceipt.line_items.map((li: any) => {
               const editedItem = editForm.line_items.find((ei: any) => ei.id === li.id);
               if (editedItem && editedItem.category_id) {
                  return { ...li, category: categories.find(c => c.id === editedItem.category_id) };
               }
               return li;
             });
          }
          return updatedReceipt;
        }
        return r;
      }));
      setEditingId(null);
      toast.success("Changes saved");
      return true;
    } catch (err: any) {
      toast.error("Failed to update receipt: " + (err.response?.data?.detail || err.message));
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const saveAndApprove = async (id: number) => {
    const success = await saveEdit(id);
    if (success) {
      await handleApprove(id);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this receipt?")) return;
    try {
      setProcessingId(id);
      await api.delete(`/review/${id}`);
      setReceipts(prev => prev.filter(r => r.id !== id));
      toast.success("Receipt deleted");
    } catch (err: any) {
      toast.error("Failed to delete receipt: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkProcessing(true);
      await api.put('/review/bulk-approve', { receipt_ids: selectedIds });
      setReceipts(prev => prev.filter(r => !selectedIds.includes(r.id)));
      toast.success(`${selectedIds.length} receipts approved`);
      setSelectedIds([]);
    } catch (err: any) {
      const message = typeof err.response?.data?.detail === 'string' 
        ? err.response.data.detail
        : JSON.stringify(err.response?.data?.detail) || err.message;
      toast.error("Bulk approval failed: " + message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkProcessing(true);
      await api.put('/review/bulk-reject', { receipt_ids: selectedIds });
      setReceipts(prev => prev.filter(r => !selectedIds.includes(r.id)));
      toast.info(`${selectedIds.length} receipts rejected`);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error("Bulk rejection failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm("Are you sure you want to permanently delete these receipts?")) return;
    try {
      setIsBulkProcessing(true);
      await api.delete('/review/bulk-delete', { data: { receipt_ids: selectedIds } });
      setReceipts(prev => prev.filter(r => !selectedIds.includes(r.id)));
      toast.success(`${selectedIds.length} receipts deleted`);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error("Bulk deletion failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Standard style for all form inputs/selects
  const inputBaseClass = "h-14 w-full bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-xl focus-visible:ring-zinc-900 font-bold text-base transition-all";
  const labelClass = "text-xs font-black uppercase tracking-widest text-zinc-400 mb-2 block";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-4 flex items-center sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 ml-2">Review Queue</h1>
        <Button variant="ghost" size="icon" onClick={fetchQueue} className="ml-2 rounded-full">
           <RefreshCw className={`h-4 w-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="ml-auto bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-amber-900/30 dark:text-amber-500 border border-amber-200 dark:border-amber-900">
          {receipts.length} total
        </span>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col gap-4">
        {error && (
          <div className="p-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/30 rounded-md border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p>Loading pending receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-4">
            <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-full">
              <CheckCircle size={48} className="text-green-500" />
            </div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">All Caught Up!</p>
            <p className="text-sm">There are no receipts waiting for review.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="select-all" 
                  checked={receipts.length > 0 && selectedIds.length === receipts.length}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedIds(receipts.map(r => r.id));
                    else setSelectedIds([]);
                  }}
                />
                <Label htmlFor="select-all" className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">Select All</Label>
              </div>
            </div>
            
            {receipts.map((receipt) => (
              <Card key={receipt.id} className={`overflow-hidden flex flex-col md:flex-row shadow-sm transition-all border-2 ${selectedIds.includes(receipt.id) ? 'border-zinc-900 dark:border-zinc-50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                 <div className={`absolute top-4 left-4 z-10 hidden md:block transition-opacity ${selectedIds.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
                   <Checkbox 
                      className="bg-white dark:bg-zinc-900 border-zinc-400 dark:border-zinc-500 w-5 h-5" 
                      checked={selectedIds.includes(receipt.id)} 
                      onCheckedChange={() => toggleSelection(receipt.id)} 
                   />
                </div>

                <div 
                  className="w-full md:w-64 md:shrink-0 bg-zinc-100 dark:bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 aspect-video md:aspect-auto flex items-center justify-center overflow-hidden relative cursor-pointer group"
                  onClick={() => toggleSelection(receipt.id)}
                >
                  <div className={`absolute top-4 left-4 z-10 md:hidden transition-opacity ${selectedIds.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    <Checkbox 
                       className="bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80 border-zinc-500 w-6 h-6 shadow-sm" 
                       checked={selectedIds.includes(receipt.id)} 
                       onCheckedChange={() => toggleSelection(receipt.id)} 
                    />
                  </div>
                  <div className={`absolute inset-0 bg-black/10 dark:bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity ${selectedIds.includes(receipt.id) ? 'opacity-10' : ''}`} />
                  {receipt.image_url ? (
                    isPdf(receipt.image_url) ? (
                      <iframe src={`${receipt.image_url}#toolbar=0&view=FitH`} className="w-full h-full border-0 absolute inset-0 pointer-events-none" title="Receipt PDF" />
                    ) : (
                      <img src={receipt.image_url} alt="Receipt" className="max-w-full max-h-full object-contain" />
                    )
                  ) : (
                    <FileText size={32} className="text-zinc-400" />
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col min-w-0">
                    <div className="flex flex-col flex-1 h-full cursor-pointer" onClick={() => toggleSelection(receipt.id)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate">
                              {receipt.status === 'PROCESSING' ? 'Processing...' : (receipt.vendor || 'Unknown Vendor')}
                            </h3>
                            {receipt.main_category && (
                              <Badge style={{ backgroundColor: receipt.main_category.color_code, color: 'white' }}>
                                {receipt.main_category.name}
                              </Badge>
                            )}
                            {receipt.status === 'PROCESSING' && (
                              <Badge variant="secondary" className="animate-pulse">
                                AI Scanning
                              </Badge>
                            )}
                            {receipt.status === 'FAILED' && (
                              <Badge variant="destructive">
                                OCR Failed
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            <Calendar size={14} className="mr-1 shrink-0" />
                            <span className="truncate">{receipt.date || 'Analyzing date...'}</span>
                          </div>
                          {receipt.description && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate italic">
                              {receipt.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                            {receipt.status === 'PROCESSING' ? '---' : `${receipt.currency}${formatCurrency(receipt.total_amount || 0, receipt.currency)}`}
                          </p>
                          {receipt.tax_amount > 0 && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              includes {receipt.currency}{formatCurrency(receipt.tax_amount || 0, receipt.currency)} tax
                            </p>
                          )}
                        </div>
                      </div>

                      {receipt.status === 'FAILED' && receipt.error_message && (
                        <div className="mb-4 p-2 text-[10px] bg-red-50 dark:bg-red-900/20 text-red-600 rounded border border-red-100 dark:border-red-800">
                          Error: {receipt.error_message}
                        </div>
                      )}

                      {receipt.track_line_items && (
                        <div className="flex gap-3 mb-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs text-zinc-500" 
                            onClick={(e) => { e.stopPropagation(); setShowLineItemsId(showLineItemsId === receipt.id ? null : receipt.id); }}
                          >
                            {showLineItemsId === receipt.id ? <ChevronUp className="mr-1 h-3 w-3"/> : <ChevronDown className="mr-1 h-3 w-3"/>}
                            {showLineItemsId === receipt.id ? "Hide Line Items" : "Show Line Items"}
                          </Button>
                        </div>
                      )}

                      {showLineItemsId === receipt.id && receipt.track_line_items && (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-md p-3 mb-6 flex-1 border border-zinc-100 dark:border-zinc-800">
                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Line Items</h4>
                          <ul className="space-y-2 max-h-32 overflow-y-auto">
                            {receipt.line_items?.map((item: any) => (
                              <li key={item.id} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2 truncate pr-4">
                                  {item.category && (
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.category.color_code }} title={item.category.name} />
                                  )}
                                  <span className="text-zinc-700 dark:text-zinc-300 truncate">{item.description}</span>
                                </div>
                                <span className="text-zinc-900 dark:text-zinc-50 font-medium shrink-0">{receipt.currency}{formatCurrency(item.amount || 0, receipt.currency)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                            
                      <div className="flex gap-3 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDelete(receipt.id); }} disabled={processingId === receipt.id || receipt.status === 'PROCESSING'}>
                           <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2" onClick={(e) => { e.stopPropagation(); startEditing(receipt); }} disabled={receipt.status === 'PROCESSING'}>
                           <Edit3 className="h-4 w-4" /> Edit
                        </Button>
                        <Button 
                          className="flex-1 bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:text-white gap-2"
                          onClick={(e) => { e.stopPropagation(); handleApprove(receipt.id); }}
                          disabled={processingId === receipt.id || receipt.status === 'PROCESSING' || receipt.status === 'FAILED'}
                        >
                          {processingId === receipt.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          Approve
                        </Button>
                      </div>
                    </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Editing Sheet */}
      <Sheet open={editingId !== null} onOpenChange={(open) => !open && cancelEditing()}>
        <SheetContent className="sm:max-w-none w-full md:w-[80vw] lg:w-[60vw] max-w-screen-xl p-0 border-l border-zinc-200 dark:border-zinc-800">
          <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
            {/* Left Panel: Image */}
            <div className="hidden lg:flex flex-col h-full bg-zinc-100 dark:bg-zinc-900/50 p-6 sticky top-0 col-span-2">
              <div className="w-full h-full rounded-2xl bg-white dark:bg-black overflow-hidden shadow-inner border border-zinc-200 dark:border-zinc-800">
                {editForm.image_url && (
                  isPdf(editForm.image_url) ? (
                    <iframe src={`${editForm.image_url}#toolbar=0&view=FitH`} className="w-full h-full border-0" title="Receipt PDF" />
                  ) : (
                    <img src={editForm.image_url} alt="Receipt" className="w-full h-full object-contain" />
                  )
                )}
              </div>
            </div>

            {/* Right Panel: Form */}
            <div className="flex flex-col h-full col-span-1 lg:col-span-3 relative overflow-hidden">
              <SheetHeader className="px-10 py-8 border-b border-zinc-100 dark:border-zinc-900 sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-20">
                <SheetTitle className="text-3xl font-black tracking-tight">Edit Receipt</SheetTitle>
                <SheetDescription className="text-base">
                  Refine the information extracted by AI.
                </SheetDescription>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto">
                <div className="px-10 py-10 space-y-12 pb-40">
                    {/* Basic Info Section */}
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className={labelClass}>Vendor / Recipient</Label>
                          <Input 
                            value={editForm.vendor || ''}
                            onChange={(e) => setEditForm({...editForm, vendor: e.target.value})}
                            className={inputBaseClass}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className={labelClass}>Date</Label>
                          <Popover>
                            <PopoverTrigger className={inputBaseClass + " flex items-center justify-start px-4"}>
                                <Calendar className="mr-3 h-5 w-5 text-zinc-400 shrink-0" />
                                <span className="truncate">{editForm.date ? format(parseISO(editForm.date), "PPP") : "Pick a date"}</span>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-zinc-200 dark:border-zinc-800" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={editForm.date ? parseISO(editForm.date) : undefined}
                                onSelect={(date) => setEditForm({...editForm, date: date ? format(date, 'yyyy-MM-dd') : ''})}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label className={labelClass}>Currency</Label>
                          <Select
                            value={editForm.currency || "$"}
                            onValueChange={(val) => setEditForm({...editForm, currency: val})}
                          >
                            <SelectTrigger className={inputBaseClass + " px-4"}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="$">$</SelectItem>
                              <SelectItem value="₫">₫</SelectItem>
                              <SelectItem value="VNĐ">VNĐ</SelectItem>
                              <SelectItem value="€">€</SelectItem>
                              <SelectItem value="£">£</SelectItem>
                              <SelectItem value="S$">S$</SelectItem>
                              <SelectItem value="RM">RM</SelectItem>
                              {defaultCurrency && !["$", "₫", "VNĐ", "€", "£", "S$", "RM"].includes(defaultCurrency) && (
                                <SelectItem value={defaultCurrency}>{defaultCurrency}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className={labelClass}>Total Amount</Label>
                          <Input 
                            type="number"
                            className={inputBaseClass + " text-2xl"}
                            value={editForm.total_amount || 0}
                            onChange={(e) => setEditForm({...editForm, total_amount: parseFloat(e.target.value) || 0})}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className={labelClass}>Memo / Description</Label>
                          <Input 
                            placeholder="What was this for?"
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            className={inputBaseClass}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Categorization Section */}
                    <div className="space-y-8">
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Categorization</h3>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label className={labelClass}>Main Category</Label>
                          <Select 
                            value={editForm.main_category_id?.toString() || ""}
                            onValueChange={(val) => setEditForm({...editForm, main_category_id: parseInt(val)})}
                          >
                            <SelectTrigger className={inputBaseClass + " h-16 px-5"}>
                              <SelectValue placeholder="Select a category">
                                 {editForm.main_category_id ? (
                                   <div className="flex items-center gap-3">
                                      <div 
                                        className="w-4 h-4 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" 
                                        style={{backgroundColor: categories.find(c => c.id === editForm.main_category_id)?.color_code}} 
                                      />
                                      <span className="font-bold">{categories.find(c => c.id === editForm.main_category_id)?.name}</span>
                                   </div>
                                 ) : "Select a category"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl p-2">
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()} className="rounded-lg py-3">
                                  <div className="flex items-center gap-3">
                                     <div className="w-3 h-3 rounded-full shadow-inner" style={{backgroundColor: c.color_code}} />
                                     <span className="font-medium text-sm">{c.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-zinc-900 dark:bg-zinc-50 border border-zinc-800 dark:border-zinc-200 rounded-2xl shadow-xl transition-all">
                          <div className="space-y-1">
                            <Label className="text-sm font-bold text-zinc-50 dark:text-zinc-900 mb-0">Track Line Items</Label>
                            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-tight">Extract individual items for analytics</p>
                          </div>
                          <Switch 
                            checked={editForm.track_line_items}
                            onCheckedChange={(checked) => setEditForm({...editForm, track_line_items: checked})}
                            className="scale-125 data-[state=checked]:bg-green-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Line Items Section */}
                    {editForm.track_line_items && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between">
                           <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Itemized Breakdown</h3>
                           <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-black">{editForm.line_items?.length || 0} Items</Badge>
                        </div>
                        
                        <div className="space-y-4">
                          {editForm.line_items?.map((item: any, idx: number) => (
                            <div key={item.id} className="p-6 bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-2xl shadow-sm hover:border-zinc-200 dark:hover:border-zinc-800 transition-all space-y-4">
                              <div className="flex justify-between items-start">
                                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight pr-4">{item.description}</span>
                                <span className="text-lg font-black font-mono text-zinc-900 dark:text-zinc-50">{editForm.currency}{formatCurrency(item.amount || 0, editForm.currency)}</span>
                              </div>
                              <Select 
                                value={item.category_id?.toString() || "none"}
                                onValueChange={(val) => {
                                  const updatedItems = [...editForm.line_items];
                                  updatedItems[idx].category_id = val === "none" ? null : parseInt(val);
                                  setEditForm({...editForm, line_items: updatedItems});
                                }}
                              >
                                <SelectTrigger className="h-12 text-sm bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 rounded-xl">
                                   <SelectValue placeholder="Category">
                                     <div className="flex items-center gap-2">
                                        {item.category_id ? (
                                          <>
                                            <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: categories.find(c => c.id === item.category_id)?.color_code}} />
                                            <span className="font-bold">{categories.find(c => c.id === item.category_id)?.name}</span>
                                          </>
                                        ) : <span className="text-zinc-400">Uncategorized</span>}
                                     </div>
                                   </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="none">Uncategorized</SelectItem>
                                  {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                      <div className="flex items-center gap-2">
                                         <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: c.color_code}} />
                                         {c.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              <SheetFooter className="px-10 py-8 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-100 dark:border-zinc-900 flex flex-row gap-4 bottom-0 left-0 right-0 z-20">
                <Button variant="outline" onClick={cancelEditing} className="flex-1 h-16 rounded-2xl font-black text-base border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all">
                  Cancel
                </Button>
                <Button 
                  onClick={() => editingId && saveEdit(editingId)} 
                  disabled={processingId !== null} 
                  className="flex-[2] h-16 rounded-2xl font-black text-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-2xl transition-all active:scale-95"
                >
                  {processingId !== null ? <Loader2 className="h-6 w-6 animate-spin" /> : "Save Changes"}
                </Button>
                <Button 
                  onClick={() => editingId && saveAndApprove(editingId)} 
                  disabled={processingId !== null} 
                  className="flex-[2] h-16 rounded-2xl font-black text-lg bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:text-white shadow-2xl transition-all active:scale-95"
                >
                  {processingId !== null ? <Loader2 className="h-6 w-6 animate-spin" /> : "Save & Approve"}
                </Button>
              </SheetFooter>
            </div>
          </div>
        </SheetContent>
      </Sheet>






      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 shadow-2xl rounded-2xl px-4 py-3 z-50 flex items-center justify-between gap-4 min-w-max border border-zinc-800 dark:border-zinc-200 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium text-zinc-50 dark:text-zinc-900 whitespace-nowrap hidden sm:inline-block">{selectedIds.length} selected</span>
          <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <Button onClick={handleBulkApprove} disabled={isBulkProcessing} size="sm" className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 font-semibold flex-1 sm:flex-none">
              {isBulkProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Approve
            </Button>
            <Button onClick={handleBulkReject} disabled={isBulkProcessing} size="sm" variant="secondary" className="font-semibold flex-1 sm:flex-none">Reject</Button>
            <Button onClick={handleBulkDelete} disabled={isBulkProcessing} size="sm" variant="destructive" className="font-semibold flex-1 sm:flex-none">Delete</Button>
          </div>
        </div>
      )}
    </div>
  );
}
