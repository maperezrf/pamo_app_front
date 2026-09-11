import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { remittancesApi } from "../api";
import "../styles/remittances.css";

const CACHE_HOURS = 4;

function uppercase(value) {
  return value.toLocaleUpperCase("es-CO");
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function SignaturePad({ onChange, resetSignal }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = Math.max(globalThis.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2.5;
    context.strokeStyle = "#17211a";
  }, [resetSignal]);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const start = (event) => {
    event.preventDefault();
    drawing.current = true;
    canvasRef.current.setPointerCapture(event.pointerId);
    const [x, y] = point(event);
    const context = canvasRef.current.getContext("2d");
    context.beginPath();
    context.moveTo(x, y);
  };
  const move = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    const [x, y] = point(event);
    const context = canvasRef.current.getContext("2d");
    context.lineTo(x, y);
    context.stroke();
    onChange(true);
  };
  const stop = (event) => {
    if (!drawing.current) return;
    event.preventDefault();
    drawing.current = false;
  };

  return (
    <canvas
      ref={canvasRef}
      className="rm-signature-canvas"
      aria-label="Firma de quien recibe"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
}

function initialAllocations(lines) {
  return Object.fromEntries(lines.map((line) => [line.id, [{
    id: newId(),
    quantity: String(line.quantity),
    destination: line.currentDestination ?? "",
  }]]));
}

export default function RecipientRemittanceScreen() {
  const { token } = useParams();
  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [signerName, setSignerName] = useState("");
  const [allocations, setAllocations] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkDestination, setBulkDestination] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const canvasContainerRef = useRef(null);
  const cacheKey = `pamo-recipient-remittance:${token}`;

  useEffect(() => {
    let active = true;
    remittancesApi.publicRecipient(token).then((response) => {
      if (!active) return;
      if (!response.ok) {
        setError(response.data?.detail ?? "No fue posible abrir la remisión.");
        setStatus("error");
        return;
      }
      setData(response.data);
      if (response.data.status === "SIGNED") {
        setStatus("signed");
        return;
      }
      let cached = null;
      try {
        cached = JSON.parse(sessionStorage.getItem(cacheKey));
        if (!cached || Date.now() - cached.savedAt > CACHE_HOURS * 60 * 60 * 1000) cached = null;
      } catch {
        cached = null;
      }
      setSignerName(cached?.signerName ?? response.data.suggestedSigner ?? "");
      setAllocations(cached?.allocations ?? initialAllocations(response.data.lines));
      setSelected(new Set(response.data.lines.map((line) => line.id)));
      setStatus("ready");
    });
    return () => { active = false; };
  }, [cacheKey, token]);

  useEffect(() => {
    if (status !== "ready") return;
    sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), signerName, allocations }));
  }, [allocations, cacheKey, signerName, status]);

  const destinationOptions = useMemo(() => {
    const values = new Set(data?.destinations ?? []);
    Object.values(allocations).flat().forEach((item) => item.destination && values.add(uppercase(item.destination)));
    return [...values].sort();
  }, [allocations, data]);

  const missing = useMemo(() => {
    if (!data || status !== "ready") return [];
    const result = [];
    if (!signerName.trim()) result.push("Nombre de quien recibe");
    data.lines.forEach((line) => {
      const parts = allocations[line.id] ?? [];
      const total = parts.reduce((sum, part) => sum + Number(part.quantity || 0), 0);
      if (!parts.length || Math.abs(total - Number(line.quantity)) > 0.0005) {
        result.push(`Distribuir exactamente ${line.quantity} de ${line.description}`);
      }
      if (parts.some((part) => !part.destination.trim())) result.push(`Destino de ${line.description}`);
    });
    if (!hasSignature) result.push("Firma de quien recibe");
    return result;
  }, [allocations, data, hasSignature, signerName, status]);

  const setPart = (lineId, partId, field, value) => {
    setAllocations((current) => ({
      ...current,
      [lineId]: current[lineId].map((part) => part.id === partId
        ? { ...part, [field]: field === "destination" ? uppercase(value) : value }
        : part),
    }));
  };
  const splitLine = (lineId) => {
    setAllocations((current) => {
      const parts = current[lineId];
      const last = parts[parts.length - 1];
      const quantity = Number(last.quantity);
      const firstHalf = quantity > 0 ? (quantity / 2).toFixed(3) : "";
      const secondHalf = quantity > 0 ? (quantity - Number(firstHalf)).toFixed(3) : "";
      return {
        ...current,
        [lineId]: [
          ...parts.slice(0, -1),
          { ...last, quantity: firstHalf },
          { id: newId(), quantity: secondHalf, destination: last.destination },
        ],
      };
    });
  };
  const removePart = (lineId, partId) => {
    setAllocations((current) => ({ ...current, [lineId]: current[lineId].filter((part) => part.id !== partId) }));
  };
  const applyBulk = () => {
    const destination = uppercase(bulkDestination.trim());
    if (!destination) return;
    setAllocations((current) => Object.fromEntries(Object.entries(current).map(([lineId, parts]) => [
      lineId,
      selected.has(lineId) ? parts.map((part) => ({ ...part, destination })) : parts,
    ])));
  };
  const clearSignature = () => {
    const canvas = canvasContainerRef.current?.querySelector("canvas");
    canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setResetSignal((current) => current + 1);
  };

  const submit = async () => {
    if (missing.length || submitting) return;
    const canvas = canvasContainerRef.current.querySelector("canvas");
    setSubmitting(true);
    setError("");
    const response = await remittancesApi.acceptRecipient(token, {
      signerName: uppercase(signerName.trim()),
      idempotencyKey: newId(),
      signature: { mimeType: "image/png", base64: canvas.toDataURL("image/png") },
      allocations: data.lines.flatMap((line) => allocations[line.id].map((part) => ({
        lineId: line.id,
        quantity: Number(part.quantity).toFixed(3),
        destination: uppercase(part.destination.trim()),
      }))),
    });
    setSubmitting(false);
    if (!response.ok) {
      setError(response.data?.detail ?? "No se pudo guardar la firma.");
      return;
    }
    sessionStorage.removeItem(cacheKey);
    setStatus("signed");
  };

  if (status === "loading") return <main className="rm-public-page"><div className="rm-public-card rm-state">Abriendo remisión segura…</div></main>;
  if (status === "error") return <main className="rm-public-page"><div className="rm-public-card rm-notice error" role="alert"><strong>No se pudo abrir.</strong> {error}</div></main>;
  if (status === "signed") return (
    <main className="rm-public-page">
      <section className="rm-public-card rm-signed-success">
        <span aria-hidden="true">✓</span><h1>Remisión firmada</h1>
        <p>La información quedó guardada en PAMO. Puedes ver o descargar el documento firmado.</p>
        <div className="rm-signed-actions">
          <a className="rm-button primary" href={remittancesApi.publicDocumentUrl(token)} target="_blank" rel="noreferrer">Ver remisión firmada</a>
          <a className="rm-button secondary" href={remittancesApi.publicDocumentUrl(token, true)}>Descargar PDF</a>
        </div>
      </section>
    </main>
  );

  return (
    <main className="rm-public-page">
      <section className="rm-public-card">
        <header className="rm-public-head">
          <div><span className="rm-eyebrow">Remisión digital PAMO</span><h1>{data.rdNumber}</h1><p>{data.clientName}</p></div>
          <span className="rm-status">Firma pendiente</span>
        </header>
        <p>Revisa los productos, asigna dónde se usarán y firma al final. Aquí no se muestran precios, SKU ni datos del proveedor.</p>

        <section className="rm-bulk-destination" aria-labelledby="bulk-title">
          <h2 id="bulk-title">Asignación rápida</h2>
          <div className="rm-select-actions">
            <button type="button" onClick={() => setSelected(new Set(data.lines.map((line) => line.id)))}>Todos</button>
            <button type="button" onClick={() => setSelected(new Set(data.lines.filter((line) => (allocations[line.id] ?? []).some((part) => !part.destination)).map((line) => line.id)))}>Pendientes</button>
            <button type="button" onClick={() => setSelected(new Set())}>Ninguno</button>
          </div>
          <label>Destino para los productos seleccionados
            <div className="rm-bulk-row">
              <input list="rm-destinations" value={bulkDestination} onChange={(event) => setBulkDestination(uppercase(event.target.value))} placeholder="CALLE 80, PLANTA, RESTAURANTE…" />
              <button type="button" className="rm-button primary" onClick={applyBulk} disabled={!bulkDestination.trim() || !selected.size}>Aplicar</button>
            </div>
          </label>
        </section>

        <datalist id="rm-destinations">{destinationOptions.map((value) => <option value={value} key={value} />)}</datalist>
        <div className="rm-recipient-lines">
          {data.lines.map((line, index) => (
            <article key={line.id}>
              <div className="rm-recipient-line-head">
                <label className="rm-line-check"><input type="checkbox" checked={selected.has(line.id)} onChange={(event) => setSelected((current) => {
                  const next = new Set(current);
                  if (event.target.checked) next.add(line.id); else next.delete(line.id);
                  return next;
                })} /> Producto {index + 1}</label>
                <strong>{line.quantity} × {line.description}</strong>
              </div>
              {(allocations[line.id] ?? []).map((part, partIndex) => (
                <div className="rm-allocation-row" key={part.id}>
                  <label>Cantidad<input type="number" min="0.001" step="0.001" inputMode="decimal" value={part.quantity} onChange={(event) => setPart(line.id, part.id, "quantity", event.target.value)} /></label>
                  <label>Destino<input list="rm-destinations" value={part.destination} onChange={(event) => setPart(line.id, part.id, "destination", event.target.value)} placeholder="DESTINO DE USO" /></label>
                  {partIndex > 0 && <button type="button" className="rm-link-button danger" onClick={() => removePart(line.id, part.id)}>Quitar</button>}
                </div>
              ))}
              <button type="button" className="rm-link-button" onClick={() => splitLine(line.id)}>+ Dividir entre dos destinos</button>
            </article>
          ))}
        </div>

        <section className="rm-signature-section" ref={canvasContainerRef}>
          <h2>Firma de quien recibe</h2>
          <label>Nombre completo<input value={signerName} onChange={(event) => setSignerName(uppercase(event.target.value))} placeholder="NOMBRE EN MAYÚSCULAS" /></label>
          <p>Firma dentro del recuadro con el dedo o lápiz táctil.</p>
          <SignaturePad onChange={setHasSignature} resetSignal={resetSignal} />
          <button type="button" className="rm-button secondary" onClick={clearSignature} disabled={!hasSignature}>Limpiar firma</button>
        </section>

        {error && <div className="rm-notice error" role="alert"><strong>No se guardó.</strong> {error}</div>}
        <div className={`rm-required-summary${missing.length ? "" : " complete"}`} role="status" aria-live="polite">
          {missing.length ? <><strong>Falta completar para aceptar:</strong><ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul></> : <><strong>Todo está completo.</strong> Ya puedes aceptar y firmar.</>}
        </div>
        <button type="button" className="rm-button primary rm-public-submit" onClick={submit} disabled={missing.length > 0 || submitting}>
          {submitting ? "Guardando firma…" : "Aceptar y firmar remisión"}
        </button>
      </section>
    </main>
  );
}
