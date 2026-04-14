import React from 'react';
import { Megaphone } from 'lucide-react';
import { motion } from 'motion/react';

interface AnnouncementBarProps {
  text: string;
  speed?: number;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ text, speed = 40 }) => {
  if (!text) return null;

  return (
    <div className="bg-indigo-600 text-white py-2 overflow-hidden relative border-b border-indigo-500 z-[60] w-full h-10 flex items-center">
      <div className="flex items-center w-full h-full relative">
        {/* Megaphone Icon with solid background to hide text behind it */}
        <div className="flex-shrink-0 bg-indigo-600 pl-4 pr-3 z-20 flex items-center h-full relative">
          <div className="bg-indigo-500 p-1.5 rounded-lg shadow-sm">
            <Megaphone className="w-4 h-4" />
          </div>
          {/* Subtle gradient to fade text as it goes behind the icon */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-transparent to-indigo-600 pointer-events-none translate-x-full" />
        </div>
        
        <div className="relative flex-grow overflow-hidden h-full flex items-center">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: '-100%' }}
            transition={{
              duration: speed, // Dynamic speed
              repeat: Infinity,
              ease: 'linear',
            }}
            className="whitespace-nowrap font-bold text-sm tracking-widest uppercase flex items-center"
          >
            {text}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
