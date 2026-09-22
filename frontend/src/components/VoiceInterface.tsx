'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';

export interface TranscriptMsg {
  role: 'agent' | 'user';
  text: string;
  final: boolean;
  segmentId?: string;
}

interface VoiceInterfaceProps {
  isSessionActive: boolean;
  onToggleMute: () => void;
  onEndSession: () => void;
  mode?: string;
  onTranscript?: (msg: TranscriptMsg) => void;
  onRoomInfo?: (info: { roomName: string; userId: string }) => void;
}

export default function VoiceInterface({ isSessionActive, onToggleMute, onEndSession, mode, onTranscript, onRoomInfo }: VoiceInterfaceProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLDivElement | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; data: Uint8Array } | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectingRef = useRef(false);

  const attachRemoteTrack = useCallback((track: Track) => {
    if (track.kind !== Track.Kind.Audio) return;
    try {
      const el = track.attach();
      el.autoplay = true;
      // Reasonable defaults so agent speech is audible
      (el as HTMLAudioElement).volume = 1.0;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.appendChild(el);
      } else {
        // Fallback: must be in DOM to play reliably
        document.body.appendChild(el);
      }
      // Chrome autoplay policy: try to play explicitly to surface blocks
      const p = (el as HTMLAudioElement).play?.();
      if (p && typeof (p as Promise<void>).catch === 'function') {
        (p as Promise<void>).catch(() => setAudioBlocked(true));
      }
    } catch (e) {
      console.error('Failed to attach remote audio track:', e);
    }
  }, []);

  const detachRemoteTrack = useCallback((track: Track) => {
    try {
      const els = track.detach();
      els.forEach((el) => el.remove());
    } catch (e) {
      console.error('Failed to detach remote audio track:', e);
    }
  }, []);

  const stopAudioMeter = () => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.ctx.close(); } catch { /* noop */ }
      analyserRef.current = null;
    }
    setAudioLevel(0);
  };

  const startAudioMeter = () => {
    stopAudioMeter();
    const room = roomRef.current;
    if (!room) return;
    try {
      const pub = room.localParticipant.getTrackPublication('microphone' as never) as never;
      const publication = pub as { track?: { mediaStreamTrack?: MediaStreamTrack } } | undefined;
      const mediaStreamTrack = publication?.track?.mediaStreamTrack;
      if (!mediaStreamTrack) {
        // Mic not published yet — nothing to meter
        return;
      }
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyserRef.current = { ctx, analyser, data };
      audioLevelIntervalRef.current = setInterval(() => {
        if (isMutedRef.current) {
          setAudioLevel(0);
          return;
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length; // 0..255
        setAudioLevel(avg);
      }, 100);
    } catch (e) {
      console.error('Failed to start audio meter:', e);
    }
  };

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const connectToRoom = async () => {
    if (connectingRef.current || roomRef.current) return;
    connectingRef.current = true;
    try {
      setRoomStatus('connecting');
      setErrorDetail(null);
      setMicError(null);

      const liveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!liveKitUrl || !apiUrl) {
        console.error('LiveKit URL or API URL not configured');
        setErrorDetail('Missing NEXT_PUBLIC_LIVEKIT_URL / NEXT_PUBLIC_API_URL');
        setRoomStatus('error');
        connectingRef.current = false;
        return;
      }

      // Generate a room name based on the mode
      const roomName = mode ? `gravitas-${mode}-${Date.now()}` : `gravitas-${Date.now()}`;
      const userId = `user-${Date.now()}`;
      onRoomInfo?.({ roomName, userId });

      // Get a token from the backend (backend also dispatches the voice agent)
      let liveKitToken = '';
      try {
        const response = await fetch(`${apiUrl}/livekit/token?user_id=${encodeURIComponent(userId)}&room_name=${encodeURIComponent(roomName)}`);
        if (!response.ok) {
          throw new Error(`token endpoint: ${response.status}`);
        }
        const data = await response.json();
        liveKitToken = data.token;
      } catch (error) {
        console.error('Failed to get token from backend:', error);
        setErrorDetail('Backend token request failed. Is the backend running on :8000?');
        setRoomStatus('error');
        connectingRef.current = false;
        return;
      }

      if (!liveKitToken || liveKitToken === 'your-livekit-token') {
        console.error('No valid LiveKit token available');
        setErrorDetail('Invalid LiveKit token received from backend');
        setRoomStatus('error');
        connectingRef.current = false;
        return;
      }

      const room = new Room();
      roomRef.current = room;

      // Set up event listeners BEFORE connect so we don't miss tracks
      room.on(RoomEvent.TrackSubscribed, (track) => {
        console.log('Track subscribed:', track.kind, track.source);
        attachRemoteTrack(track);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        detachRemoteTrack(track);
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connected:', participant.identity);
      });

      // Live captions: forward STT (you) + TTS (agent) segments to the page
      // so the conversation is visible on screen, not just audible.
      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        try {
          const identity = (participant as { identity?: string } | undefined)?.identity ?? '';
          const isLocal = (participant as { isLocal?: boolean } | undefined)?.isLocal ?? false;
          const role: 'agent' | 'user' = isLocal || identity.startsWith('user-') ? 'user' : 'agent';
          for (const seg of segments as Array<{ text?: string; final?: boolean; id?: string }>) {
            const text = (seg?.text ?? '').trim();
            if (!text) continue;
            onTranscript?.({ role, text, final: seg?.final ?? true, segmentId: seg?.id });
          }
        } catch (e) {
          console.error('Transcription handling failed:', e);
        }
      });

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        // Browser blocked autoplay until user gesture
        setAudioBlocked(!room.canPlaybackAudio);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('Room disconnected');
        stopAudioMeter();
        setIsConnected(false);
        setRoomStatus('disconnected');
        roomRef.current = null;
      });

      // Connect to the room
      await room.connect(liveKitUrl, liveKitToken, {
        autoSubscribe: true,
      });

      // Unlock browser audio (Chrome autoplay policy)
      try {
        await room.startAudio();
      } catch (e) {
        console.warn('startAudio blocked, waiting for user gesture:', e);
        setAudioBlocked(true);
      }

      // Attach any tracks that were already subscribed before our handler ran
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.track && pub.kind === Track.Kind.Audio) {
            attachRemoteTrack(pub.track);
          }
        });
      });

      // FIX 1: publish the microphone — without this nobody hears you
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMuted(false);
      } catch (micErr: unknown) {
        console.error('Microphone enable failed:', micErr);
        const msg = micErr instanceof Error ? micErr.message : String(micErr);
        if (/permission|denied|NotAllowed/i.test(msg)) {
          setMicError('Mic blocked: allow microphone access in the browser address bar, then rejoin.');
        } else if (/not found|device/i.test(msg)) {
          setMicError('No microphone found: plug in / enable an input device, then rejoin.');
        } else {
          setMicError(`Could not start microphone: ${msg}`);
        }
        // Stay connected so you can still hear the agent / type
      }

      startAudioMeter();

      setIsConnected(true);
      setRoomStatus('connected');
      console.log('Connected to LiveKit room');

    } catch (error) {
      console.error('Failed to connect to LiveKit room:', error);
      setErrorDetail(error instanceof Error ? error.message : String(error));
      setRoomStatus('error');
      roomRef.current = null;
    } finally {
      connectingRef.current = false;
    }
  };

  const disconnectFromRoom = () => {
    stopAudioMeter();
    // Remove remote audio elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.innerHTML = '';
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
    setRoomStatus('disconnected');
  };

  const handleEnableSound = async () => {
    if (roomRef.current) {
      try {
        await roomRef.current.startAudio();
        setAudioBlocked(false);
      } catch (e) {
        console.error('startAudio failed:', e);
      }
    }
  };

  const handleToggleMute = async () => {
    if (roomRef.current) {
      const localParticipant = roomRef.current.localParticipant;
      if (localParticipant) {
        try {
          if (isMuted) {
            await localParticipant.setMicrophoneEnabled(true);
          } else {
            await localParticipant.setMicrophoneEnabled(false);
          }
          setIsMuted(!isMuted);
          onToggleMute();
        } catch (e) {
          console.error('Toggle mic failed:', e);
          setMicError('Could not toggle microphone. Check browser permissions.');
        }
        return;
      }
    }
    setIsMuted(!isMuted);
    onToggleMute();
  };

  useEffect(() => {
    if (isSessionActive && roomStatus === 'disconnected') {
      connectToRoom();
    } else if (!isSessionActive && roomRef.current) {
      disconnectFromRoom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSessionActive]);

  useEffect(() => {
    return () => {
      disconnectFromRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-start meter when mute changes (meter reads live mic)
  useEffect(() => {
    if (isConnected && !isMuted) {
      startAudioMeter();
    } else if (isMuted) {
      setAudioLevel(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted, isConnected]);

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
      {/* Hidden container: remote agent audio MUST live in the DOM to play */}
      <div ref={remoteAudioRef} style={{ display: 'none' }} aria-hidden />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card p-6 flex flex-col items-center space-y-3"
      >
        <div className="flex items-center space-x-6">
          {/* Audio Level Indicator (real mic level) */}
          <div className="flex items-center space-x-2" title={isMuted ? 'Muted' : 'Mic level'}>
            <div className="flex space-x-1 items-end h-8">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: isMuted ? 4 : Math.max(4, Math.min(32, audioLevel * 0.6 * (i + 1) * 0.35)),
                  }}
                  transition={{ duration: 0.1 }}
                  className={`w-1 rounded-full ${
                    isMuted ? 'bg-gray-600' : 'bg-gradient-to-t from-primary-500 to-accent-500'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Mute Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleToggleMute}
            disabled={roomStatus !== 'connected'}
            className={`p-4 rounded-full transition-all duration-300 ${
              isMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
            } ${roomStatus !== 'connected' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </motion.button>

          {/* End Session Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onEndSession}
            className="p-4 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-300"
          >
            <PhoneOff className="w-6 h-6" />
          </motion.button>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              roomStatus === 'connected' ? 'bg-green-500 animate-pulse' :
              roomStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              roomStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="text-sm text-gray-300">
              {roomStatus === 'connected' ? 'Live' :
               roomStatus === 'connecting' ? 'Connecting...' :
               roomStatus === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
        </div>

        {audioBlocked && roomStatus === 'connected' && (
          <button
            onClick={handleEnableSound}
            className="flex items-center space-x-2 text-xs bg-yellow-500/20 text-yellow-300 px-3 py-2 rounded-lg hover:bg-yellow-500/30"
          >
            <Volume2 className="w-4 h-4" />
            <span>Browser blocked audio — click to enable sound</span>
          </button>
        )}
        {micError && (
          <p className="text-xs text-red-300 max-w-xs text-center">{micError}</p>
        )}
        {errorDetail && roomStatus === 'error' && (
          <div className="flex flex-col items-center space-y-2">
            <p className="text-xs text-red-300 max-w-xs text-center">{errorDetail}</p>
            <button
              onClick={() => { setRoomStatus('disconnected'); }}
              className="text-xs bg-white/10 px-3 py-1 rounded-lg text-white hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
