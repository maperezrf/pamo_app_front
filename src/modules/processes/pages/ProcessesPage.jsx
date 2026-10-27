import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Tab, Tabs, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import ExecutionsTab from "../components/ExecutionsTab";
import SchedulesTab from "../components/SchedulesTab";

const SCHEDULES_TAB = "schedules";
const FILTER_KEYS = ["status", "process_type", "schedule"];
const PAGE_SIZE_OPTIONS = [20, 50];

// La URL es la fuente de verdad de pestaña, filtros y página.
function readQuery(searchParams) {
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? ""]));
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);
  const sizeParam = Number.parseInt(searchParams.get("page_size"), 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : PAGE_SIZE_OPTIONS[0];
  const tab = searchParams.get("tab") === SCHEDULES_TAB ? SCHEDULES_TAB : "";
  return { filters, page, pageSize, tab };
}

// Orquestador: historial de ejecuciones (el "log" de cada corrida) y
// programaciones. Contrato en backend/docs/patterns/orchestrator-usage-guide.md.
export default function ProcessesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const { filters, page, pageSize, tab } = useMemo(() => readQuery(new URLSearchParams(queryKey)), [queryKey]);

  const [processTypes, setProcessTypes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listProcessTypes()
      .then(({ ok, status, data }) => {
        if (ok) setProcessTypes([...data].sort((a, b) => a.name.localeCompare(b.name)));
        else if (status === 403) setError("No tienes permiso para ver los procesos.");
        else setError("No se pudo obtener el catálogo de procesos.");
      })
      .catch(() => setError("No se pudo conectar con el servidor."));
  }, []);

  const updateQuery = useCallback(
    (changes, { resetPage = true } = {}) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === "" || value == null) next.delete(key);
          else next.set(key, String(value));
        });
        if (resetPage) next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );

  // "Historial" de una programación: abre las ejecuciones filtradas por ella.
  const showScheduleHistory = useCallback(
    (scheduleId) => updateQuery({ tab: "", status: "", process_type: "", schedule: scheduleId }),
    [updateQuery],
  );

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} sx={{ mb: 2 }}>
        Procesos
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, value) => updateQuery({ tab: value }, { resetPage: false })}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="" label="Ejecuciones" />
        <Tab value={SCHEDULES_TAB} label="Programaciones" />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {tab === SCHEDULES_TAB ? (
        <SchedulesTab processTypes={processTypes} onShowHistory={showScheduleHistory} />
      ) : (
        <ExecutionsTab
          processTypes={processTypes}
          filters={filters}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onQueryChange={updateQuery}
          onClearFilters={() => updateQuery(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])))}
        />
      )}
    </Box>
  );
}
