import React, { useCallback } from 'react';
import { UploadedFile } from '../types';

interface FileUploaderProps {
  files: UploadedFile[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ files, onFilesSelected, onRemoveFile, disabled }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = ''; // Reset input
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-4">
      <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${disabled ? 'bg-gray-100 border-gray-300' : 'border-indigo-300 hover:bg-indigo-50 hover:border-indigo-500'}`}>
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className={`cursor-pointer flex flex-col items-center justify-center ${disabled ? 'cursor-not-allowed' : ''}`}>
          <svg className="w-12 h-12 text-indigo-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          <span className="text-lg font-medium text-slate-700">PDF 파일 선택 또는 드래그</span>
          <span className="text-sm text-slate-500 mt-1">여러 파일을 한 번에 선택할 수 있습니다.</span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {files.map((item) => (
            <div key={item.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className="bg-red-100 p-2 rounded text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-slate-800 truncate">{item.file.name}</span>
                  <span className="text-xs text-slate-500">{formatFileSize(item.file.size)}</span>
                </div>
              </div>
              <button
                onClick={() => onRemoveFile(item.id)}
                disabled={disabled}
                className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};