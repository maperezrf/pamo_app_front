import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Tab, Tabs, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import DataTable from "../../../components/tables/DataTable";
import StatusChip from "../../../components/data-display/StatusChip";
import OrderFilters from "../components/OrderFilters";
import OrderDetailDrawer from "../components/OrderDetailDrawer";
import MarketplaceLabel from "../components/MarketplaceLabel";
import {
  customerName,
  financialStatus,
  formatDateTime,
  formatMoney,
  notCreatedStatusLabel,
  shopifyFulfillmentStatus,
  warehouse,
} from "../orderFormat";

const FILTER_KEYS = ["marketplace", "date_from", "date_to", "search"];
const PAGE_SIZE_OPTIONS = [20, 50];
const NOT_CREATED_TAB = "no-creados";

const secondaryText = { display: "block", color: "text.secondary", fontSize: 12 };

const orderColumns = [
  {
    id: "order",
    header: "Pedido",
    cell: ({ row: { original: o } }) => (
      <>
        <Typography variant="body2" fontWeight={600} component="span">
          {o.shopify_order_name}
        </Typography>
        {o.marketplace_order_numbers.length > 0 && (
          <Typography component="span" sx={secondaryText}>
            {o.marketplace_order_numbers.join(", ")}
          </Typography>
        )}
      </>
    ),
  },
  { id: "created_at", header: "Fecha", cell: ({ row }) => formatDateTime(row.original.created_at) },
  { id: "marketplace", header: "Canal", cell: ({ row }) => <MarketplaceLabel value={row.original.marketplace} /> },
  {
    id: "customer",
    header: "Cliente",
    cell: ({ row: { original: o } }) => (
      <>
        {customerName(o.customer)}
        {o.customer.identification && (
          <Typography component="span" sx={secondaryText}>
            {o.customer.identification}
          </Typography>
        )}
      </>
    ),
  },
  {
    id: "status",
    header: "Estado",
    cell: ({ row: { original: o } }) => {
      const payment = financialStatus(o.financial_status);
      const shipping = shopifyFulfillmentStatus(o.fulfillment_status);
      return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {o.cancelled_at && <StatusChip label="Cancelado" tone="error" />}
          {payment && <StatusChip {...payment} />}
          {shipping && <StatusChip {...shipping} />}
        </Box>
      );
    },
  },
  {
    id: "warehouse",
    header: "Bodega",
    cell: ({ row }) => {
      const bodega = warehouse(row.original.fulfillment);
      return bodega ? <StatusChip label={bodega.label} tone={bodega.tone} title={bodega.detail} /> : "—";
    },
  },
  {
    id: "total",
    header: "Total",
    meta: { align: "right" },
    cell: ({ row }) => formatMoney(row.original.total, row.original.currency),
  },
];

const notCreatedColumns = [
  {
    accessorKey: "marketplace_order_number",
    header: "Pedido",
    cell: ({ getValue }) => (
      <Typography variant="body2" fontWeight={600} component="span">
        {getValue()}
      </Typography>
    ),
  },
  { accessorKey: "created_at", header: "Llegó", cell: ({ getValue }) => formatDateTime(getValue()) },
  {
    accessorKey: "marketplace",
    header: "Canal",
    cell: ({ getValue }) => <MarketplaceLabel value={getValue()} />,
  },
  { id: "customer", header: "Cliente", accessorFn: (row) => customerName(row.customer) },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ getValue }) => <StatusChip label={notCreatedStatusLabel(getValue())} tone="error" />,
  },
  {
    accessorKey: "error",
    header: "Error",
    cell: ({ getValue }) => (
      <Typography
        variant="body2"
        title={getValue()}
        sx={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {getValue() || "—"}
      </Typography>
    ),
  },
  { accessorKey: "total", header: "Total", meta: { align: "right" }, cell: ({ getValue }) => formatMoney(getValue()) },
];

// Lee la consulta de la URL: es la fuente de verdad de filtros, página y
// pestaña (enlace compartible, atrás/adelante del navegador).
function readQuery(searchParams) {
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? ""]));
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);
  const sizeParam = Number.parseInt(searchParams.get("page_size"), 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : PAGE_SIZE_OPTIONS[0];
  return { filters, page, pageSize, tab: searchParams.get("tab") === NOT_CREATED_TAB ? NOT_CREATED_TAB : "" };
}

// Errores de validación del backend (`{campo: [mensajes]}`) → un texto.
function validationMessage(data) {
  if (!data || typeof data !== "object") return "Revisa los filtros.";
  return Object.values(data).flat().join(" ") || "Revisa los filtros.";
}

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const { filters, page, pageSize, tab } = useMemo(() => readQuery(new URLSearchParams(queryKey)), [queryKey]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

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

  const clearFilters = useCallback(
    () => updateQuery(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""]))),
    [updateQuery],
  );

  useEffect(() => {
    let ignore = false;
    const params = { page, page_size: pageSize };
    FILTER_KEYS.forEach((key) => {
      if (filters[key]) params[key] = filters[key];
    });

    setLoading(true);
    api
      .listOrders(params)
      .then(({ ok, status, data }) => {
        if (ignore) return;
        if (ok) {
          setResult(data);
          setError("");
        } else if (status === 404 && page > 1) {
          // La página ya no existe (cambiaron los datos): volver a la primera.
          updateQuery({ page: "" }, { resetPage: false });
        } else if (status === 400) {
          setError(validationMessage(data));
        } else if (status === 403) {
          setError("No tienes permiso para ver los pedidos.");
        } else {
          setError("No se pudo obtener el listado de pedidos.");
        }
      })
      .catch(() => {
        if (!ignore) setError("No se pudo conectar con el servidor.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters, page, pageSize, updateQuery]);

  const orders = useMemo(() => (result?.orders ?? []).map((o) => ({ ...o, kind: "shopify" })), [result]);
  const notCreated = useMemo(
    () => (result?.orders_not_created ?? []).map((o) => ({ ...o, kind: "not_created" })),
    [result],
  );
  const notCreatedCount = result?.orders_not_created_count ?? 0;

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Pedidos
        </Typography>
        {result && (
          <Typography variant="body2" color="textSecondary">
            {result.last_synced_at
              ? `Sincronizado con Shopify: ${formatDateTime(result.last_synced_at)}`
              : "Aún no hay sincronización con Shopify"}
          </Typography>
        )}
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value) => updateQuery({ tab: value }, { resetPage: false })}
        sx={{ mt: 2, mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab value="" label={`En Shopify${result ? ` (${result.count})` : ""}`} />
        <Tab
          value={NOT_CREATED_TAB}
          label={`No creados${result ? ` (${notCreatedCount})` : ""}`}
          sx={notCreatedCount > 0 ? { color: "error.main" } : undefined}
        />
      </Tabs>

      <OrderFilters filters={filters} onChange={updateQuery} onClear={clearFilters} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {tab === NOT_CREATED_TAB ? (
        <>
          {notCreatedCount > notCreated.length && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Se muestran los {notCreated.length} más recientes de {notCreatedCount}. Usa los filtros para acotar.
            </Alert>
          )}
          <DataTable
            columns={notCreatedColumns}
            data={notCreated}
            loading={loading}
            getRowId={(row) => String(row.id)}
            onRowClick={setSelected}
            emptyMessage="No hay pedidos pendientes por crear."
          />
        </>
      ) : (
        <DataTable
          columns={orderColumns}
          data={orders}
          loading={loading}
          getRowId={(row) => row.shopify_order_id}
          onRowClick={setSelected}
          emptyMessage="No hay pedidos con estos filtros."
          pagination={{
            page,
            pageSize,
            count: result?.count ?? 0,
            onPageChange: (next) => updateQuery({ page: next > 1 ? next : "" }, { resetPage: false }),
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onPageSizeChange: (size) => updateQuery({ page_size: size === PAGE_SIZE_OPTIONS[0] ? "" : size }),
          }}
        />
      )}

      <OrderDetailDrawer order={selected} onClose={() => setSelected(null)} />
    </Box>
  );
}
