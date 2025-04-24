import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Paperclip, X, File, Image, Video, Music, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  conversationId?: number;
  receiverId?: number;
  onFileUploaded: (response: any) => void;
  disabled?: boolean;
}

export function FileUploader({
  conversationId,
  receiverId,
  onFileUploaded,
  disabled = false
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // File size limit (50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // Supported file types
  const SUPPORTED_TYPES = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg',
    // Audio
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
    // Documents
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    
    if (!file) return;

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return;
    }

    // Check file type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError('Unsupported file type. Please select an image, video, audio, or document file.');
      return;
    }

    setSelectedFile(file);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !receiverId) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('receiverId', receiverId.toString());
      
      if (conversationId) {
        formData.append('conversationId', conversationId.toString());
      }

      // Upload using XMLHttpRequest to track progress
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          onFileUploaded(response);
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          toast({
            title: 'File uploaded successfully',
            description: `${selectedFile.name} has been sent`,
          });
        } else {
          setError(`Upload failed: ${xhr.statusText}`);
          toast({
            title: 'Upload failed',
            description: xhr.statusText || 'An error occurred during upload',
            variant: 'destructive',
          });
        }
        setIsUploading(false);
      });

      xhr.addEventListener('error', () => {
        setError('Network error occurred during upload');
        toast({
          title: 'Upload failed',
          description: 'A network error occurred',
          variant: 'destructive',
        });
        setIsUploading(false);
      });

      xhr.addEventListener('abort', () => {
        setError('Upload was aborted');
        setIsUploading(false);
      });

      // Open connection and send the request
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (error) {
      setError('An error occurred during upload');
      setIsUploading(false);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  // Get file icon based on type
  const getFileIcon = () => {
    if (!selectedFile) return <Paperclip className="w-5 h-5" />;

    if (selectedFile.type.startsWith('image/')) {
      return <Image className="w-5 h-5 text-blue-500" />;
    } else if (selectedFile.type.startsWith('video/')) {
      return <Video className="w-5 h-5 text-red-500" />;
    } else if (selectedFile.type.startsWith('audio/')) {
      return <Music className="w-5 h-5 text-purple-500" />;
    } else {
      return <File className="w-5 h-5 text-orange-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {!selectedFile ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleButtonClick}
          disabled={disabled || isUploading}
          className="rounded-full"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
      ) : (
        <div className="bg-secondary/50 rounded-md p-3 mb-2">
          <div className="flex items-center gap-2">
            {getFileIcon()}
            
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
            </div>
            
            <div className="flex items-center gap-2">
              {!isUploading ? (
                <>
                  <Button 
                    size="sm" 
                    onClick={handleUpload}
                    disabled={disabled || isUploading || !!error}
                  >
                    Send
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={handleRemoveFile}
                    disabled={disabled || isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <p className="text-xs font-medium">{uploadProgress}%</p>
              )}
            </div>
          </div>
          
          {isUploading && (
            <Progress value={uploadProgress} className="h-1 mt-2" />
          )}
          
          {error && (
            <div className="flex items-center gap-2 mt-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-xs">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}