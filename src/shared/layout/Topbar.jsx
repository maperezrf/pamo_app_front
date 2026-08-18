export default function Topbar({ user, onLogout, onToggleMobileNav }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-mobile-toggle"
        onClick={onToggleMobileNav}
        aria-label="Abrir menú"
      >
        ☰
      </button>
      <div className="topbar-user">
        <span className="topbar-email">{user?.email}</span>
        <button className="logout-btn" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
