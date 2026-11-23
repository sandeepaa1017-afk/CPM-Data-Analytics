export default function BrandLogo({ className = "" }) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/icons/cpm-logo.webp"
      alt="CPM Packers and Movers"
      width="64"
      height="64"
    />
  );
}
