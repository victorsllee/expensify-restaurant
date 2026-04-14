import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Calendar, FileText, Filter, CheckCircle, Clock, Loader2, LayoutDashboard, Inbox, PlusCircle, History, ChevronDown, ChevronUp, Cloud, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function HistoryPage() {
  const navigate = useNavigate();
  const isPdf = (url: string) => url?.split('?')[0].toLowerCase().endsWith('.pdf');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'receipts' | 'lineItems'>('receipts');
  
  // States for expandable and editable rows
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showLineItemsId, setShowLineItemsId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  };

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

  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(id);
      setEditingId(null);
    }
  };

  const startEditing = (receipt: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(receipt.id);
    setEditForm({
      vendor: receipt.vendor,
      date: receipt.date,
      total_amount: receipt.total_amount,
      tax_amount: receipt.tax_amount,
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

  const cancelEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleResync = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessingId(id);
      await api.post(`/zoho/resync/${id}`);
      // Optimistically update the UI to show it's processing
      setReceipts(prev => prev.map(r => 
        r.id === id ? { ...r, error_message: null, status: 'PROCESSING' } : r
      ));
      // Re-fetch after a delay to get the final status.
      // Stop showing spinner after 5 seconds regardless of outcome.
      setTimeout(() => {
        fetchHistory();
        setProcessingId(null);
      }, 5000); 
    } catch (err: any) {
      alert("Failed to trigger re-sync: " + (err.response?.data?.detail || err.message));
      setProcessingId(null);
    }
  };

  const filteredReceipts = receipts.filter(r => 
    r.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.total_amount?.toString().includes(searchQuery)
  );

  const allLineItems = receipts.flatMap(r => 
    (r.line_items || []).map((li: any) => ({
      ...li,
      receipt_id: r.id,
      receipt_date: r.date,
      vendor: r.vendor,
      currency: r.currency,
      image_url: r.image_url
    }))
  );

  const filteredLineItems = allLineItems.filter(li => 
    li.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    li.amount?.toString().includes(searchQuery) ||
    li.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col pb-20">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 ml-2">Expense History</h1>
        </div>
        
        <div className="relative mt-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-zinc-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md leading-5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 dark:focus:ring-zinc-300 dark:focus:border-zinc-300 sm:text-sm"
            placeholder={viewMode === 'receipts' ? "Search vendors or amounts..." : "Search items, vendors..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button 
              className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
              onClick={() => setViewMode(viewMode === 'receipts' ? 'lineItems' : 'receipts')}
              title={`Switch to ${viewMode === 'receipts' ? 'Line Items' : 'Receipts'} view`}
            >
              <Filter size={18} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-3 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg max-w-xs">
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'receipts' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50'}`}
            onClick={() => setViewMode('receipts')}
          >
            Receipts
          </button>
          <button 
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'lineItems' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50'}`}
            onClick={() => setViewMode('lineItems')}
          >
            Line Items
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4">
        {error && (
          <div className="p-4 mb-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/30 rounded-md border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-zinc-900 dark:text-zinc-50" size={32} />
          </div>
        ) : viewMode === 'receipts' ? (
          filteredReceipts.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <FileText size={48} className="mx-auto mb-4 text-zinc-400" />
              <p>No receipts found.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredReceipts.map((receipt) => (
                  <li key={receipt.id} className="flex flex-col">
                  {/* Summary Row (Always visible) */}
                  <div 
                    onClick={() => toggleExpand(receipt.id)}
                    className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 relative">
                       {receipt.image_url ? (
                         isPdf(receipt.image_url) ? (
                           <iframe src={`${receipt.image_url}#toolbar=0&view=FitH`} className="w-full h-full border-0 absolute inset-0 pointer-events-none" title="PDF Thumbnail" />
                         ) : (
                           <img src={receipt.image_url} alt="" className="w-full h-full object-cover" />
                         )
                       ) : (
                         <FileText size={20} className="text-zinc-400" />
                       )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                        {receipt.vendor}
                      </p>
                      <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        <Calendar size={12} className="mr-1" />
                        {receipt.date || 'Unknown'}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        {receipt.currency}{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(receipt.total_amount || 0)}
                      </p>
                      <div className="flex flex-col items-end gap-1 mt-1">
                        {receipt.status === 'APPROVED' ? (
                          <span className="flex items-center text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                            <CheckCircle size={10} className="mr-1" /> Approved
                          </span>
                        ) : receipt.status === 'FAILED' ? (
                          <span className="flex items-center text-[10px] font-medium text-red-600 dark:text-red-400" title={receipt.error_message || "Processing failed"}>
                            <AlertCircle size={10} className="mr-1" /> Failed
                          </span>
                        ) : receipt.status === 'PROCESSING' ? (
                          <span className="flex items-center text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            <Loader2 size={10} className="mr-1 animate-spin" /> Processing
                          </span>
                        ) : (
                          <span className="flex items-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                            <Clock size={10} className="mr-1" /> Pending
                          </span>
                        )}
                        {receipt.zoho_expense_id ? (
                          <span className="flex items-center text-[10px] font-medium text-blue-600 dark:text-blue-400" title={`Synced to Zoho (ID: ${receipt.zoho_expense_id})`}>
                            <Cloud size={10} className="mr-1" /> Synced
                          </span>
                        ) : receipt.error_message?.toLowerCase().includes("zoho") ? (
                          <span className="flex items-center text-[10px] font-medium text-red-600 dark:text-red-400" title={receipt.error_message}>
                            <AlertCircle size={10} className="mr-1" /> Sync Failed
                          </span>
                        ) : null}

                        {receipt.error_message?.toLowerCase().includes("zoho") && (
                          <button onClick={(e) => handleResync(receipt.id, e)} disabled={processingId === receipt.id} className="flex items-center text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                            <RefreshCw size={10} className={`mr-1 ${processingId === receipt.id ? 'animate-spin' : ''}`} />
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details Row */}
                  {expandedId === receipt.id && (
                    <div className="p-4 bg-zinc-50/50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row gap-6">
                      
                      {/* Left: Image Thumbnail */}
                      <div className="w-full md:w-48 shrink-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md flex items-center justify-center aspect-video md:aspect-auto overflow-hidden relative">
                        {receipt.image_url ? (
                          isPdf(receipt.image_url) ? (
                            <iframe src={`${receipt.image_url}#toolbar=0&view=FitH`} className="w-full h-full border-0 absolute inset-0" title="PDF Preview" />
                          ) : (
                            <img src={receipt.image_url} alt="Receipt" className="max-w-full max-h-full object-contain" />
                          )
                        ) : (
                          <FileText size={32} className="text-zinc-400" />
                        )}
                      </div>

                      {/* Right: Data / Edit Form */}
                      <div className="flex-1 flex flex-col min-w-0">
                        {editingId === receipt.id ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Edit Receipt Data</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Vendor</label>
                                <input 
                                  type="text" 
                                  className="w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm py-1.5 px-3 focus:ring-zinc-900 focus:border-zinc-900 dark:focus:ring-zinc-300 dark:focus:border-zinc-300 dark:text-white"
                                  value={editForm.vendor || ''}
                                  onChange={(e) => setEditForm({...editForm, vendor: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Date (YYYY-MM-DD)</label>
                                <input 
                                  type="text" 
                                  className="w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm py-1.5 px-3 focus:ring-zinc-900 focus:border-zinc-900 dark:focus:ring-zinc-300 dark:focus:border-zinc-300 dark:text-white"
                                  value={editForm.date || ''}
                                  onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Total Amount ({receipt.currency})</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm py-1.5 px-3 focus:ring-zinc-900 focus:border-zinc-900 dark:focus:ring-zinc-300 dark:focus:border-zinc-300 dark:text-white"
                                  value={editForm.total_amount || 0}
                                  onChange={(e) => setEditForm({...editForm, total_amount: parseFloat(e.target.value) || 0})}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Tax Amount ({receipt.currency})</label>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full rounded-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm py-1.5 px-3 focus:ring-zinc-900 focus:border-zinc-900 dark:focus:ring-zinc-300 dark:focus:border-zinc-300 dark:text-white"
                                  value={editForm.tax_amount || 0}
                                  onChange={(e) => setEditForm({...editForm, tax_amount: parseFloat(e.target.value) || 0})}
                                />
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
                            </div>
                            
                            {/* Track Line Items Toggle */}
                            <div className="mt-6 flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md">
                              <div className="space-y-0.5">
                                <Label className="text-base">Save Line Items</Label>
                                <p className="text-xs text-zinc-500">
                                  {editForm.track_line_items 
                                    ? "Every line item is saved and tracked individually."
                                    : "Receipt is saved as a single expense under the Main Category."}
                                </p>
                              </div>
                              <Switch 
                                checked={editForm.track_line_items}
                                onCheckedChange={(checked) => setEditForm({...editForm, track_line_items: checked})}
                              />
                            </div>

                            {/* Line Items Edit (Only visible if tracking) */}
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
                              <button 
                                onClick={cancelEditing}
                                className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700"
                              >
                                Cancel
                              </button>
                              <button 
                                onClick={(e) => saveEdit(receipt.id, e)}
                                disabled={processingId === receipt.id}
                                className="px-4 py-2 text-sm bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-900/90 dark:hover:bg-zinc-50/90 rounded-md flex items-center gap-2"
                              >
                                {processingId === receipt.id && <Loader2 size={14} className="animate-spin" />}
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Details</h3>
                              {receipt.track_line_items && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 text-xs text-zinc-500" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowLineItemsId(showLineItemsId === receipt.id ? null : receipt.id);
                                  }}
                                >
                                  {showLineItemsId === receipt.id ? <ChevronUp className="mr-1 h-3 w-3"/> : <ChevronDown className="mr-1 h-3 w-3"/>}
                                  {showLineItemsId === receipt.id ? "Hide Line Items" : "Show Line Items"}
                                </Button>
                              )}
                            </div>

                            {showLineItemsId === receipt.id && receipt.track_line_items && (
                              <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md p-3 mb-4">
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
                                      <span className="text-zinc-900 dark:text-zinc-50 font-medium shrink-0">{receipt.currency}{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(item.amount || 0)}</span>
                                    </li>
                                  ))}
                                  {(!receipt.line_items || receipt.line_items.length === 0) && (
                                    <li className="text-sm text-zinc-500 italic">No line items.</li>
                                  )}
                                </ul>
                              </div>
                            )}
                            
                            <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                              <button 
                                onClick={(e) => startEditing(receipt, e)}
                                className="py-2 px-4 rounded-md border border-zinc-300 dark:border-zinc-600 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                              >
                                Edit Data
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : filteredLineItems.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <FileText size={48} className="mx-auto mb-4 text-zinc-400" />
              <p>No line items found.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-md shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredLineItems.map((li, idx) => (
                  <li key={`${li.receipt_id}-${li.id}-${idx}`} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center gap-4">
                    <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 relative">
                       {li.image_url ? (
                         isPdf(li.image_url) ? (
                           <iframe src={`${li.image_url}#toolbar=0&view=FitH`} className="w-full h-full border-0 absolute inset-0 pointer-events-none" title="PDF Thumbnail" />
                         ) : (
                           <img src={li.image_url} alt="" className="w-full h-full object-cover" />
                         )
                       ) : (
                         <FileText size={20} className="text-zinc-400" />
                       )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 truncate">
                          {li.description}
                        </p>
                        {li.category && (
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: li.category.color_code }} title={li.category.name} />
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        <span className="flex items-center truncate">
                          <span className="font-medium mr-1 text-zinc-700 dark:text-zinc-300">Vendor:</span> {li.vendor}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center">
                          <Calendar size={12} className="mr-1" />
                          {li.receipt_date || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      {li.currency || "$"}{new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(li.amount || 0)}
                    </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
        )}
      </main>


    </div>
  );
}