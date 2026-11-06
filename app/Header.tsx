import Link from "next/link";
import { currentUser } from "@/lib/session";

export async function Header() {
  const user = await currentUser();
  return (
    <header className="top">
      <h1>
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Wingfoil Hunt</Link>
      </h1>
      <nav>
        <Link href="/winners">Winners</Link>
        {user ? (
          <form action="/api/auth/logout" method="post">
            <span className="muted small">@{user.handle}</span>{" "}
            <button className="link" type="submit">Sign out</button>
          </form>
        ) : (
          <a className="btn primary" href="/api/auth/instagram">Sign in</a>
        )}
      </nav>
    </header>
  );
}
