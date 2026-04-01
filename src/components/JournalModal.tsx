import React, { useState } from 'react';
import { X, Check, Type, Calendar, AlignLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface JournalModalProps {
  onAdd: (text: string, type: 'title' | 'body' | 'date') => void;
  onClose: () => void;
}

export const JournalModal: React.FC<JournalModalProps> = ({ onAdd, onClose }) => {
  const [text, setText] = useState('');
  const [type, setType] = useState<'title' | 'body' | 'date'>('body');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text, type);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <motion.div 
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white w-full max-w-lg h-[90vh] md:h-auto rounded-t-[2rem] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
          <h3 className="font-serif italic text-xl md:text-2xl">Add to Journal</h3>
          <button onClick={onClose} className="p-3 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors active:scale-95">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType('title')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${type === 'title' ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-200'}`}
            >
              <Type size={24} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Title</span>
            </button>
            <button
              type="button"
              onClick={() => setType('body')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${type === 'body' ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-200'}`}
            >
              <AlignLeft size={24} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Journal</span>
            </button>
            <button
              type="button"
              onClick={() => setType('date')}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${type === 'date' ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-100 hover:border-neutral-200'}`}
            >
              <Calendar size={24} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Date</span>
            </button>
          </div>

          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={type === 'date' ? 'March 31, 2026' : 'Write something...'}
            className="w-full h-48 md:h-32 p-5 bg-neutral-50 rounded-2xl border-none focus:ring-2 focus:ring-neutral-900 resize-none font-serif text-xl md:text-lg shadow-inner"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            className="w-full py-5 bg-neutral-900 text-white rounded-2xl font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors flex items-center justify-center gap-3 active:scale-[0.98] shadow-xl"
          >
            <Check size={24} />
            ADD TO PAGE
          </button>
        </form>
      </motion.div>
    </div>
  );
};
