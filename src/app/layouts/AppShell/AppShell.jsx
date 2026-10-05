import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import Footer from "./Footer";
import Sidebar from "../../../components/navigation/Sidebar";
import Topbar from "../../../components/navigation/Topbar";

export default function AppShell({ user, menu, onLogout }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    // className="app-shell" alimenta el selector #root:has(.app-shell) en
    // index.css, que evita que #root centre este layout como si fuera una
    // pantalla de acceso.
    <Box className="app-shell" sx={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <Sidebar
        items={menu}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar
          user={user}
          onLogout={onLogout}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <Box component="main" sx={{ flex: 1, p: 4 }}>
          <Outlet />
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}
