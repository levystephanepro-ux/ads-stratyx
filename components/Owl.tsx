// La chouette Stratyx (même dessin que le favicon de stratyxmedia.fr).
export default function Owl({ size = 28, badge = false }: { size?: number; badge?: boolean }) {
  const svg = (
    <svg viewBox="0 0 64 64" width={badge ? size * 0.78 : size} height={badge ? size * 0.78 : size} aria-hidden="true">
      <path d="M13 22 L9 5 C8.6 3.4 10.2 2.5 11.4 3.4 L27 14 Z" fill="#0B3C5D" stroke="#0B3C5D" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M51 22 L55 5 C55.4 3.4 53.8 2.5 52.6 3.4 L37 14 Z" fill="#0B3C5D" stroke="#0B3C5D" strokeWidth="2.5" strokeLinejoin="round" />
      <path fill="#0B3C5D" d="M32 11 C 52 11 61 24 61 38 C 61 53 48 62 32 62 C 16 62 3 53 3 38 C 3 24 12 11 32 11 Z" />
      <circle cx="21" cy="35" r="11.5" fill="#F5EBDD" />
      <circle cx="43" cy="35" r="11.5" fill="#F5EBDD" />
      <circle cx="21" cy="36" r="8" fill="#F2A122" />
      <circle cx="43" cy="36" r="8" fill="#F2A122" />
      <circle cx="22" cy="36.5" r="4" fill="#082D46" />
      <circle cx="44" cy="36.5" r="4" fill="#082D46" />
      <path d="M32 44 l3.2 3.6 l-3.2 4.2 l-3.2 -4.2 Z" fill="#F2A122" stroke="#F2A122" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
  if (!badge) return svg;
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: "#F5EBDD", display: "inline-grid", placeItems: "center", flexShrink: 0 }}>
      {svg}
    </span>
  );
}
