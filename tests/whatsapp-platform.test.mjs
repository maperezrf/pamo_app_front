import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const apiUrl = new URL("../src/areas/communications/api.js", import.meta.url);
const panelUrl = new URL("../src/areas/communications/WhatsAppCloudPanel.jsx", import.meta.url);
const ordersUrl = new URL("../src/areas/pedidos/screens/OrdersWorkspace.jsx", import.meta.url);


test("el frontend usa únicamente la API propia y nunca recibe secretos Meta", async () => {
  const [api, panel] = await Promise.all([
    readFile(apiUrl, "utf8"),
    readFile(panelUrl, "utf8"),
  ]);
  assert.match(api, /\/api\/communications\/whatsapp\/capabilities\//);
  assert.match(api, /\/api\/communications\/whatsapp\/drafts\//);
  assert.match(api, /\/dispatch\//);
  assert.doesNotMatch(`${api}\n${panel}`, /META_(APP_SECRET|SYSTEM_USER_TOKEN|WABA_ID|PHONE_NUMBER_ID)/);
});


test("cada despacho exige una selección explícita de contacto", async () => {
  const panel = await readFile(panelUrl, "utf8");
  assert.match(panel, /selectedContacts\[shipment\.shipmentId\] \|\| ""/);
  assert.match(panel, /<option value="">Elegir contacto<\/option>/);
  assert.match(panel, /Debes elegir un contacto válido para cada despacho seleccionado/);
  assert.match(panel, /shipment_id: item\.shipmentId/);
  assert.match(panel, /contact_id: selectedContacts\[item\.shipmentId\]/);
});


test("aprobación, encolado y simulación son pasos humanos separados", async () => {
  const panel = await readFile(panelUrl, "utf8");
  assert.match(panel, /draftAction\(draft\.id, "approve"\)/);
  assert.match(panel, /draftAction\(draft\.id, "enqueue"\)/);
  assert.match(panel, /Aprobar y encolar/);
  assert.match(panel, /Simular envío local/);
  assert.match(panel, /externalWrites: 0/);
});


test("WhatsApp Web manual se conserva y se bloquea en contingencia", async () => {
  const orders = await readFile(ordersUrl, "utf8");
  assert.match(orders, /Preparar WhatsApp Web \(manual\)/);
  assert.match(orders, /disabled=\{!selected\.length \|\| stale \|\| saving === "whatsapp"\}/);
  assert.match(orders, /<WhatsAppCloudPanel/);
  assert.match(orders, /stale=\{stale\}/);
});

