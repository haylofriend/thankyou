import React from 'react';
import Image from 'next/image';

type MagicShareButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export const MagicShareButton: React.FC<MagicShareButtonProps> = ({
  onClick,
  disabled = false,
  className = '',
  label = 'Share The Magic',
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'relative overflow-hidden',
        'inline-flex items-center justify-center gap-2',
        'px-6 py-2 rounded-full',
        'bg-black text-white font-medium text-sm',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.12)]',
        'transition-all duration-200',
        'hover:shadow-[0_0_25px_rgba(150,150,255,0.45)] hover:scale-[1.02]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        className,
      ].join(' ')}
    >
      {label}

      <span className="relative flex items-center justify-center">
        <Image
          src="/haylofriend_sunrise_halo.svg"
          alt="halo"
          width={16}
          height={16}
          className="opacity-90"
        />
      </span>
    </button>
  );
};
