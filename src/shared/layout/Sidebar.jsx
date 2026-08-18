import { useState } from "react";
import { NavLink } from "react-router-dom";
import BrandMark from "./BrandMark";
import { navItems } from "./navConfig";

const COLLAPSED_STORAGE_KEY = "pamo-app-sidebar-collapsed";

export default function Sidebar({ mobileOpen }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1",
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}
    >
      <div className="sidebar-brand">
        <BrandMark />
        <span className="sidebar-brand-name">Pamo</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? " active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        className="sidebar-collapse-btn"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? "»" : "«"}
      </button>
    </aside>
  );
}
