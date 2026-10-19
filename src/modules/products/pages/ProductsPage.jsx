import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import DataTable from "../../../components/tables/DataTable";
import StatusChip from "../../../components/data-display/StatusChip";
import ProductExpandedDetail from "../components/ProductExpandedDetail";
import SkuUploadDialog from "../components/SkuUploadDialog";
import KitDialog from "../components/KitDialog";
import DeleteDialog from "../components/DeleteDialog";

// `GET /api/products/` pagina de a 100 (ProductPagination); no acepta page_size.
const PAGE_SIZE = 100;
const SEARCH_DELAY_MS = 400;

const skusOf = (product, marketplace) =>
  product.marketplace_skus
    .filter((equivalence) => equivalence.marketplace === marketplace)
    .map((equivalence) => equivalence.sku)
    .join(", ") || "—";

const columns = [
  {
    id: "sku",
    header: "SKU Pamo",
    cell: ({ row }) => (
      <Typography variant="body2" fontWeight={600} component="span">
        {row.original.sku}
      </Typography>
    ),
  },
  { id: "name", header: "Nombre", cell: ({ row }) => row.original.name || "—" },
  {
    id: "type",
    header: "Tipo",
    cell: ({ row }) => (row.original.is_kit ? <StatusChip label="Kit" /> : "Producto"),
  },
  { id: "sodimac", header: "Sodimac", cell: ({ row }) => skusOf(row.original, "sodimac") },
  { id: "madecentro", header: "Madecentro", cell: ({ row }) => skusOf(row.original, "madecentro") },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Diálogo abierto: {type: "sku", initial?} | {type: "kit", kit?} |
  // {type: "delete-sku", product, equivalence} | {type: "delete-kit", product} | null.
  const [dialog, setDialog] = useState(null);

  const updateQuery = useCallback(
    (changes) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === "" || value == null) next.delete(key);
          else next.set(key, String(value));
        });
        return next;
      }),
    [setSearchParams],
  );

  // La URL manda: si cambia desde fuera (atrás/adelante), se sigue.
  useEffect(() => setSearchInput(search), [search]);

  useEffect(() => {
    if (searchInput.trim() === search) return undefined;
    const timer = setTimeout(() => updateQuery({ search: searchInput.trim(), page: "" }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, updateQuery]);

  useEffect(() => {
    let ignore = false;
    const params = { page };
    if (search) params.search = search;

    setLoading(true);
    api
      .listProducts(params)
      .then(({ ok, status, data }) => {
        if (ignore) return;
        if (ok) {
          setResult(data);
          setError("");
        } else if (status === 404 && page > 1) {
          updateQuery({ page: "" });
        } else if (status === 403) {
          setError("No tienes permiso para ver el catálogo.");
        } else {
          setError("No se pudo obtener el catálogo.");
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
  }, [search, page, reloadKey, updateQuery]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const renderExpanded = useCallback(
    (product) => (
      <ProductExpandedDetail
        product={product}
        onEditSku={(p, equivalence) =>
          setDialog({
            type: "sku",
            initial: {
              marketplace: equivalence.marketplace,
              row: { sku_pamo: p.sku, sku_marketplace: equivalence.sku, ean: equivalence.ean ?? "" },
            },
          })
        }
        onEditKit={(kit) => setDialog({ type: "kit", kit })}
        onDeleteSku={(p, equivalence) => setDialog({ type: "delete-sku", product: p, equivalence })}
        onDeleteKit={(kit) => setDialog({ type: "delete-kit", product: kit })}
      />
    ),
    [],
  );

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 2 }}>
        <Typography variant="h4" component="h1" fontWeight={700}>
          Productos
        </Typography>
        {result && (
          <Typography variant="body2" color="textSecondary">
            {result.count} {result.count === 1 ? "producto" : "productos"}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
        <TextField
          size="small"
          label="Buscar"
          placeholder="SKU de Pamo o de marketplace"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 64 } }}
          sx={{ width: { xs: "100%", sm: 280 } }}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={() => setDialog({ type: "sku" })}>
          Cargar SKU
        </Button>
        <Button variant="outlined" onClick={() => setDialog({ type: "kit" })}>
          Cargar kits
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={result?.results ?? []}
        loading={loading}
        getRowId={(row) => row.sku}
        renderExpanded={renderExpanded}
        emptyMessage={search ? "Ningún producto coincide con la búsqueda." : "No hay productos en el catálogo."}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          count: result?.count ?? 0,
          onPageChange: (next) => updateQuery({ page: next > 1 ? next : "" }),
        }}
      />

      {dialog?.type === "sku" && (
        <SkuUploadDialog initial={dialog.initial} onClose={() => setDialog(null)} onFinished={reload} />
      )}
      {dialog?.type === "kit" && <KitDialog kit={dialog.kit} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.type?.startsWith("delete-") && (
        <DeleteDialog
          target={dialog}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </Box>
  );
}
