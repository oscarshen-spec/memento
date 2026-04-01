import React from 'react';
import { Plus } from 'lucide-react';

interface AddPageViewProps {
  onAdd: () => void;
}

export const AddPageView: React.FC<AddPageViewProps> = ({ onAdd }) => (
  <div
    className="w-full h-full flex flex-col items-center justify-center gap-5"
    style={{ background: 'linear-gradient(180deg, #f0e8d8 0%, #e8dcc8 100%)' }}
  >
    <button
      onClick={onAdd}
      className="flex flex-col items-center gap-3 group"
    >
      <div
        className="w-14 h-14 rounded-full border-[1.5px] border-dashed flex items-center justify-center transition-all group-active:scale-90"
        style={{ borderColor: 'rgba(196,112,75,0.4)', color: '#c4704b' }}
      >
        <Plus size={24} strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <span
          className="font-serif italic text-sm tracking-wide block"
          style={{ color: '#8B6914' }}
        >
          Start a new page
        </span>
        <span className="text-[9px] uppercase block mt-1" style={{ color: 'rgba(139,105,20,0.4)', letterSpacing: '0.2em' }}>
          tap to add
        </span>
      </div>
    </button>
  </div>
);
