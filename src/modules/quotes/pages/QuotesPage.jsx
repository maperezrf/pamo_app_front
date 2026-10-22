import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Link, Snackbar, TextField, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import { formatDate, formatMoney, shopifyDraftOrderUrl } from "../../../core/format";
import DataTable from "../../../components/tables/DataTable";

const SEARCH_DELAY_MS = 400;

// Botones de una fila: bajar el PDF (con sesión) y copiar el link público
// que se le manda al cliente (sin `pdf_link` el backend no tiene
// BACKEND_PUBLIC_URL).
function QuoteActions({ quote, onDownload, onCopy, downloading }) {
  return (
    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
      <Button size="small" variant="outlined" disabled={downloading} onClick={() => onDownload(quote)}>
        {downloading ? "Generando…" : "Descargar PDF"}
      </Button>
      <Button size="small" disabled={!quote.pdf_link} onClick={() => onCopy(quote)}>
        Copiar link para el cliente
      </Button>
    </Box>
  );
}

function buildColumns({ onDownload, onCopy, downloadingId }) {
  return [
    {
      id: "name",
      header: "Cotización",
      cell: ({ row: { original: q } }) => {
        const href = shopifyDraftOrderUrl(q.id);
        if (!href) {
          return (
            <Typography variant="body2" fontWeight={600} component="span">
              {q.name}
            </Typography>
          );
        }
        return (
          <Link href={href} target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600} underline="hover" title="Abrir en Shopify">
            {q.name}
          </Link>
        );
      },
    },
    { id: "created_at", header: "Fecha", cell: ({ row }) => formatDate(row.original.created_at) },
    { id: "customer", header: "Cliente", cell: ({ row }) => row.original.customer || "—" },
    { id: "total", header: "Valor", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.total) },
    { id: "seller", header: "Vendedor", cell: ({ row }) => row.original.seller || "—" },
    { id: "nit", header: "NIT", cell: ({ row }) => row.original.nit || "—" },
    {
      id: "actions",
      header: "",
      meta: { align: "right" },
      cell: ({ row: { original: q } }) => (
        <QuoteActions quote={q} onDownload={onDownload} onCopy={onCopy} downloading={downloadingId === q.id} />
      ),
    },
  ];
}

export default function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  // La URL manda: si cambia desde fuera (atrás/adelante), se sigue.
  useEffect(() => setSearchInput(search), [search]);

  useEffect(() => {
    if (searchInput === search) return undefined;
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchInput.trim()) next.set("search", searchInput.trim());
        else next.delete("search");
        return next;
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api
      .listQuotes(search ? { search } : {})
      .then(({ ok, status, data }) => {
        if (ignore) return;
        if (ok) {
          setQuotes(data.quotes);
          setError("");
        } else if (status === 403) {
          setError("No tienes permiso para ver las cotizaciones.");
        } else {
          setError("No se pudo obtener el listado de cotizaciones de Shopify.");
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
  }, [search]);

  const onDownload = useCallback(async (quote) => {
    setDownloadingId(quote.id);
    try {
      const { ok, status } = await api.downloadQuotePdf(quote.id);
      if (!ok) setNotice(status === 404 ? `La cotización ${quote.name} ya no existe en Shopify.` : "No se pudo generar el PDF.");
    } catch {
      setNotice("No se pudo conectar con el servidor.");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const onCopy = useCallback(async (quote) => {
    try {
      await navigator.clipboard.writeText(quote.pdf_link);
      setNotice(`Link de la cotización ${quote.name} copiado.`);
    } catch {
      setNotice("No se pudo copiar el link.");
    }
  }, []);

  const columns = useMemo(() => buildColumns({ onDownload, onCopy, downloadingId }), [onDownload, onCopy, downloadingId]);

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 2 }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Cotizaciones
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {search ? `Resultados en Shopify para "${search}"` : "Las 250 más recientes de Shopify"}
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Buscar"
          placeholder="Número o cliente"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 64 } }}
          sx={{ width: { xs: "100%", sm: 260 } }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={quotes}
        loading={loading}
        searchable={false}
        getRowId={(row) => row.id}
        emptyMessage={search ? "No hay cotizaciones con esa búsqueda." : "No hay cotizaciones."}
      />

      <Snackbar open={Boolean(notice)} autoHideDuration={3000} onClose={() => setNotice("")} message={notice} />
    </Box>
  );
}
