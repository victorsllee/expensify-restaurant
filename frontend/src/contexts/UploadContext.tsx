import React, { createContext, useContext, useState } from 'react';
import api from '../lib/api';

interface UploadContextType {
  isUploading: boolean;
  uploadQueue: File[];
  totalToUpload: number;
  uploadFiles: (files: File[]) => Promise<void>;
  clearUploadState: () => void;
}

const UploadContext = createContext<UploadContextType>({
  isUploading: false,
  uploadQueue: [],
  totalToUpload: 0,
  uploadFiles: async () => {},
  clearUploadState: () => {}
});

export const useUpload = () => useContext(UploadContext);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [totalToUpload, setTotalToUpload] = useState(0);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadQueue(files);
    setTotalToUpload(files.length);

    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/receipts/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      });

      await Promise.all(uploadPromises);
      // Wait an extra second for good UX
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error("Upload failed", err);
      // Ideally show a toast notification here
      alert("Some files failed to upload.");
    } finally {
      setIsUploading(false);
      setUploadQueue([]);
      setTotalToUpload(0);
    }
  };

  const clearUploadState = () => {
    setIsUploading(false);
    setUploadQueue([]);
    setTotalToUpload(0);
  };

  return (
    <UploadContext.Provider value={{ isUploading, uploadQueue, totalToUpload, uploadFiles, clearUploadState }}>
      {children}
      {/* Global Upload Progress Toast */}
      {isUploading && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-3 text-sm font-medium animate-in slide-in-from-bottom-5">
          <div className="h-4 w-4 rounded-full border-2 border-zinc-50 dark:border-zinc-900 border-t-transparent animate-spin"></div>
          Uploading {totalToUpload} receipt{totalToUpload > 1 ? 's' : ''}... Please don't close the app.
        </div>
      )}
    </UploadContext.Provider>
  );
};