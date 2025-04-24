import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Video,
  PhoneCall, 
  VideoIcon,
  AlertCircle
} from 'lucide-react';
import { CallDialog } from './call-dialog';
import { useToast } from '@/hooks/use-toast';

interface CallButtonsProps {
  userId: number;
  contactId: number;
  contactName: string;
  contactAvatar?: string | null;
  className?: string;
  incomingCall?: {
    sessionId: string;
    mediaType: 'audio' | 'video' | 'both';
  } | null;
}

export function CallButtons({
  userId,
  contactId,
  contactName,
  contactAvatar,
  className = '',
  incomingCall = null
}: CallButtonsProps) {
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [activeCallType, setActiveCallType] = useState<'audio' | 'video'>('audio');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing'>('idle');
  const { toast } = useToast();
  
  // Check if browser supports WebRTC
  const checkWebRTCSupport = () => {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      window.RTCPeerConnection
    );
  };
  
  // Start a new call
  const startCall = (type: 'audio' | 'video') => {
    if (!checkWebRTCSupport()) {
      toast({
        title: 'Your browser does not support video calls',
        description: 'Please use a modern browser like Chrome, Firefox, or Safari',
        variant: 'destructive'
      });
      return;
    }
    
    setActiveCallType(type);
    setCallStatus('calling');
    setIsCallDialogOpen(true);
  };
  
  // Show incoming call dialog
  const showIncomingCall = () => {
    if (incomingCall) {
      setActiveCallType(incomingCall.mediaType === 'video' ? 'video' : 'audio');
      setCallStatus('ringing');
      setIsCallDialogOpen(true);
    }
  };
  
  // If there's an incoming call, show the call dialog automatically
  if (incomingCall && !isCallDialogOpen) {
    showIncomingCall();
  }
  
  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full" 
          onClick={() => startCall('audio')}
          title="Start audio call"
        >
          <Phone className="h-5 w-5 text-primary" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full" 
          onClick={() => startCall('video')}
          title="Start video call"
        >
          <Video className="h-5 w-5 text-primary" />
        </Button>
      </div>
      
      {/* Call Dialog */}
      <CallDialog 
        isOpen={isCallDialogOpen}
        onClose={() => {
          setIsCallDialogOpen(false);
          setCallStatus('idle');
        }}
        userId={userId}
        contactId={contactId}
        contactName={contactName}
        contactAvatar={contactAvatar}
        initialCallStatus={callStatus}
        initialMediaType={activeCallType}
        sessionId={incomingCall?.sessionId}
      />
    </>
  );
}