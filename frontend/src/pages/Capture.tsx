import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, ArrowLeft, MousePointerClick } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUpload } from '../contexts/UploadContext';

export default function Capture() {
  const navigate = useNavigate();
  const { uploadFiles } = useUpload();
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection (shared logic)
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    // Filter for images and PDFs
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') || file.type === 'application/pdf'
    );

    if (validFiles.length === 0) {
      toast.error("Please upload images or PDF files only.");
      return;
    }

    uploadFiles(validFiles);
    navigate('/review');
  }, [uploadFiles, navigate]);

  // Handle Paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) pastedFiles.push(blob);
        }
      }

      if (pastedFiles.length > 0) {
        toast.success(`Pasted ${pastedFiles.length} image(s) from clipboard`);
        processFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  // Handle Drag & Drop
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-sm px-4 py-4 flex items-center sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 ml-2 tracking-tight">ADD RECEIPT</h1>
      </header>

      <main className="flex-1 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl h-[500px] relative">
          {/* Main Dropzone Area */}
          <div 
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full h-full border-4 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center transition-all cursor-pointer group relative overflow-hidden
              ${isDragging 
                ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900 scale-[1.02]' 
                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
          >
            {/* Background Texture/Animation for dragging */}
            {isDragging && (
              <div className="absolute inset-0 bg-zinc-900/5 dark:bg-zinc-50/5 animate-pulse" />
            )}

            <div className="bg-zinc-100 dark:bg-zinc-900 p-8 rounded-full mb-8 group-hover:scale-110 transition-transform">
              <Upload size={48} className={`${isDragging ? 'text-zinc-900 dark:text-zinc-50 animate-bounce' : 'text-zinc-400'}`} />
            </div>

            <div className="text-center space-y-3 z-10">
              <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
                Drag & Drop Receipts
              </h2>
              <p className="text-zinc-500 font-medium text-lg">
                or click here to upload from your files
              </p>
              <div className="pt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800">Cmd + V to Paste</Badge>
                <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800">PDF Support</Badge>
              </div>
            </div>
          </div>

          {/* Mobile Quick Action - Floating Camera */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Button 
              size="lg" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="h-16 rounded-2xl border-2 font-bold text-lg gap-3"
            >
              <Camera className="h-6 w-6" />
              Use Camera
            </Button>
            
            <Button 
              size="lg" 
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="h-16 rounded-2xl font-bold text-lg gap-3"
            >
              <MousePointerClick className="h-6 w-6" />
              Select Files
            </Button>
          </div>
        </div>

        {/* Hidden Inputs */}
        <input 
          type="file" 
          ref={cameraInputRef} 
          className="hidden" 
          accept="image/*"
          capture="environment" 
          onChange={(e) => processFiles(Array.from(e.target.files || []))}
        />

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,application/pdf"
          multiple
          onChange={(e) => processFiles(Array.from(e.target.files || []))}
        />

        {/* Helpful Tip Footer */}
        <div className="mt-20 text-center space-y-2 opacity-50 max-w-sm">
           <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Pro Tip</p>
           <p className="text-sm text-zinc-500 font-medium italic">
             "Did you know? You can take a screenshot and paste it directly here to skip the file picker."
           </p>
        </div>
      </main>
    </div>
  );
}
