'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Gift, Smile, Video } from 'lucide-react'; // Video icon එකතු කළා

interface MessageInputProps {
  onSend: (text: string) => void;
  onGift: () => void;
  onVideoCall: () => void; // Video Call function එක එකතු කළා
  canAffordMessage?: boolean;
}

export default function MessageInput({ 
  onSend, 
  onGift, 
  onVideoCall, // Props වලට එකතු කළා
  canAffordMessage = true 
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isPressed, setIsPressed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasText = message.trim().length > 0;
  const canSend = hasText && canAffordMessage;

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || !canAffordMessage) return;
    onSend(trimmed);
    setMessage('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="sticky bottom-0 left-0 right-0 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      style={{
        background:
          'linear-gradient(180deg, rgba(17, 27, 33, 0) 0%, rgba(17, 27, 33, 0.95) 20%, #111B21 100%)',
      }}
    >
      <div
        className="flex items-center gap-2 rounded-full px-3 py-2"
        style={{
          background: 'rgba(42, 57, 66, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: '0 -2px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Emoji button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          aria-label="Emoji"
        >
          <Smile className="w-5 h-5 text-white/50" />
        </motion.button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          className="flex-1 bg-transparent text-white/90 text-[15px] placeholder:text-white/30 outline-none min-w-0"
        />

        {/* Video Call button - අලුතින් එකතු කළ කොටස */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.85 }}
          onClick={onVideoCall}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          aria-label="Video Call"
        >
          <Video className="w-5 h-5 text-white/70" />
        </motion.button>

        {/* Gift button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.85 }}
          onClick={onGift}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full transition-colors"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.1))',
            border: '1px solid rgba(255, 193, 7, 0.25)',
          }}
          aria-label="Send gift"
        >
          <Gift className="w-5 h-5 text-yellow-400" />
        </motion.button>

        {/* Send button with cost badge */}
        <div className="relative flex-shrink-0">
          {/* Cost badge */}
          {hasText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 4 }}
              className="absolute -top-1.5 -right-0.5 z-10 px-1.5 py-0 rounded-full font-bold leading-none whitespace-nowrap pointer-events-none"
              style={{
                fontSize: '9px',
                background: canAffordMessage
                  ? 'linear-gradient(135deg, #FFD700, #FFA000)'
                  : 'rgba(239, 68, 68, 0.9)',
                color: canAffordMessage ? '#8B6914' : '#fff',
                boxShadow: canAffordMessage
                  ? '0 1px 6px rgba(255, 215, 0, 0.4)'
                  : '0 1px 6px rgba(239, 68, 68, 0.3)',
              }}
            >
              10 🪙
            </motion.div>
          )}

          <motion.button
            whileHover={canSend ? { scale: 1.1 } : {}}
            whileTap={canSend ? { scale: 0.8 } : {}}
            onTapStart={() => setIsPressed(true)}
            onTapEnd={() => setIsPressed(false)}
            onClick={handleSend}
            disabled={!canSend}
            className={`w-11 h-11 flex items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all ${
              !canAffordMessage && hasText ? 'opacity-50' : ''
            }`}
            style={{
              background: canSend
                ? 'linear-gradient(135deg, #25D366, #128C7E)'
                : 'rgba(37, 211, 102, 0.2)',
              boxShadow: canSend
                ? '0 0 20px rgba(37, 211, 102, 0.3)'
                : 'none',
            }}
            aria-label="Send message"
          >
            <motion.div
              animate={isPressed ? { scale: 0.7, rotate: -20 } : { scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Send className="w-5 h-5 text-white fill-white" />
            </motion.div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
