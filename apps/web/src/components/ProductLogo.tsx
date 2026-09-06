import { PRODUCT_LOGO_SRC, PRODUCT_NAME } from '../lib/product';

type ProductLogoProps = {
  /** full = wordmark; mark = left icon crop for compact chrome */
  variant?: 'full' | 'mark';
  className?: string;
};

export function ProductLogo({ variant = 'full', className = '' }: ProductLogoProps) {
  if (variant === 'mark') {
    return (
      <img
        src={PRODUCT_LOGO_SRC}
        alt={PRODUCT_NAME}
        className={`object-cover object-left ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <img
      src={PRODUCT_LOGO_SRC}
      alt={PRODUCT_NAME}
      className={`object-contain object-left ${className}`}
      draggable={false}
    />
  );
}
