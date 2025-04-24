import React, { useState } from 'react';
import { AttachmentWithThumbnail } from '@shared/schema';
import { 
  File, 
  Image as ImageIcon, 
  Play, 
  Download, 
  Volume2, 
  FileText, 
  FileType,  // Changed from FilePdf 
  FileImage,
  ExternalLink
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface AttachmentPreviewProps {
  attachment: AttachmentWithThumbnail;
  messageType: string;
}

export function AttachmentPreview({ attachment, messageType }: AttachmentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to get the full URL for an attachment
  const getUrl = (path: string) => {
    if (path.startsWith('http')) return path;
    // If the path doesn't start with '/', add it
    return path.startsWith('/') ? path : `/${path}`;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon based on type
  const getFileIcon = () => {
    if (messageType === 'image') {
      return <FileImage className="h-8 w-8 text-blue-500" />;
    } else if (messageType === 'video') {
      return <Play className="h-8 w-8 text-red-500" />;
    } else if (messageType === 'audio') {
      return <Volume2 className="h-8 w-8 text-purple-500" />;
    } else if (attachment.fileType === 'application/pdf') {
      return <FileType className="h-8 w-8 text-red-600" />;
    } else if (attachment.fileType === 'text/plain') {
      return <FileText className="h-8 w-8 text-gray-600" />;
    } else {
      return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getUrl(attachment.downloadUrl);
    window.open(url, '_blank');
  };

  // Determine what kind of preview to show
  const renderPreview = () => {
    const url = getUrl(attachment.downloadUrl);

    if (messageType === 'image') {
      return (
        <div className="relative group">
          <div className="overflow-hidden rounded-md">
            <img 
              src={url} 
              alt={attachment.filename} 
              className="object-cover w-full max-h-48 rounded-md transition-transform hover:scale-105"
            />
          </div>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              size="icon" 
              variant="secondary" 
              onClick={handleDownload}
              className="bg-background/80 backdrop-blur-sm"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    }

    if (messageType === 'video') {
      return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <div className="relative group cursor-pointer overflow-hidden rounded-md">
              {attachment.thumbnailUrl ? (
                <img 
                  src={getUrl(attachment.thumbnailUrl)} 
                  alt={attachment.filename} 
                  className="object-cover w-full max-h-48 rounded-md"
                />
              ) : (
                <div className="bg-secondary flex items-center justify-center w-full h-48 rounded-md">
                  <Play className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
                <Play className="h-12 w-12 text-white" />
              </div>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[80vw] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{attachment.filename}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 overflow-hidden rounded-md">
              <video 
                controls 
                className="w-full max-h-[70vh]" 
                src={url}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="flex justify-between mt-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    if (messageType === 'audio') {
      return (
        <div className="bg-secondary p-4 rounded-md">
          <div className="flex items-center gap-3 mb-3">
            <Volume2 className="h-6 w-6 text-purple-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachment.filename}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
            </div>
          </div>
          <audio controls className="w-full">
            <source src={url} type={attachment.fileType} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    // Default file attachment
    return (
      <div className="bg-secondary p-4 rounded-md flex items-start gap-3 group">
        {getFileIcon()}
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
        </div>
        
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleDownload}
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return renderPreview();
}