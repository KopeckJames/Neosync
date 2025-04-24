import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '@/lib/use-websocket';
import { useToast } from '@/hooks/use-toast';

type MediaType = 'audio' | 'video' | 'both';
type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface RTCSignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: number;
  to: number;
  sessionId: string;
  payload: any;
}

interface UseWebRTCOptions {
  userId: number;
  contactId: number;
  onCallStatusChange?: (status: CallStatus) => void;
}

export function useWebRTC({ userId, contactId, onCallStatusChange }: UseWebRTCOptions) {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [mediaType, setMediaType] = useState<MediaType>('audio');
  const [isInitiator, setIsInitiator] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const { sendMessage } = useWebSocket();
  const { toast } = useToast();
  
  // Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string>('');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Handle call status change
  useEffect(() => {
    if (onCallStatusChange) {
      onCallStatusChange(callStatus);
    }
  }, [callStatus, onCallStatusChange]);
  
  // Initialize WebRTC peer connection
  const initializePeerConnection = useCallback(() => {
    // Create a new peer connection
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ]
    };
    
    // Create the peer connection
    const peerConnection = new RTCPeerConnection(config);
    peerConnectionRef.current = peerConnection;
    
    // Add event handlers
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'webrtc-signal',
          payload: {
            type: 'ice-candidate',
            from: userId,
            to: contactId,
            sessionId: sessionIdRef.current,
            payload: event.candidate
          }
        });
      }
    };
    
    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case 'connected':
          setCallStatus('connected');
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          handleEndCall();
          break;
      }
    };
    
    // Add local stream tracks to the connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    return peerConnection;
  }, [contactId, localStream, sendMessage, userId]);
  
  // Get user media (camera/microphone)
  const getMedia = useCallback(async (type: MediaType) => {
    try {
      // Define constraints based on media type
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'audio' ? false : { width: 1280, height: 720 }
      };
      
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      // Set stream to local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setMediaType(type);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: 'Media Error',
        description: 'Could not access camera or microphone',
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);
  
  // Create and send an offer to start a call
  const createOffer = useCallback(async () => {
    try {
      const peerConnection = peerConnectionRef.current || initializePeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      sendMessage({
        type: 'webrtc-signal',
        payload: {
          type: 'offer',
          from: userId,
          to: contactId,
          sessionId: sessionIdRef.current,
          payload: offer
        }
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      toast({
        title: 'Call Error',
        description: 'Could not create call offer',
        variant: 'destructive'
      });
    }
  }, [contactId, initializePeerConnection, sendMessage, toast, userId]);
  
  // Handle incoming WebRTC signaling messages
  const handleSignalingMessage = useCallback(async (message: RTCSignalMessage) => {
    try {
      const peerConnection = peerConnectionRef.current || initializePeerConnection();
      
      if (message.sessionId !== sessionIdRef.current) {
        return; // Ignore messages from different sessions
      }
      
      switch (message.type) {
        case 'offer':
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          sendMessage({
            type: 'webrtc-signal',
            payload: {
              type: 'answer',
              from: userId,
              to: contactId,
              sessionId: sessionIdRef.current,
              payload: answer
            }
          });
          
          setCallStatus('connected');
          break;
          
        case 'answer':
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
          setCallStatus('connected');
          break;
          
        case 'ice-candidate':
          if (message.payload) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.payload));
          }
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
      toast({
        title: 'Call Error',
        description: 'Error establishing connection',
        variant: 'destructive'
      });
    }
  }, [contactId, initializePeerConnection, sendMessage, toast, userId]);
  
  // Start a call
  const startCall = useCallback(async (type: MediaType = 'audio') => {
    try {
      // Generate a session ID for this call
      sessionIdRef.current = `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Set as initiator
      setIsInitiator(true);
      setCallStatus('calling');
      
      // Get media
      await getMedia(type);
      
      // Initialize peer connection
      initializePeerConnection();
      
      // Send a call request
      sendMessage({
        type: 'call-request',
        contactId,
        mediaType: type,
        sessionId: sessionIdRef.current
      });
      
      // Create offer after a short delay to make sure the call-request is processed
      setTimeout(() => {
        createOffer();
      }, 500);
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('idle');
      cleanupCall();
    }
  }, [contactId, createOffer, getMedia, initializePeerConnection, sendMessage]);
  
  // Answer an incoming call
  const answerCall = useCallback(async (sessionId: string, type: MediaType = 'audio') => {
    try {
      // Set session ID
      sessionIdRef.current = sessionId;
      
      // Set as not initiator
      setIsInitiator(false);
      setCallStatus('connected');
      
      // Get media
      await getMedia(type);
      
      // Initialize peer connection
      initializePeerConnection();
      
      // Send an answer acceptance
      sendMessage({
        type: 'call-accepted',
        contactId,
        sessionId
      });
    } catch (error) {
      console.error('Error answering call:', error);
      setCallStatus('idle');
      cleanupCall();
      
      // Send a call rejection if there was an error
      sendMessage({
        type: 'call-rejected',
        contactId,
        sessionId,
        reason: 'Failed to access media devices'
      });
    }
  }, [contactId, getMedia, initializePeerConnection, sendMessage]);
  
  // Decline an incoming call
  const declineCall = useCallback((sessionId: string) => {
    sendMessage({
      type: 'call-rejected',
      contactId,
      sessionId,
      reason: 'Call declined by user'
    });
  }, [contactId, sendMessage]);
  
  // End a call in progress
  const endCall = useCallback(() => {
    // Send end call message to the other party
    sendMessage({
      type: 'call-ended',
      contactId,
      sessionId: sessionIdRef.current
    });
    
    handleEndCall();
  }, [contactId, sendMessage]);
  
  // Handle call end (both initiated by user or remote)
  const handleEndCall = useCallback(() => {
    setCallStatus('ended');
    cleanupCall();
  }, []);
  
  // Cleanup call resources
  const cleanupCall = useCallback(() => {
    // Stop tracks in the local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Clear remote stream
    setRemoteStream(null);
    
    // Close and cleanup the peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Reset state
    setCallStatus('idle');
    sessionIdRef.current = '';
    setIsInitiator(false);
  }, [localStream]);
  
  // Toggle audio mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted, localStream]);
  
  // Toggle video
  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  }, [isCameraOff, localStream]);
  
  // Handle incoming WebRTC messages from WebSocket
  useEffect(() => {
    // Add message handler function to a global context so it can be called from outside
    // This would be replaced with a proper WebSocket message handling system in a real app
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'call-request':
            // Handle incoming call request
            if (message.to === userId && message.from === contactId) {
              setMediaType(message.mediaType || 'audio');
              setCallStatus('ringing');
              sessionIdRef.current = message.sessionId;
            }
            break;
            
          case 'call-accepted':
            // Call was accepted
            if (message.to === userId && message.from === contactId) {
              setCallStatus('connected');
            }
            break;
            
          case 'call-rejected':
            // Call was rejected
            if (message.to === userId && message.from === contactId) {
              setCallStatus('idle');
              cleanupCall();
              toast({
                title: 'Call Declined',
                description: message.reason || 'The call was declined'
              });
            }
            break;
            
          case 'call-ended':
            // Call was ended by the other party
            if (message.to === userId && message.from === contactId) {
              handleEndCall();
              toast({
                title: 'Call Ended',
                description: 'The call has ended'
              });
            }
            break;
            
          case 'webrtc-signal':
            // Handle WebRTC signaling message
            if (message.payload.to === userId && message.payload.from === contactId) {
              handleSignalingMessage(message.payload);
            }
            break;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };
    
    // Attach event listener for incoming messages
    window.addEventListener('message', handleWebSocketMessage);
    
    // Cleanup
    return () => {
      window.removeEventListener('message', handleWebSocketMessage);
      cleanupCall();
    };
  }, [cleanupCall, contactId, handleSignalingMessage, toast, userId]);
  
  return {
    // Call status and info
    callStatus,
    mediaType,
    isInitiator,
    isMuted,
    isCameraOff,
    
    // Streams
    localStream,
    remoteStream,
    
    // DOM refs
    localVideoRef,
    remoteVideoRef,
    
    // Actions
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera
  };
}