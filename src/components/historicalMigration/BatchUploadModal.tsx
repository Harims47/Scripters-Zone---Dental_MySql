import React, { useState } from 'react';
import { Upload, FileText, Image as ImageIcon, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'react-hot-toast';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (batchId: string) => void;
}

interface SelectedFileItem {
  file: File;
  name: string;
  size: number;
  type: string;
  estimatedPages: number;
  base64: string;
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [batchName, setBatchName] = useState('');
  const [files, setFiles] = useState<SelectedFileItem[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const totalEstimatedPages = files.reduce((acc, f) => acc + f.estimatedPages, 0);
  const isOverLimit = totalEstimatedPages > 200;

  // Approximate PDF page count from raw buffer by regex search for /Type /Page
  const estimatePdfPages = async (file: File): Promise<number> => {
    try {
      const text = await file.text();
      const matches = text.match(/\/Type\s*\/Page\b/g);
      return matches ? Math.max(1, matches.length) : 1;
    } catch {
      return 1;
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    setIsReading(true);
    const newItems: SelectedFileItem[] = [];

    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const pages = isPdf ? await estimatePdfPages(f) : 1;
      const base64 = await fileToBase64(f);

      newItems.push({
        file: f,
        name: f.name,
        size: f.size,
        type: f.type,
        estimatedPages: pages,
        base64
      });
    }

    setFiles(prev => [...prev, ...newItems]);
    setIsReading(false);
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one document or scan to upload.');
      return;
    }

    if (totalEstimatedPages > 200) {
      toast.error(
        `Batch exceeds limit of 200 source pages (${totalEstimatedPages} selected). Please remove some files.`
      );
      return;
    }

    setIsUploading(true);
    try {
      const payload = {
        name: batchName.trim() || `Legacy Archive Box ${new Date().toLocaleDateString()}`,
        files: files.map(f => ({
          name: f.name,
          mimeType: f.type,
          base64: f.base64
        }))
      };

      const res = await fetch('/api/historical-migration/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create batch');
      }

      const data = await res.json();
      toast.success(`Batch #${data.batchId.slice(0, 8)} uploaded successfully (${data.totalPages} pages).`);
      onSuccess(data.batchId);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Upload Historical Records Batch</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Digitize handwritten records in manageable batches (Max 200 source pages/records)
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Batch Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Batch Name / Description
            </label>
            <Input
              placeholder="e.g. 2015 Legacy Archive - Box 4 (Records 1-150)"
              value={batchName}
              onChange={e => setBatchName(e.target.value)}
              className="bg-slate-50"
            />
          </div>

          {/* Upload Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Scans or Multi-page PDFs
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50/50 hover:bg-teal-50/20 rounded-xl p-6 cursor-pointer transition-all">
              <Upload className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-700">Click to browse or drop files here</span>
              <span className="text-xs text-slate-500 mt-1">Accepts single images (.jpg, .png) and multi-page .pdf</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isReading || isUploading}
              />
            </label>
          </div>

          {/* Limit Badge & Page Counter */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isOverLimit 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : totalEstimatedPages > 0 
                ? 'bg-teal-50 border-teal-200 text-teal-800'
                : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center gap-2.5">
              {isOverLimit ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
              )}
              <div>
                <div className="text-sm font-bold">
                  {totalEstimatedPages} / 200 Source Pages
                </div>
                <div className="text-xs opacity-90">
                  {isOverLimit
                    ? 'Limit exceeded: One batch cannot exceed 200 source pages/records.'
                    : 'Batch limit is 200 pages. Keep batches focused for ergonomic Head Doctor review.'}
                </div>
              </div>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Selected Files ({files.length})
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {files.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      {item.type.includes('pdf') ? (
                        <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800 truncate">{item.name}</span>
                      <span className="text-slate-400 shrink-0">
                        ({item.estimatedPages} {item.estimatedPages === 1 ? 'page' : 'pages'})
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || isReading || files.length === 0 || isOverLimit}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium"
          >
            {isUploading ? 'Uploading & Splitting...' : 'Upload & Start OCR'}
          </Button>
        </div>
      </div>
    </div>
  );
};
