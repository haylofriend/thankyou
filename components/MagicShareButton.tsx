import React from 'react';
import Image from 'next/image';

type MagicShareButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export const MagicShareButton: React.FC<MagicShareButtonProps> = ({
  onClick,
  disabled = false,
  label = 'Share The Magic',
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2',
        'rounded-full px-6 py-2',
        'bg-black text-slate-100 text-sm font-medium',
        'shadow-[0_0_0_1px_rgba(148,163,184,0.25)]',
        'ring-1 ring-transparent',
        'hover:shadow-[0_0_0_1px_rgba(129,140,248,0.6),0_0_30px_rgba(37,99,235,0.45)]',
        'hover:ring-[rgba(59,130,246,0.7)]',
        'transition-transform transition-shadow duration-150 ease-out',
        'hover:scale-[1.02]',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none',
        className,
      ].join(' ')}
    >
      <span>{label}</span>

      {/* Small Haylo halo icon to match the site CTA */}
      <span className="inline-flex items-center justify-center">
        <Image
          src="/haylofriend_sunrise_halo.svg"
          alt=""
          width={18}
          height={18}
        />
      </span>
    </button>
  );
};
