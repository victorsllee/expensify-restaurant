import React, { createContext, useContext, useState } from 'react';
import { toast } from 'sonner';
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
    
    const toastId = toast.loading(`Uploading ${files.length} receipt${files.length > 1 ? 's' : ''}...`);

    try {
      const uploadPromises = files.map(file => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/receipts/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      });

      await Promise.all(uploadPromises);
      toast.success("Upload complete! Processing in background.", { id: toastId });
      // Wait an extra second for good UX
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error("Upload failed", err);
      toast.error("Some files failed to upload.", { id: toastId });
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
    </UploadContext.Provider>
  );
};