export interface UploadedFile {
  id: string;
  file: File;
  previewUrl?: string;
}

export interface ExtractionRequest {
  files: File[];
  instruction: string;
}

export interface ExtractionResult {
  html: string;
  timestamp: number;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}