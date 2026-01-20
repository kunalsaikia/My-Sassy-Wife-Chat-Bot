
import React, { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { TAPPI_PERMANENT_IMAGE } from '../App';
import { kunalsAssistantService } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
  onSave?: () => void;
  isSaved?: boolean;
  userAvatar?: string;
}

// Helper: Decode base64 to Uint8Array
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Decode PCM audio data
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSave, isSaved, userAvatar }) => {
  const isAssistant = message.role === 'assistant';
  const userName = "Kunal";
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [displayedText, setDisplayedText] = useState(isAssistant ? "" : message.content);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const typingSpeed = 15;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { 
      isMounted.current = false;
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!isAssistant) {
      setDisplayedText(message.content);
      return;
    }

    const isHistory = (Date.now() - message.timestamp.getTime()) > 2000;
    
    if (isHistory && !message.isStreaming) {
      setDisplayedText(message.content);
      return;
    }

    if (message.isStreaming) {
      setDisplayedText(message.content);
      return;
    }

    if (displayedText.length < message.content.length) {
      let currentLength = displayedText.length;
      const interval = setInterval(() => {
        if (!isMounted.current) {
          clearInterval(interval);
          return;
        }
        if (currentLength < message.content.length) {
          setDisplayedText(message.content.slice(0, currentLength + 1));
          currentLength++;
        } else {
          clearInterval(interval);
        }
      }, typingSpeed);
      return () => clearInterval(interval);
    }
  }, [message.content, message.isStreaming, isAssistant, displayedText.length, message.timestamp]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareMessage = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tappi's Wisdom",
          text: message.content,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback: Copy "share link"
      const shareUrl = `${window.location.origin}${window.location.pathname}?msg=${encodeURIComponent(message.id)}`;
      navigator.clipboard.writeText(shareUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  const toggleAudio = async () => {
    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    if (!message.content.trim()) return;

    setIsAudioLoading(true);
    try {
      const base64Audio = await kunalsAssistantService.generateSpeech(message.content);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioBuffer = await decodeAudioData(
        decodeBase64(base64Audio),
        audioContextRef.current,
        24000,
        1
      );

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        if (isMounted.current) setIsPlaying(false);
      };

      source.start();
      sourceNodeRef.current = source;
      setIsPlaying(true);
    } catch (error) {
      console.error("Audio playback error:", error);
      alert("Tappi is currently out of breath. Try again, Kunal.");
    } finally {
      if (isMounted.current) setIsAudioLoading(false);
    }
  };

  return (
    <div className={`flex w-full mb-8 message-enter group ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className={`relative max-w-[90%] md:max-w-[80%] rounded-3xl px-5 py-4 shadow-sm transition-all ${
        isAssistant 
          ? 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none' 
          : 'bg-gradient-to-br from-[#2ca089] to-[#006400] text-white rounded-br-none'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            {isAssistant ? (
              <div className="w-10 h-10 mr-3 rounded-full overflow-hidden border-2 border-orange-200">
                <img src={TAPPI_PERMANENT_IMAGE} alt="Tappi" className="w-full h-full object-cover" />
              </div>
            ) : (
              userAvatar ? (
                <div className="w-10 h-10 mr-2.5 rounded-full overflow-hidden border-2 border-white/40">
                   <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2.5 text-xs font-bold bg-white/20 text-white uppercase">
                  {userName.charAt(0)}
                </div>
              )
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">
              {isAssistant ? "Tappi" : userName}
            </span>
          </div>
          
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAssistant && (
              <>
                <button 
                  onClick={toggleAudio}
                  disabled={isAudioLoading || message.isStreaming}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30"
                  title={isPlaying ? "Stop Tappi" : "Listen to Tappi"}
                >
                  {isAudioLoading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  ) : isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
                <button 
                  onClick={shareMessage}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  title="Share Tappi's wisdom"
                >
                  {shared ? "🔗" : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  )}
                </button>
                <button 
                  onClick={onSave}
                  className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 ${isSaved ? 'text-orange-500' : 'text-slate-600 dark:text-slate-300'}`}
                  title="Save message to sidebar"
                >
                  {isSaved ? "⭐" : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  )}
                </button>
              </>
            )}
            <button 
              onClick={copyToClipboard}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Copy message"
            >
              {copied ? "✅" : "📋"}
            </button>
          </div>
        </div>
        
        <div className="whitespace-pre-wrap text-[14px] leading-relaxed font-medium">
          {displayedText}
          {isAssistant && message.isStreaming && <span className="typing-cursor"></span>}
        </div>

        {isAssistant && message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {message.sources.map((source, idx) => (
              <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[11px] truncate text-orange-600 dark:text-orange-400 hover:underline">
                🔗 {source.title}
              </a>
            ))}
          </div>
        )}
        
        <div className="text-[9px] mt-2 font-bold uppercase opacity-40">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
