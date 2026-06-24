import { MintPanel } from "@/components/MintPanel";

export default function Home() {
  const imageUrl = process.env.NEXT_PUBLIC_NFT_IMAGE_URL || "/nft.png";

  return (
    <main className="shell">
      <section className="mintSurface" aria-label="Attendance SBT mint">
        <div className="artPanel">
          <img className="nftImage" src={imageUrl} alt="Attendance SBT artwork" />
          <div className="collectionLabel">
            <span>Soneium Minato</span>
            <strong>Attendance SBT</strong>
          </div>
        </div>
        <div className="mainPanelStack">
          <MintPanel />
          <a className="adminLink" href="/admin">
            Admin
          </a>
        </div>
      </section>
    </main>
  );
}
