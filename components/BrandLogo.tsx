// Logo STRATYXMEDIA (charte : « YX » orange #F2A122, reste bleu marine #0B3C5D, Syne,
// baseline encadrée de deux tirets orange). Utilisé sur les rapports et documents clients.
export default function BrandLogo({ size = 26, baseline = true }: { size?: number; baseline?: boolean }) {
  return (
    <div className="brand-logo" style={{ fontSize: size }}>
      <div className="bl-word">STRAT<span>YX</span>MEDIA</div>
      {baseline && <div className="bl-base"><i />Google Ads &amp; Meta Ads · Artisans et PME<i /></div>}
    </div>
  );
}
