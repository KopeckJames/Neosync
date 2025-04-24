import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useWebRTC } from '@/hooks/use-webrtc';
import { Loader2, Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  contactId: number;
  contactName: string;
  contactAvatar?: string | null;
  initialCallStatus?: 'idle' | 'calling' | 'ringing';
  initialMediaType?: 'audio' | 'video' | 'both';
  sessionId?: string;
}

export function CallDialog({
  isOpen,
  onClose,
  userId,
  contactId,
  contactName,
  contactAvatar,
  initialCallStatus = 'idle',
  initialMediaType = 'audio',
  sessionId
}: CallDialogProps) {
  const [dialogTitle, setDialogTitle] = useState('Call');
  const { toast } = useToast();
  
  // Initialize WebRTC hook
  const {
    callStatus,
    mediaType,
    isInitiator,
    isMuted,
    isCameraOff,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera
  } = useWebRTC({
    userId,
    contactId,
    onCallStatusChange: (status) => {
      // Update dialog title based on call status
      switch (status) {
        case 'calling':
          setDialogTitle('Calling...');
          break;
        case 'ringing':
          setDialogTitle('Incoming Call');
          break;
        case 'connected':
          setDialogTitle(`Call with ${contactName}`);
          break;
        case 'ended':
          setDialogTitle('Call Ended');
          // Auto close after a short delay
          setTimeout(() => {
            onClose();
          }, 1500);
          break;
      }
    }
  });
  
  // Handle dialog open/close effects
  useEffect(() => {
    // When dialog opens and we're initiating a call or getting an incoming call
    if (isOpen) {
      if (initialCallStatus === 'calling') {
        // We're making a call
        startCall(initialMediaType);
      } else if (initialCallStatus === 'ringing' && sessionId) {
        // We're receiving a call and need to show answer/decline options
        // Actual answering happens when user clicks the answer button
      }
    } else {
      // When dialog closes, ensure call is ended
      if (callStatus !== 'idle' && callStatus !== 'ended') {
        endCall();
      }
    }
  }, [isOpen, initialCallStatus, initialMediaType, sessionId, startCall, endCall, callStatus]);
  
  // Handle answer call
  const handleAnswerCall = () => {
    if (sessionId) {
      answerCall(sessionId, initialMediaType);
    }
  };
  
  // Handle decline call
  const handleDeclineCall = () => {
    if (sessionId) {
      declineCall(sessionId);
    }
    onClose();
  };
  
  // Handle end call
  const handleEndCall = () => {
    endCall();
    // Dialog will auto-close due to the call status change to 'ended'
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        // Only call onClose if we are closing the dialog
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-center">{dialogTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          {/* Call UI changes based on call status */}
          {callStatus === 'idle' || callStatus === 'calling' || callStatus === 'ringing' ? (
            // Pre-connected UI (avatar, calling/ringing status)
            <div className="flex flex-col items-center gap-4 py-8">
              <UserAvatar 
                user={{ id: contactId, displayName: contactName, avatarColor: contactAvatar }} 
                size="xl" 
              />
              <h2 className="text-xl font-semibold">{contactName}</h2>
              
              {callStatus === 'calling' && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Calling...</span>
                </div>
              )}
              
              {callStatus === 'ringing' && (
                <div className="text-primary flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary"></span>
                  <span>Incoming {initialMediaType === 'video' ? 'Video' : 'Audio'} Call</span>
                </div>
              )}
            </div>
          ) : (
            // Connected UI (video elements)
            <div className="w-full h-full flex flex-col gap-4 relative">
              {/* Remote video (large) */}
              {(mediaType === 'video' || mediaType === 'both') && (
                <div className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Contact name overlay */}
                  <div className="absolute top-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                    {contactName}
                  </div>
                </div>
              )}
              
              {/* Audio-only indicator */}
              {mediaType === 'audio' && callStatus === 'connected' && (
                <div className="flex flex-col items-center justify-center p-8 bg-secondary/30 rounded-lg">
                  <UserAvatar 
                    user={{ id: contactId, displayName: contactName, avatarColor: contactAvatar }} 
                    size="xl" 
                  />
                  <h3 className="mt-4 font-medium">{contactName}</h3>
                  <p className="text-muted-foreground text-sm mt-1">Audio Call Connected</p>
                </div>
              )}
              
              {/* Local video (small, picture-in-picture) */}
              {(mediaType === 'video' || mediaType === 'both') && (
                <div className="absolute bottom-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden shadow-lg border-2 border-background">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-center sm:justify-center gap-2">
          {/* Show appropriate buttons based on call status */}
          {callStatus === 'ringing' ? (
            // Incoming call - answer/decline buttons
            <>
              <Button 
                onClick={handleDeclineCall} 
                variant="destructive" 
                size="icon" 
                className="rounded-full h-12 w-12"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
              <Button 
                onClick={handleAnswerCall} 
                variant="default" 
                size="icon" 
                className="rounded-full h-12 w-12 bg-green-500 hover:bg-green-600"
              >
                <Phone className="h-5 w-5" />
              </Button>
            </>
          ) : callStatus === 'connected' ? (
            // On call - control buttons
            <>
              <Button 
                onClick={toggleMute} 
                variant={isMuted ? "destructive" : "outline"} 
                size="icon" 
                className="rounded-full h-12 w-12"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              
              {(mediaType === 'video' || mediaType === 'both') && (
                <Button 
                  onClick={toggleCamera} 
                  variant={isCameraOff ? "destructive" : "outline"} 
                  size="icon" 
                  className="rounded-full h-12 w-12"
                >
                  {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>
              )}
              
              <Button 
                onClick={handleEndCall} 
                variant="destructive" 
                size="icon" 
                className="rounded-full h-12 w-12"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </>
          ) : callStatus === 'calling' ? (
            // Outgoing call - cancel button
            <Button 
              onClick={handleEndCall} 
              variant="destructive" 
              size="icon" 
              className="rounded-full h-12 w-12"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          ) : (
            // Call ended or idle - close button
            <Button 
              onClick={onClose} 
              variant="outline"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}