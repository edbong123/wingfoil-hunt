import "./sim.css";
import Link from "next/link";

export default function SimLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sim">
      <nav className="sim-topnav">
        <strong>Simulator</strong>
        <Link href="/admin/sim">Overview</Link>
        <Link href="/admin/sim/dm">1. DMs</Link>
        <Link href="/admin/sim/crowd">2. Votes</Link>
        <Link href="/admin/sim/feed">3. Feed post</Link>
        <span className="spacer" />
        <Link href="/" target="_blank">Public voting page</Link>
        <Link href="/admin">Admin</Link>
      </nav>
      {children}
    </div>
  );
}
