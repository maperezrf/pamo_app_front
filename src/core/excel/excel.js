// Lectura y escritura de Excel en el navegador (SheetJS). El backend no
// genera ni lee archivos: recibe y entrega filas en JSON. La librería se
// carga bajo demanda para no engordar el bundle inicial.

const loadXlsx = () => import("xlsx");

// Primera hoja → [{columna: valor}]. Los encabezados se recortan y pasan a
// minúsculas; las columnas sin encabezado y las filas vacías se descartan.
// Los números llegan como número (el backend los normaliza: 54654.0 → "54654").
export async function readSheetRows(file) {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils
    .sheet_to_json(sheet, { defval: "" })
    .map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => !key.startsWith("__EMPTY"))
          .map(([key, value]) => [key.trim().toLowerCase(), typeof value === "string" ? value.trim() : value]),
      ),
    )
    .filter((row) => Object.values(row).some((value) => value !== ""));
}

// Descarga `rows` como .xlsx con las columnas en el orden de `columns`.
export async function downloadSheet(filename, columns, rows) {
  const XLSX = await loadXlsx();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Hoja1");
  XLSX.writeFile(workbook, filename);
}
