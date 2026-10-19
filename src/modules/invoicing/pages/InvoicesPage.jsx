import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Link, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import { formatDate, formatMoney, shopifyOrderUrl } from "../../../core/format";
import DataTable from "../../../components/tables/DataTable";
import StatusChip from "../../../components/data-display/StatusChip";
import MarketplaceLabel from "../../../components/data-display/MarketplaceLabel";
import InvoiceFilters from "../components/InvoiceFilters";
import InvoiceExpandedDetail from "../components/InvoiceExpandedDetail";
import { invoiceStatus } from "../invoiceFormat";

const FILTER_KEYS = ["status", "marketplace", "date_from", "date_to", "search"];
const PAGE_SIZE_OPTIONS = [20, 50];

const columns = [
  { id: "invoice_date", header: "Fecha", cell: ({ row }) => formatDate(row.original.invoice_date) },
  { id: "marketplace", header: "Canal", cell: ({ row }) => <MarketplaceLabel value={row.original.marketplace} /> },
  {
    id: "marketplace_order",
    header: "Pedido marketplace",
    cell: ({ row }) => (
      <Typography variant="body2" fontWeight={600} component="span">
        {row.original.marketplace_order_number || "—"}
      </Typography>
    ),
  },
  {
    id: "shopify_order",
    header: "Pedido Shopify",
    cell: ({ row: { original: i } }) => (
      <ExternalLink href={shopifyOrderUrl(i.shopify_order_id)} text={i.shopify_order_name} title="Abrir en Shopify" />
    ),
  },
  {
    id: "number",
    header: "Factura",
    cell: ({ row: { original: i } }) => <ExternalLink href={i.siigo_url} text={i.number} title="Ver factura en Siigo" />,
  },
  {
    id: "status",
    header: "Estado",
    cell: ({ row: { original: i } }) => {
      const status = invoiceStatus(i.status);
      if (!status) return "—";
      return <StatusChip label={status.label} tone={status.tone} title={i.error_message || status.description} />;
    },
  },
  {
    id: "total",
    header: "Total",
    meta: { align: "right" },
    cell: ({ row }) => formatMoney(row.original.total),
  },
];

// Enlace en pestaña nueva que no despliega la fila (stopPropagation). Sin
// URL, solo el texto; sin texto, "—".
function ExternalLink({ href, text, title }) {
  if (!text) return "—";
  if (!href) {
    return (
      <Typography variant="body2" fontWeight={600} component="span">
        {text}
      </Typography>
    );
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variant="body2"
      fontWeight={600}
      underline="hover"
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </Link>
  );
}

// La URL es la fuente de verdad de filtros y página.
function readQuery(searchParams) {
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? ""]));
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);
  const sizeParam = Number.parseInt(searchParams.get("page_size"), 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(sizeParam) ? sizeParam : PAGE_SIZE_OPTIONS[0];
  return { filters, page, pageSize };
}

// Errores de validación del backend (`{campo: [mensajes]}`) → un texto.
function validationMessage(data) {
  if (!data || typeof data !== "object") return "Revisa los filtros.";
  return Object.values(data).flat().join(" ") || "Revisa los filtros.";
}

const renderExpanded = (invoice) => <InvoiceExpandedDetail invoice={invoice} />;

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const { filters, page, pageSize } = useMemo(() => readQuery(new URLSearchParams(queryKey)), [queryKey]);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      .listInvoices(params)
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
          setError("No tienes permiso para ver las facturas.");
        } else {
          setError("No se pudo obtener el listado de facturas.");
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

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 2 }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Facturación
        </Typography>
        {result && (
          <Typography variant="body2" color="textSecondary">
            {result.count} {result.count === 1 ? "factura" : "facturas"}
          </Typography>
        )}
      </Box>

      <InvoiceFilters filters={filters} onChange={updateQuery} onClear={clearFilters} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={result?.invoices ?? []}
        loading={loading}
        getRowId={(row) => String(row.id)}
        renderExpanded={renderExpanded}
        emptyMessage="No hay facturas con estos filtros."
        pagination={{
          page,
          pageSize,
          count: result?.count ?? 0,
          onPageChange: (next) => updateQuery({ page: next > 1 ? next : "" }, { resetPage: false }),
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onPageSizeChange: (size) => updateQuery({ page_size: size === PAGE_SIZE_OPTIONS[0] ? "" : size }),
        }}
      />
    </Box>
  );
}
