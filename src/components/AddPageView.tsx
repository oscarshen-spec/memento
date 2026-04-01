import React from 'react';
import { Plus } from 'lucide-react';

interface AddPageViewProps {
  onAdd: () => void;
}

export const AddPageView: React.FC<AddPageViewProps> = ({ onAdd }) => (
  <div
    className="w-full h-full flex flex-col items-center justify-center gap-4"
    style={{ background: '#f0e8d8' }}
  >
    <button
      onClick={onAdd}
      className="flex flex-col items-center gap-2"
    >
      <div
        className="w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center transition-colors"
        style={{ borderColor: '#8B6914', color: '#8B6914' }}
      >
        <Plus size={28} />
      </div>
      <span
        className="font-serif italic text-sm tracking-wide"
        style={{ color: '#8B6914' }}
      >
        Start a new page
      </span>
    </button>
  </div>
);
