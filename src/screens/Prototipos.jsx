import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import DataTable from "../shared/ui/DataTable";

const ESTADO_LABEL = {
  activo: "Activo",
  archivado: "Archivado",
};

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
      return <span className={`estado-badge ${estado}`}>{ESTADO_LABEL[estado] ?? estado}</span>;
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
        <a href={url} target="_blank" rel="noreferrer">
          Repo
        </a>
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
      <span className="merge-flags">
        <span className={row.original.merged_to_desarrollo ? "flag-on" : "flag-off"}>
          Desarrollo
        </span>
        <span className={row.original.merged_to_produccion ? "flag-on" : "flag-off"}>
          Producción
        </span>
      </span>
    ),
  },
];

export default function Prototipos() {
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
    <div>
      <h1>Prototipos</h1>
      <p className="subtitle">Listado de prototipos registrados (solo lectura)</p>

      {status === "loading" && <p className="loading-text">Cargando…</p>}
      {status === "error" && (
        <p className="error-text">No se pudo obtener el listado de prototipos.</p>
      )}
      {status === "ready" && <DataTable columns={columns} data={data} emptyMessage="No hay prototipos registrados." />}
    </div>
  );
}
