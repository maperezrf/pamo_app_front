import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Box,
  Button,
  LinearProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";

// Modo cliente (por defecto): filtro, orden y paginación sobre `data`.
// Modo servidor (`pagination` presente): `data` es solo la página actual; la
// pantalla es dueña de la página y los filtros, y la tabla solo los muestra.
// Ver docs/patterns/DATA_TABLE.md.
export default function DataTable({
  columns,
  data,
  emptyMessage = "Sin resultados.",
  pagination,
  loading = false,
  onRowClick,
  getRowId,
}) {
  const isServer = Boolean(pagination);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    ...(isServer
      ? { manualPagination: true, enableSorting: false }
      : {
          state: { sorting, globalFilter },
          onSortingChange: setSorting,
          onGlobalFilterChange: setGlobalFilter,
          getSortedRowModel: getSortedRowModel(),
          getFilteredRowModel: getFilteredRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize: 10 } },
        }),
  });

  const rows = table.getRowModel().rows;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
      {!isServer && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <TextField
            size="small"
            placeholder="Buscar…"
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            sx={{ width: "100%", maxWidth: 280 }}
          />
        </Box>
      )}

      <Box sx={{ height: 4 }}>{loading && <LinearProgress />}</Box>

      <TableContainer sx={{ opacity: loading ? 0.6 : 1, transition: "opacity 120ms" }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableCell
                      key={header.id}
                      align={header.column.columnDef.meta?.align}
                      sx={{
                        color: "text.secondary",
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.03em",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {canSort ? (
                        <TableSortLabel
                          active={!!sortDir}
                          direction={sortDir || "asc"}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableSortLabel>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ color: "text.secondary", py: 3 }}>
                  {loading ? "Cargando…" : emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow
                key={row.id}
                hover
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                sx={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} align={cell.column.columnDef.meta?.align}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {isServer ? (
        <ServerFooter pagination={pagination} disabled={loading} />
      ) : (
        <Footer
          summary={`Página ${table.getState().pagination.pageIndex + 1} de ${table.getPageCount() || 1} · ${
            table.getFilteredRowModel().rows.length
          } registros`}
          onPrevious={() => table.previousPage()}
          onNext={() => table.nextPage()}
          canPrevious={table.getCanPreviousPage()}
          canNext={table.getCanNextPage()}
        />
      )}
    </Paper>
  );
}

function ServerFooter({ pagination, disabled }) {
  const { page, pageSize, count, onPageChange, pageSizeOptions, onPageSizeChange } = pagination;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  return (
    <Footer
      summary={`Página ${page} de ${pageCount} · ${count} registros`}
      onPrevious={() => onPageChange(page - 1)}
      onNext={() => onPageChange(page + 1)}
      canPrevious={!disabled && page > 1}
      canNext={!disabled && page < pageCount}
    >
      {pageSizeOptions && onPageSizeChange && (
        <TextField
          select
          size="small"
          label="Por página"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          sx={{ width: 110 }}
        >
          {pageSizeOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Footer>
  );
}

function Footer({ summary, onPrevious, onNext, canPrevious, canNext, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        px: 2,
        py: 1.5,
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Typography fontSize={13} color="textSecondary">
        {summary}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {children}
        <Button variant="outlined" color="inherit" size="small" onClick={onPrevious} disabled={!canPrevious}>
          Anterior
        </Button>
        <Button variant="outlined" color="inherit" size="small" onClick={onNext} disabled={!canNext}>
          Siguiente
        </Button>
      </Box>
    </Box>
  );
}
