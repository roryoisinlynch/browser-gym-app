import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SharePage.css";

export default function SharePage() {
  return (
    <main className="share-page">
      <TopBar title="Share" backTo="/settings" />
      <section className="share-shell">
        <p className="share-heading">Share this app with a friend</p>
        <img
          className="share-qr"
          src="/qr.png"
          alt="QR code to share this app"
        />
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
