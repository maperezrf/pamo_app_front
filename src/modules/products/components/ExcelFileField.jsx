import { Button } from "@mui/material";

const ACCEPT = ".xlsx,.xls,.csv";

// Elegir un Excel para leerlo en el navegador (cargas del catálogo).
export default function ExcelFileField({ file, onChange }) {
  return (
    <Button size="small" variant="outlined" component="label">
      {file ? file.name : "Elegir Excel"}
      <input
        hidden
        type="file"
        accept={ACCEPT}
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </Button>
  );
}
