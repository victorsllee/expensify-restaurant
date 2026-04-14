import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Trash2, Plus, Users, Tags, Link2, Unlink, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Settings() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings Form
  const [defaultCurrency, setDefaultCurrency] = useState('$');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#000000');
  const [isAddingCat, setIsAddingCat] = useState(false);

  // Zoho Setup
  const [zohoEnabled, setZohoEnabled] = useState(false);
  const [isZohoLoading, setIsZohoLoading] = useState(false);

  // Vendor Merge Form
  const [mergeSource, setMergeSource] = useState<string>('');
  const [mergeDest, setMergeDest] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  // Category Edit State
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatColor, setEditingCatColor] = useState('#000000');
  const [isUpdatingCat, setIsUpdatingCat] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleZohoCallback(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      fetchData();
    }
  }, []);

  const handleZohoCallback = async (code: string) => {
    try {
      setLoading(true);
      await api.post(`/zoho/callback?code=${encodeURIComponent(code)}`);
      alert("Zoho connected successfully!");
      fetchData();
    } catch (e: any) {
      alert("Failed to connect to Zoho: " + (e.response?.data?.detail || e.message));
      fetchData();
    }
  };

  const handleConnectZoho = async () => {
    try {
      setIsZohoLoading(true);
      const res = await api.get('/zoho/auth-url');
      window.location.href = res.data.url;
    } catch (e: any) {
      alert("Failed to initiate Zoho connection: " + (e.response?.data?.detail || e.message));
      setIsZohoLoading(false);
    }
  };

  const handleDisconnectZoho = async () => {
    if (!confirm("Are you sure you want to disconnect Zoho? Expenses will no longer sync.")) return;
    try {
      setIsZohoLoading(true);
      await api.delete('/zoho/disconnect');
      setZohoEnabled(false);
      alert("Zoho disconnected.");
    } catch (e: any) {
      alert("Failed to disconnect Zoho: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsZohoLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catRes, venRes, setRes] = await Promise.all([
        api.get('/categories'),
        api.get('/vendors'),
        api.get('/settings')
      ]);
      setCategories(catRes.data);
      setVendors(venRes.data.data);
      setDefaultCurrency(setRes.data.default_currency);
      setZohoEnabled(setRes.data.zoho_integration_enabled);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const venRes = await api.get('/vendors');
      setVendors(venRes.data.data);
    } catch (e) {
      console.error("Failed to refetch vendors", e);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      await api.put('/settings', { default_currency: defaultCurrency });
      alert("Settings saved!");
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      setIsAddingCat(true);
      const res = await api.post('/categories', { name: newCatName, color_code: newCatColor });
      setCategories(prev => [...prev, res.data]);
      setNewCatName('');
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to add category");
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Delete this category? This might affect existing receipts.")) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to delete");
    }
  };

  const handleStartEdit = (cat: any) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
    setEditingCatColor(cat.color_code);
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatColor('#000000');
  };

  const handleSaveEdit = async () => {
    if (!editingCatId || !editingCatName.trim()) return;
    try {
      setIsUpdatingCat(true);
      const res = await api.put(`/categories/${editingCatId}`, { name: editingCatName, color_code: editingCatColor });
      setCategories(prev => prev.map(c => c.id === editingCatId ? res.data : c));
      handleCancelEdit();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to update category");
    } finally {
      setIsUpdatingCat(false);
    }
  };

  const handleMergeVendors = async () => {
    if (!mergeSource || !mergeDest || mergeSource === mergeDest) {
      alert("Please select two distinct vendors");
      return;
    }
    if (!confirm("Are you sure? This will merge all receipts into the target vendor and delete the duplicate. This cannot be undone.")) return;
    try {
      setIsMerging(true);
      await api.post('/vendors/merge', {
        primary_vendor_id: parseInt(mergeDest),
        duplicate_vendor_id: parseInt(mergeSource)
      });
      setMergeSource('');
      setMergeDest('');
      await fetchVendors();
      alert("Merged successfully!");
    } catch (e: any) {
      alert(e.response?.data?.detail || "Merge failed");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-4 sticky top-0 z-10 md:hidden">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settings & Data</h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 hidden md:block">Settings & Data</h1>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-900 dark:text-zinc-50" size={32} /></div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Tags className="h-5 w-5" /> General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-end gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 max-w-sm">
                  <div className="flex-1 space-y-1.5">
                    <Label>Default Currency Symbol</Label>
                    <Input value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value)} placeholder="e.g. $, €, RM" maxLength={3} />
                  </div>
                  <Button onClick={handleSaveSettings} disabled={isSavingSettings || !defaultCurrency.trim()}>
                    {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save
                  </Button>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 max-w-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base">Zoho Integration</Label>
                    {zohoEnabled ? <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge> : <Badge variant="outline" className="text-zinc-500">Not Connected</Badge>}
                  </div>
                  <p className="text-sm text-zinc-500">Sync your approved receipts automatically to Zoho Expense.</p>
                  <div className="pt-2">
                    {zohoEnabled ? (
                      <Button variant="destructive" size="sm" onClick={handleDisconnectZoho} disabled={isZohoLoading}>
                        {isZohoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                        Disconnect Zoho
                      </Button>
                    ) : (
                      <Button onClick={handleConnectZoho} disabled={isZohoLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isZohoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                        Connect with Zoho
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tags className="h-5 w-5" /> Categories</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    editingCatId === c.id ? (
                      <div key={c.id} className="p-2 flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
                        <Input type="color" value={editingCatColor} onChange={e => setEditingCatColor(e.target.value)} className="p-1 h-7 w-8 cursor-pointer" />
                        <Input value={editingCatName} onChange={e => setEditingCatName(e.target.value)} className="h-7" />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}><X className="h-3 w-3" /></Button>
                        <Button size="icon" className="h-6 w-6" onClick={handleSaveEdit} disabled={isUpdatingCat}>
                          {isUpdatingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </Button>
                      </div>
                    ) : (
                      <Badge key={c.id} variant="outline" className="pl-2 pr-1 py-1 flex items-center gap-2 text-sm bg-white dark:bg-zinc-900 cursor-pointer" onClick={() => handleStartEdit(c)}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color_code }} />
                        {c.name}
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-1 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" onClick={(e) => {e.stopPropagation(); handleDeleteCategory(c.id)}}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </Badge>
                    )
                  ))}
                </div>
                <div className="flex items-end gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                  <div className="flex-1 space-y-1.5">
                    <Label>New Category Name</Label>
                    <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Marketing" />
                  </div>
                  <div className="w-16 space-y-1.5">
                    <Label>Color</Label>
                    <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="p-1 h-9 cursor-pointer" />
                  </div>
                  <Button onClick={handleAddCategory} disabled={isAddingCat || !newCatName.trim()}>
                    {isAddingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5" /> Vendor Management</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="text-sm text-zinc-500 dark:text-zinc-400">You have {vendors.length} vendors. Use the tool below to clean up duplicates.</div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-4">
                  <h4 className="text-sm font-medium">Merge Vendors</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Duplicate Vendor (Will be deleted)</Label>
                      <Select value={mergeSource} onValueChange={(v) => setMergeSource(v || '')}>
                        <SelectTrigger className="w-full bg-white dark:bg-zinc-950">
                          <SelectValue placeholder="Select duplicate...">
                            {mergeSource ? vendors.find(v => v.id.toString() === mergeSource)?.name : "Select duplicate..."}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>{vendors.map(v => (<SelectItem key={v.id} value={v.id.toString()}>{v.name} ({v.receipt_count} receipts)</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Target Vendor (Will keep this one)</Label>
                      <Select value={mergeDest} onValueChange={(v) => setMergeDest(v || '')}>
                        <SelectTrigger className="w-full bg-white dark:bg-zinc-950">
                          <SelectValue placeholder="Select target...">
                            {mergeDest ? vendors.find(v => v.id.toString() === mergeDest)?.name : "Select target..."}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>{vendors.map(v => (<SelectItem key={v.id} value={v.id.toString()}>{v.name} ({v.receipt_count} receipts)</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="destructive" onClick={handleMergeVendors} disabled={!mergeSource || !mergeDest || isMerging || mergeSource === mergeDest}>
                      {isMerging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Merge Vendors
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
