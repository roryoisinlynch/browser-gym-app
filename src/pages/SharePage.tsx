import BottomNav from "../components/BottomNav";
import TopBar from "../components/TopBar";
import "./SharePage.css";

export default function SharePage() {
  const appUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;

  return (
    <main className="share-page">
      <TopBar title="Share" backTo="/settings" />
      <section className="share-shell">
        <p className="share-heading">Share this app with a friend</p>
        <img
          className="share-qr"
          src={`${import.meta.env.BASE_URL}qr.png`}
          alt="QR code to share this app"
        />
        <p className="share-url">{appUrl}</p>
      </section>
      <BottomNav activeTab="settings" />
    </main>
  );
}
