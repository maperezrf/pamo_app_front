import { useState } from "react";
import { NavLink } from "react-router-dom";
import BrandMark from "./BrandMark";

const COLLAPSED_STORAGE_KEY = "pamo-app-sidebar-collapsed";

export default function Sidebar({ items = [], mobileOpen }) {
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
        {items.map((item) => (
          <div key={item.key} className="sidebar-nav-group">
            <NavLink
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `sidebar-nav-item${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
            {item.submodulos?.length > 0 && (
              <div className="sidebar-nav-submenu">
                {item.submodulos.map((submodulo) => (
                  <NavLink
                    key={submodulo.key}
                    to={submodulo.path}
                    className={({ isActive }) =>
                      `sidebar-nav-subitem${isActive ? " active" : ""}`
                    }
                  >
                    {submodulo.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
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
