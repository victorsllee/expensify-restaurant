import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, FileText, Loader2, Calendar, X, ChevronDown, ChevronUp } from 'lucide-react';
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
    } catch (err: any) {
      alert("Failed to approve receipt: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const startEditing = (receipt: any) => {
    setEditingId(receipt.id);
    setEditForm({
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
          const updatedReceipt = { ...r, ...editForm };
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
    } catch (err: any) {
      alert("Failed to update receipt: " + (err.response?.data?.detail || err.message));
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkProcessing(true);
      await api.put('/review/bulk-approve', { receipt_ids: selectedIds });
      setReceipts(prev => prev.filter(r => !selectedIds.includes(r.id)));
      setSelectedIds([]);
    } catch (err: any) {
      const message = typeof err.response?.data?.detail === 'string' 
        ? err.response.data.detail
        : JSON.stringify(err.response?.data?.detail) || err.message;
      alert("Bulk approval failed: " + message);
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
      setSelectedIds([]);
    } catch (err: any) {
      alert("Bulk rejection failed: " + (err.response?.data?.detail || err.message));
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
      setSelectedIds([]);
    } catch (err: any) {
      alert("Bulk deletion failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-4 flex items-center sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 ml-2">Review Queue</h1>
        <span className="ml-auto bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-amber-900/30 dark:text-amber-500 border border-amber-200 dark:border-amber-900">
          {receipts.length} Pending
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
                  {editingId === receipt.id ? (
                    <div className="space-y-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Edit Receipt Data</h3>
                        <Button variant="ghost" size="icon" onClick={cancelEditing} className="h-6 w-6">
                          <X size={16} />
                        </Button>
                      </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label>Vendor</Label>
                            <Input 
                              value={editForm.vendor || ''}
                              onChange={(e) => setEditForm({...editForm, vendor: e.target.value})}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Date</Label>
                            <Popover>
                              <PopoverTrigger>
                                <div className="w-full flex items-center px-3 h-9 rounded-md border border-zinc-200 dark:border-zinc-700 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                  <Calendar className="mr-2 h-4 w-4 text-zinc-400" />
                                  {editForm.date ? format(parseISO(editForm.date), "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                  mode="single"
                                  selected={editForm.date ? parseISO(editForm.date) : undefined}
                                  onSelect={(date) => setEditForm({...editForm, date: date ? format(date, 'yyyy-MM-dd') : ''})}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Total Amount</Label>
                            <div className="flex gap-2">
                              <Select
                                value={editForm.currency || "$"}
                                onValueChange={(val) => setEditForm({...editForm, currency: val})}
                              >
                                <SelectTrigger className="w-[80px] shrink-0">
                                  <SelectValue placeholder="Cur" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="$">$ (USD)</SelectItem>
                                  <SelectItem value="₫">₫ (VND)</SelectItem>
                                  <SelectItem value="€">€ (EUR)</SelectItem>
                                  <SelectItem value="£">£ (GBP)</SelectItem>
                                  <SelectItem value="S$">S$ (SGD)</SelectItem>
                                  <SelectItem value="RM">RM (MYR)</SelectItem>
                                  <SelectItem value="¥">¥ (JPY/CNY)</SelectItem>
                                  <SelectItem value="₩">₩ (KRW)</SelectItem>
                                  <SelectItem value="A$">A$ (AUD)</SelectItem>
                                  <SelectItem value="C$">C$ (CAD)</SelectItem>
                                  {defaultCurrency && !["$", "₫", "€", "£", "S$", "RM", "¥", "₩", "A$", "C$"].includes(defaultCurrency) && (
                                    <SelectItem value={defaultCurrency}>{defaultCurrency}</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              <Input 
                                type="text"
                                className="flex-1"
                                value={new Intl.NumberFormat().format(editForm.total_amount || 0)}
                                onChange={(e) => {
                                  const numericValue = parseFloat(e.target.value.replace(/,/g, ''));
                                  setEditForm({...editForm, total_amount: isNaN(numericValue) ? 0 : numericValue});
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label>Description</Label>
                            <Input 
                              placeholder="Add a brief description..."
                              value={editForm.description || ''}
                              onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2 mt-2">
                          <Label>Main Category</Label>
                          <Select 
                            value={editForm.main_category_id?.toString() || ""}
                            onValueChange={(val) => setEditForm({...editForm, main_category_id: parseInt(val)})}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a category">
                                {editForm.main_category_id ? categories.find(c => c.id === editForm.main_category_id)?.name : "Select a category"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      
                      <div className="mt-6 flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                        <div className="space-y-0.5">
                          <Label className="text-base">Save Line Items</Label>
                          <p className="text-xs text-zinc-500">
                            {editForm.track_line_items 
                              ? "Every line item will be saved and tracked individually."
                              : "Receipt will be saved as a single expense under the Main Category."}
                          </p>
                        </div>
                        <Switch 
                          checked={editForm.track_line_items}
                          onCheckedChange={(checked) => setEditForm({...editForm, track_line_items: checked})}
                        />
                      </div>

                      {editForm.track_line_items && (
                        <div className="mt-4 space-y-3">
                          <Label>Line Items Categorization</Label>
                          <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                            {editForm.line_items?.map((item: any, idx: number) => (
                             <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
                               <div className="flex-1 truncate">
                                 <span className="font-medium">{item.description}</span>
                                 <span className="text-zinc-500 ml-2">{receipt.currency}{item.amount}</span>
                               </div>
                               <div className="w-full sm:w-48 shrink-0">
                                  <Select 
                                    value={item.category_id?.toString() || "none"}
                                    onValueChange={(val) => {
                                      const updatedItems = [...editForm.line_items];
                                      updatedItems[idx].category_id = val === "none" ? null : parseInt(val);
                                      setEditForm({...editForm, line_items: updatedItems});
                                    }}
                                  >
                                    <SelectTrigger className="w-full h-8 text-xs">
                                      <SelectValue placeholder="Category">
                                        {item.category_id ? categories.find(c => c.id === item.category_id)?.name : "Category"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                               </div>
                             </div>
                          ))}
                        </div>
                      </div>
                      )}

                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={cancelEditing}>Cancel</Button>
                        <Button onClick={() => saveEdit(receipt.id)} disabled={processingId === receipt.id}>
                          {processingId === receipt.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col flex-1 h-full cursor-pointer" onClick={() => toggleSelection(receipt.id)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 truncate">{receipt.vendor}</h3>
                            {receipt.main_category && (
                              <Badge style={{ backgroundColor: receipt.main_category.color_code, color: 'white' }}>
                                {receipt.main_category.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            <Calendar size={14} className="mr-1 shrink-0" />
                            <span className="truncate">{receipt.date || 'Unknown Date'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                            {receipt.currency}{formatCurrency(receipt.total_amount || 0, receipt.currency)}
                          </p>
                          {receipt.tax_amount > 0 && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              includes {receipt.currency}{formatCurrency(receipt.tax_amount || 0, receipt.currency)} tax
                            </p>
                          )}
                        </div>
                      </div>

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
                        <Button variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); startEditing(receipt); }}>Edit Data</Button>
                        <Button 
                          className="flex-1 bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 dark:text-white"
                          onClick={(e) => { e.stopPropagation(); handleApprove(receipt.id); }}
                          disabled={processingId === receipt.id}
                        >
                          {processingId === receipt.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

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
