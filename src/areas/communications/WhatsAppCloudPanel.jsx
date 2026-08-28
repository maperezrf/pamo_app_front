import { useEffect, useMemo, useState } from "react";
import { communicationsApi } from "./api";


function replaceDraft(items, updated) {
  return items.map((item) => (item.id === updated.id ? updated : item));
}


export default function WhatsAppCloudPanel({ selected, stale, onError, onNotice }) {
  const [capabilities, setCapabilities] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState("");
  const selectedKey = selected.join("|");

  useEffect(() => {
    communicationsApi.capabilities().then(setCapabilities).catch(() => setCapabilities(null));
  }, []);

  useEffect(() => {
    setShipments([]);
    setDrafts([]);
  }, [selectedKey]);

  const allRecipientsChosen = useMemo(
    () => shipments.length > 0 && shipments.every((item) => item.contacts.length > 0),
    [shipments],
  );

  const loadRecipients = async () => {
    if (!selected.length) return;
    setBusy("recipients");
    onError("");
    try {
      const payload = await communicationsApi.recipients(selected);
      setShipments(payload.shipments || []);
      onNotice("Se preparará una copia independiente para cada contacto activo del despacho.");
    } catch (reason) {
      onError(reason.message);
    } finally {
      setBusy("");
    }
  };

  const createDrafts = async () => {
    if (!allRecipientsChosen) {
      onError("Debes elegir un contacto válido para cada despacho seleccionado.");
      return;
    }
    setBusy("drafts");
    onError("");
    try {
      const selections = shipments.flatMap((item) =>
        item.contacts.map((contact) => ({
          shipment_id: item.shipmentId,
          contact_id: contact.id,
        })),
      );
      const payload = await communicationsApi.createDrafts(selections);
      setDrafts(payload.drafts || []);
      onNotice("Borradores preparados para revisión. Nada se envió.");
    } catch (reason) {
      onError(reason.message);
    } finally {
      setBusy("");
    }
  };

  const approveAndQueue = async (draft) => {
    setBusy(`approve-${draft.id}`);
    onError("");
    try {
      const approved = await communicationsApi.draftAction(draft.id, "approve");
      const queued = await communicationsApi.draftAction(draft.id, "enqueue");
      setDrafts((items) =>
        replaceDraft(items, { ...approved.draft, state: "queued", outbox: queued.outbox }),
      );
      onNotice("Borrador aprobado y encolado localmente. Aún no se envió.");
    } catch (reason) {
      onError(reason.message);
    } finally {
      setBusy("");
    }
  };

  const dispatchMock = async (draft) => {
    if (!draft.outbox?.id) return;
    setBusy(`dispatch-${draft.id}`);
    onError("");
    try {
      const payload = await communicationsApi.dispatch(draft.outbox.id);
      setDrafts((items) =>
        replaceDraft(items, {
          ...draft,
          state: payload.outbox.state,
          outbox: payload.outbox,
        }),
      );
      onNotice(
        payload.simulation
          ? "Simulación local completada; externalWrites=0."
          : "Envío registrado por Meta al destinatario autorizado.",
      );
    } catch (reason) {
      onError(reason.message);
    } finally {
      setBusy("");
    }
  };

  const providerLabel = capabilities?.mockMode ? "Mock local" : "Meta Cloud API";
  const canDispatch = capabilities?.mockMode || capabilities?.externalWritesEnabled;

  return (
    <section className="whatsapp-cloud-panel" aria-label="WhatsApp Cloud local">
      <header>
        <div>
          <strong>WhatsApp Cloud · {providerLabel}</strong>
          <span>Vista previa, aprobación humana y outbox idempotente.</span>
        </div>
        <span className="local-safety-pill">
          {capabilities?.externalWritesEnabled ? "Salida real habilitada" : "externalWrites: 0"}
        </span>
      </header>

      <div className="whatsapp-cloud-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={!selected.length || stale || busy === "recipients"}
          onClick={loadRecipients}
        >
          {busy === "recipients" ? "Consultando…" : "Preparar WhatsApp Cloud"}
        </button>
        <small>
          La ubicación de Shopify determina la bodega; no se infiere por nombre.
        </small>
      </div>

      {shipments.length > 0 && (
        <div className="whatsapp-recipient-grid">
          {shipments.map((shipment) => (
            <div key={shipment.shipmentId} className="whatsapp-recipient-row">
              <span>
                Pedido {shipment.order} · {shipment.warehouse}
                {shipment.hasDocument ? " · PDF disponible" : " · sin PDF"}
              </span>
              <div className="whatsapp-contact-copies">
                {shipment.contacts.map((contact) => (
                  <span key={contact.id}>{contact.name} · {contact.phoneMasked}</span>
                ))}
              </div>
              {!shipment.contacts.length && <em>Esta bodega no tiene contactos activos.</em>}
            </div>
          ))}
          <button
            type="button"
            className="primary-action"
            disabled={!allRecipientsChosen || stale || busy === "drafts"}
            onClick={createDrafts}
          >
            {busy === "drafts" ? "Creando…" : "Crear vistas previas"}
          </button>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="whatsapp-draft-list">
          {drafts.map((draft) => (
            <article key={draft.id}>
              <header>
                <div>
                  <b>Pedido {draft.source.order} · {draft.recipient.name}</b>
                  <span>{draft.recipient.phoneMasked} · {draft.warehouse}</span>
                </div>
                <span className={`whatsapp-state state-${draft.state}`}>{draft.state}</span>
              </header>
              <pre>{draft.body}</pre>
              <small>
                {draft.document.available
                  ? `Guía adjunta: ${draft.document.name}`
                  : "El mensaje se puede preparar sin guía."}
              </small>
              <footer>
                {draft.state === "draft" && (
                  <button
                    type="button"
                    className="primary-action"
                    disabled={stale || busy === `approve-${draft.id}`}
                    onClick={() => approveAndQueue(draft)}
                  >
                    Aprobar y encolar
                  </button>
                )}
                {draft.state === "queued" && (
                  <button
                    type="button"
                    className="primary-action"
                    disabled={!canDispatch || stale || busy === `dispatch-${draft.id}`}
                    onClick={() => dispatchMock(draft)}
                  >
                    {capabilities?.mockMode ? "Simular envío local · no se envía" : "Enviar por Meta"}
                  </button>
                )}
                {draft.state === "sent" && (
                  <span>
                    {capabilities?.mockMode
                      ? "Simulación registrada; ningún proveedor recibió el mensaje."
                      : "Meta registró el envío al único destinatario autorizado del piloto."}
                  </span>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
