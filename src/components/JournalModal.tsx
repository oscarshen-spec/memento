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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(15,8,5,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg h-[90vh] md:h-auto rounded-t-[2rem] md:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#faf5eb',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <div className="p-6 flex justify-between items-center shrink-0"
          style={{ borderBottom: '1px solid rgba(44,24,16,0.08)' }}
        >
          <h3 className="font-serif italic text-xl md:text-2xl" style={{ color: '#2c1810' }}>Add to Journal</h3>
          <button onClick={onClose} className="p-3 rounded-full transition-colors active:scale-95"
            style={{ background: 'rgba(44,24,16,0.06)', color: '#5a4030' }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto">
          <div className="flex gap-2">
            {[
              { key: 'title' as const, icon: <Type size={22} />, label: 'Title' },
              { key: 'body' as const, icon: <AlignLeft size={22} />, label: 'Journal' },
              { key: 'date' as const, icon: <Calendar size={22} />, label: 'Date' },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className="flex-1 flex flex-col items-center gap-2 p-4 rounded-xl transition-all active:scale-95"
                style={{
                  background: type === key ? 'rgba(196,112,75,0.12)' : 'transparent',
                  border: `2px solid ${type === key ? '#c4704b' : 'rgba(44,24,16,0.08)'}`,
                  color: type === key ? '#c4704b' : '#5a4030',
                }}
              >
                {icon}
                <span className="text-[9px] font-bold uppercase tracking-[0.15em]">{label}</span>
              </button>
            ))}
          </div>

          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={type === 'date' ? 'March 31, 2026' : 'Write something...'}
            className="w-full h-48 md:h-32 p-5 rounded-xl border-none resize-none font-serif text-xl md:text-lg outline-none"
            style={{
              background: '#f0e8d8',
              color: '#2c1810',
              boxShadow: 'inset 0 2px 8px rgba(44,24,16,0.08)',
            }}
          />

          <button
            type="submit"
            disabled={!text.trim()}
            className="w-full py-4 rounded-xl font-bold tracking-[0.15em] text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: text.trim() ? 'linear-gradient(135deg, #3a1808 0%, #5c2a10 100%)' : '#3a1808',
              color: '#e8d5b8',
              boxShadow: text.trim() ? '0 4px 16px rgba(58,24,8,0.3), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <Check size={20} />
            ADD TO PAGE
          </button>
        </form>
      </motion.div>
    </div>
  );
};
