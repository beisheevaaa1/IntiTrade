import { Heart, LayoutDashboard, LogOut, MessageSquare, Plus, ShieldCheck, Store, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `nav-link ${isActive ? "bg-ink text-white" : "text-ink/75 hover:bg-white"}`;

export function Layout() {
  const { user, logout } = useAuth();
  const userInitials = user?.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-3 font-semibold">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-campus text-white shadow-sm">
              <Store size={20} />
            </span>
            <span className="hidden truncate sm:block">University Marketplace</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            <NavLink to="/" className={navLink}>Market</NavLink>
            {user && <NavLink to="/create" className={navLink}><Plus size={16} /> Sell</NavLink>}
            {user && <NavLink to="/messages" className={navLink}><MessageSquare size={16} /> Chat</NavLink>}
            {user && <NavLink to="/favorites" className={navLink}><Heart size={16} /> Saved</NavLink>}
            {user && <NavLink to="/mine" className={navLink}><LayoutDashboard size={16} /> Mine</NavLink>}
            {user?.role === "ADMIN" && <NavLink to="/admin" className={navLink}><ShieldCheck size={16} /> Admin</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden items-center gap-2 rounded-lg border border-line bg-white px-2 py-1.5 md:flex">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-lake/10 text-xs font-bold text-lake">{userInitials}</span>
                  <span className="max-w-[160px] truncate text-sm font-medium">{user.name}</span>
                </div>
                <button className="icon-button" onClick={logout} aria-label="Log out" title="Log out">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="button-primary" to="/login"><UserRound size={17} /> Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 lg:pb-10">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface px-2 py-2 shadow-soft lg:hidden">
        <NavLink to="/" className={navLink}><Store size={18} /> Market</NavLink>
        <NavLink to="/create" className={navLink}><Plus size={18} /> Sell</NavLink>
        <NavLink to="/messages" className={navLink}><MessageSquare size={18} /> Chat</NavLink>
        <NavLink to="/favorites" className={navLink}><Heart size={18} /> Saved</NavLink>
        <NavLink to="/mine" className={navLink}><LayoutDashboard size={18} /> Mine</NavLink>
      </nav>
    </div>
  );
}
