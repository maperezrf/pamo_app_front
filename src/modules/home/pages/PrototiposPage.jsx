import { useEffect, useMemo, useState } from "react";
import { Box, Chip, Link, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import DataTable from "../../../components/tables/DataTable";

const ESTADO_LABEL = {
  activo: "Activo",
  archivado: "Archivado",
};

const successChipSx = { bgcolor: "success.light", color: "success.main" };
const neutralChipSx = { bgcolor: "background.default", color: "text.secondary" };

function formatFecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const columns = [
  { accessorKey: "nombre", header: "Nombre" },
  {
    accessorKey: "estado",
    header: "Estado",
    cell: ({ getValue }) => {
      const estado = getValue();
      return (
        <Chip
          label={ESTADO_LABEL[estado] ?? estado}
          size="small"
          sx={{ fontSize: 12, fontWeight: 600, ...(estado === "activo" ? successChipSx : neutralChipSx) }}
        />
      );
    },
  },
  { accessorKey: "ambiente", header: "Ambiente" },
  {
    accessorKey: "url_github",
    header: "GitHub",
    cell: ({ getValue }) => {
      const url = getValue();
      if (!url) return "—";
      return (
        <Link href={url} target="_blank" rel="noreferrer">
          Repo
        </Link>
      );
    },
  },
  { accessorKey: "creado_por", header: "Creado por" },
  {
    accessorKey: "creado_en",
    header: "Creado el",
    cell: ({ getValue }) => formatFecha(getValue()),
  },
  {
    id: "merge",
    header: "Merge",
    enableSorting: false,
    cell: ({ row }) => (
      <Box sx={{ display: "flex", gap: 0.75 }}>
        <Chip
          label="Desarrollo"
          size="small"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            height: 20,
            ...(row.original.merged_to_desarrollo ? successChipSx : neutralChipSx),
          }}
        />
        <Chip
          label="Producción"
          size="small"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            height: 20,
            ...(row.original.merged_to_produccion ? successChipSx : neutralChipSx),
          }}
        />
      </Box>
    ),
  },
];

export default function PrototiposPage() {
  const [prototipos, setPrototipos] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | error | ready

  useEffect(() => {
    api.listarPrototipos().then(({ ok, data }) => {
      if (ok) {
        setPrototipos(data);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    });
  }, []);

  const data = useMemo(() => prototipos, [prototipos]);

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight={700} gutterBottom>
        Prototipos
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3.5 }}>
        Listado de prototipos registrados (solo lectura)
      </Typography>

      {status === "loading" && (
        <Typography variant="body2" color="textSecondary">
          Cargando…
        </Typography>
      )}
      {status === "error" && (
        <Typography variant="body2" color="error">
          No se pudo obtener el listado de prototipos.
        </Typography>
      )}
      {status === "ready" && (
        <DataTable columns={columns} data={data} emptyMessage="No hay prototipos registrados." />
      )}
    </Box>
  );
}
