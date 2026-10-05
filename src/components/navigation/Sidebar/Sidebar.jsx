import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import BrandMark from "./BrandMark";

const COLLAPSED_STORAGE_KEY = "pamo-app-sidebar-collapsed";
const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 72;
const MOBILE_QUERY = "(max-width:768px)";

function isPathActive(pathname, itemPath, end) {
  if (end) return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

const navItemSx = {
  borderRadius: 1,
  color: "text.secondary",
  "&.Mui-selected": {
    bgcolor: "background.default",
    color: "text.primary",
  },
  "&.Mui-selected:hover": {
    bgcolor: "background.default",
  },
};

export default function Sidebar({ items = [], mobileOpen, onCloseMobile }) {
  const location = useLocation();
  const isMobile = useMediaQuery(MOBILE_QUERY);
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

  // El sidebar móvil siempre se muestra a ancho completo, sin importar la
  // preferencia de colapso de escritorio (igual que el comportamiento previo
  // basado en CSS).
  const showLabels = isMobile || !collapsed;
  const width = isMobile || !collapsed ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", py: 2.5, px: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, mb: 3 }}>
        <BrandMark />
        {showLabels && (
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            Pamo
          </Typography>
        )}
      </Box>

      <List
        component="nav"
        disablePadding
        sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
      >
        {showLabels && items.map((item) => {
          const active = isPathActive(location.pathname, item.path, item.path === "/");
          return (
            <Box key={item.key}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={active}
                sx={{ ...navItemSx, py: 1.25, px: 1.5 }}
              >
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: { fontSize: 14, fontWeight: active ? 600 : 400 },
                  }}
                />
              </ListItemButton>
              {item.submodulos?.length > 0 && (
                <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.25, mt: 0.25 }}>
                  {item.submodulos.map((submodulo) => {
                    const subActive = isPathActive(location.pathname, submodulo.path, false);
                    return (
                      <ListItemButton
                        key={submodulo.key}
                        component={Link}
                        to={submodulo.path}
                        selected={subActive}
                        sx={{ ...navItemSx, py: 1, pl: 3.5, pr: 1.5 }}
                      >
                        <ListItemText
                          primary={submodulo.label}
                          slotProps={{
                            primary: { fontSize: 13, fontWeight: subActive ? 600 : 400 },
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>
          );
        })}
      </List>

      {!isMobile && (
        <IconButton
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          size="small"
          sx={{
            alignSelf: "flex-end",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            width: 28,
            height: 28,
            color: "text.secondary",
            "&:hover": { borderColor: "primary.main", color: "primary.main" },
          }}
        >
          {collapsed ? "»" : "«"}
        </IconButton>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        sx={{ "& .MuiDrawer-paper": { width: EXPANDED_WIDTH, boxSizing: "border-box" } }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: (theme) => theme.transitions.create("width"),
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "divider",
          overflowX: "hidden",
          transition: (theme) => theme.transitions.create("width"),
        },
      }}
    >
      {content}
    </Drawer>
  );
}
