// Etiquetas del área de procesos (orquestador). Valores del contrato en
// backend/docs/patterns/orchestrator-usage-guide.md; un valor desconocido se
// muestra tal cual.

// `ProcessStatus` del backend → [etiqueta, tono de StatusChip, ¿activo?].
const EXECUTION_STATUS = {
  PENDIENTE: ["Pendiente", "neutral", true],
  EN_COLA: ["En cola", "neutral", true],
  EJECUTANDO: ["Ejecutando", "neutral", true],
  CANCELANDO: ["Cancelando", "neutral", true],
  COMPLETADO: ["Completado", "success", false],
  ERROR: ["Error", "error", false],
  CANCELADO: ["Cancelado", "neutral", false],
  INTERRUMPIDO: ["Interrumpido", "error", false],
};

export const EXECUTION_STATUS_OPTIONS = Object.entries(EXECUTION_STATUS).map(([value, [label]]) => ({ value, label }));

export function executionStatus(value) {
  const [label, tone, active] = EXECUTION_STATUS[value] ?? [value, "neutral", false];
  return { label, tone, active };
}

export const SCHEDULE_KIND_OPTIONS = [
  { value: "DAILY", label: "Diaria" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "ONCE_DATE", label: "Una sola vez" },
  { value: "CRON", label: "Expresión CRON" },
];

// 0 = lunes, como `Weekday` del backend.
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// "06:00:00" → "06:00".
const hhmm = (time) => (time ? time.slice(0, 5) : "—");

// Programación en una frase. Las CRON de un solo horario diario
// ("0 5 * * *", las que existen hoy) se leen como diarias.
export function describeSchedule(schedule) {
  switch (schedule.schedule_kind) {
    case "DAILY":
      return `Todos los días a las ${hhmm(schedule.run_at_time)}`;
    case "WEEKLY":
      return `Cada ${WEEKDAYS[schedule.weekday]?.toLowerCase() ?? "—"} a las ${hhmm(schedule.run_at_time)}`;
    case "MONTHLY":
      return `El día ${schedule.day_of_month} de cada mes a las ${hhmm(schedule.run_at_time)}`;
    case "ONCE_DATE":
      return `Una vez, el ${schedule.run_at_date} a las ${hhmm(schedule.run_at_time)}`;
    case "CRON": {
      const match = /^(\d{1,2}) (\d{1,2}|\*) \* \* \*$/.exec(schedule.cron_expression ?? "");
      if (match) {
        const minute = match[1].padStart(2, "0");
        return match[2] === "*"
          ? `Cada hora, en el minuto ${minute}`
          : `Todos los días a las ${match[2].padStart(2, "0")}:${minute}`;
      }
      return `CRON ${schedule.cron_expression}`;
    }
    default:
      return schedule.schedule_kind;
  }
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds % 60)} s`;
}

// Errores del backend (`{detail}` o `{campo: [mensajes]}`) → un texto.
export function errorMessage(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (data.detail) return String(data.detail);
  return Object.values(data).flat().join(" ") || fallback;
}
