import { useState, useRef } from 'react';
import { Camera, Upload, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { useUpload } from '../contexts/UploadContext';

export default function Capture() {
  const navigate = useNavigate();
  const { uploadFiles } = useUpload();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);



  const handleUpload = async (fileToUpload?: File | React.MouseEvent) => {
    // If it's a mouse event (from the button click), ignore it as a file
    const isFile = fileToUpload instanceof File;
    const file = isFile ? fileToUpload : selectedFile;
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/receipts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Use global upload context and immediately navigate away
    uploadFiles(files);
    navigate('/review');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-4 flex items-center sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 ml-2">Capture Receipt</h1>
      </header>

      <main className="flex-1 p-4 flex flex-col items-center">
          {isUploading && !selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-zinc-900 dark:text-zinc-50" />
            <p className="text-zinc-500 font-medium">Uploading files...</p>
          </div>
        ) : !previewUrl ? (
          <div className="flex-1 w-full flex flex-col items-center justify-center space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">Snap or Upload</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Capture a clear photo of your receipt</p>
            </div>
            
            <div className="flex gap-4 w-full max-w-sm">
              <button 
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-all active:scale-95 group"
              >
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-sm group-hover:shadow-md transition-all">
                  <Camera size={28} className="text-zinc-900 dark:text-zinc-50" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-300">Camera</span>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-3 bg-zinc-100 dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-all active:scale-95 group"
              >
                <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl shadow-sm group-hover:shadow-md transition-all">
                   <Upload size={28} className="text-zinc-900 dark:text-zinc-50" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-300">Upload</span>
              </button>
            </div>
            
            {/* Camera Input */}
            <input 
              type="file" 
              ref={cameraInputRef} 
              className="hidden" 
              accept="image/*"
              capture="environment" 
              onChange={handleMultipleUpload}
            />

            {/* File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*,application/pdf"
              multiple
              onChange={handleMultipleUpload}
            />
          </div>
        ) : (
          <div className="w-full max-w-md flex flex-col gap-6">
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black aspect-[3/4] flex items-center justify-center w-full">
              {selectedFile?.type === 'application/pdf' ? (
                <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-0" title="PDF Preview" />
              ) : (
                <img src={previewUrl || ''} alt="Receipt preview" className="max-h-full object-contain" />
              )}
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            {result ? (
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
                    <CheckCircle className="h-6 w-6" />
                    <span className="font-medium">Processed Successfully</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Vendor</p>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{result.data.vendor}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Total Amount</p>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">{result.data.currency}{result.data.total_amount}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Date</p>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{result.data.date}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-1">Status</p>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500 hover:bg-amber-100 border-amber-200 dark:border-amber-900">
                        {result.system_status}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>
                      Done
                    </Button>
                    <Button className="flex-1" onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setResult(null);
                    }}>
                      Scan Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  disabled={isUploading}
                >
                  Retake
                </Button>
                <Button 
                  size="lg"
                  className="flex-[2]"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing AI...
                    </>
                  ) : (
                    'Submit Receipt'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}