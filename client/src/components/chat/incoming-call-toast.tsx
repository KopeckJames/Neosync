import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Phone, Video, Check, X } from "lucide-react";

interface IncomingCallToastProps {
  userId: number;
  contactId: number;
  contactName: string;
  contactAvatar?: string | null;
  sessionId: string;
  mediaType: 'audio' | 'video' | 'both';
  onAccept: () => void;
  onDecline: () => void;
}

export function showIncomingCallToast({
  userId,
  contactId,
  contactName,
  contactAvatar,
  sessionId,
  mediaType,
  onAccept,
  onDecline
}: IncomingCallToastProps) {
  // Create and show the toast notification
  toast({
    title: `Incoming ${mediaType === 'video' ? 'Video' : 'Audio'} Call`,
    description: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <UserAvatar 
            user={{ id: contactId, displayName: contactName, avatarColor: contactAvatar }} 
            size="sm" 
          />
          <span className="font-medium">{contactName}</span>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-red-500"
            onClick={() => {
              onDecline();
              toast.dismiss('incoming-call');
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Decline
          </Button>
          
          <Button
            variant="default"
            size="sm"
            className="h-8 px-2 text-white bg-green-500 hover:bg-green-600"
            onClick={() => {
              onAccept();
              toast.dismiss('incoming-call');
            }}
          >
            <Check className="mr-1 h-4 w-4" />
            Answer
          </Button>
        </div>
      </div>
    ),
    action: (
      <div className="h-full flex items-center">
        {mediaType === 'video' ? (
          <Video className="h-5 w-5 text-primary animate-pulse" />
        ) : (
          <Phone className="h-5 w-5 text-primary animate-pulse" />
        )}
      </div>
    ),
    duration: 30000, // 30 seconds
    id: 'incoming-call'
  });
}