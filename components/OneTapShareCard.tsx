import React from 'react';
import { MagicShareButton } from './MagicShareButton';

type OneTapShareCardProps = {
  shareLink: string;
  onPrimaryShare: () => void;
  onPostX: () => void;
  onSMS: () => void;
  onQR: () => void;
  onCopyDM: () => void;
  className?: string;
};

export const OneTapShareCard: React.FC<OneTapShareCardProps> = ({
  shareLink,
  onPrimaryShare,
  onPostX,
  onSMS,
  onQR,
  onCopyDM,
  className = '',
}) => {
  const shortScript = `“Hey, I set up a tiny thank-you space on Haylofriend. No pressure at all, but if you ever feel like saying thanks or supporting my work, this is where to do it 💛”\n${shareLink}`;

  return (
    <div
      className={[
        'rounded-3xl',
        'bg-gradient-to-b from-slate-900/60 to-slate-900/40',
        'border border-white/10',
        'shadow-[0px_15px_40px_-10px_rgba(0,0,0,0.6)]',
        'backdrop-blur-xl',
        'p-6',
        'flex flex-col gap-5',
        className,
      ].join(' ')}
    >
      <div className="text-xs tracking-[0.18em] text-slate-400 uppercase">
        ONE-TAP SHARE
      </div>

      <h3 className="text-lg font-semibold text-white">Invite a thank-you</h3>

      <p className="text-sm text-slate-300 leading-relaxed">
        Share with someone who already appreciates you — only if it feels right.
        Gratitude is the most powerful currency.
      </p>

      <MagicShareButton onClick={onPrimaryShare} className="w-full mt-2" />

      {/* Secondary action row */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          onClick={onPostX}
          className="px-3 py-2 rounded-full border border-white/10 text-sm text-slate-200 hover:bg-white/5 transition"
        >
          Post on X
        </button>

        <button
          onClick={onSMS}
          className="px-3 py-2 rounded-full border border-white/10 text-sm text-slate-200 hover:bg-white/5 transition"
        >
          Text a regular
        </button>

        <button
          onClick={onQR}
          className="px-3 py-2 rounded-full border border-white/10 text-sm text-slate-200 hover:bg-white/5 transition"
        >
          Download QR
        </button>

        <button
          onClick={onCopyDM}
          className="px-3 py-2 rounded-full border border-white/10 text-sm text-slate-200 hover:bg-white/5 transition"
        >
          Copy 1-line DM
        </button>
      </div>

      {/* Script preview */}
      <div
        className="
          rounded-2xl border border-white/10 bg-slate-900/60
          p-4 text-sm text-slate-300 leading-relaxed
        "
      >
        {shortScript}
      </div>
    </div>
  );
};
