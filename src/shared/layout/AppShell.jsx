import { useState } from "react";
import { Outlet } from "react-router-dom";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ user, menu, onLogout }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        items={menu}
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div className="app-shell-body">
        <Topbar
          user={user}
          onLogout={onLogout}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <main className="app-shell-content">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
