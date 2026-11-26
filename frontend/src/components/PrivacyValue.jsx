import usePrivacyStore from '../store/privacyStore';

/**
 * Renders sensitive financial data with privacy masking.
 * When hidden: shows "●●●●●"
 * When revealed: shows the actual value
 *
 * @param {string|number} value - The real value to display when revealed
 * @param {string} [className] - Optional extra CSS classes
 * @param {boolean} [blur] - If true, uses blur effect instead of dots (optional style)
 */
export default function PrivacyValue({ value, className = '' }) {
  const isRevealed = usePrivacyStore((s) => s.isRevealed);

  if (isRevealed) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span
      className={`privacy-mask ${className}`}
      aria-label="Hidden value"
    >
      ●●●●●
    </span>
  );
}
