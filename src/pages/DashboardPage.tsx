import BottomNav from "../components/BottomNav";
import "./HomePage.css";

export default function DashboardPage() {
  return (
    <main className="home-page">
      <section className="home-shell">
        <header className="home-header">
          <p className="home-eyebrow">Dashboard</p>
          <h1 className="home-title">Dashboard</h1>
          <p className="home-progress-label">This page does not exist yet.</p>
        </header>
      </section>

      <BottomNav activeTab="home" />
    </main>
  );
}