type LetterheadMarkProps = {
  logoUrl?: string | null;
  mark: string;
  className?: string;
};

/** Clinic mark: uploaded logo image, or text initials fallback. */
export function LetterheadMark({ logoUrl, mark, className }: LetterheadMarkProps) {
  if (logoUrl) {
    return (
      <img
        className={`invoice-mark-img ${className || ''}`.trim()}
        src={logoUrl}
        alt=""
      />
    );
  }
  return (
    <div className={`invoice-mark ${className || ''}`.trim()} aria-hidden="true">
      {mark}
    </div>
  );
}
