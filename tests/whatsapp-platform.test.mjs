import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const apiUrl = new URL("../src/areas/communications/api.js", import.meta.url);
const panelUrl = new URL("../src/areas/communications/WhatsAppCloudPanel.jsx", import.meta.url);
const settingsUrl = new URL("../src/areas/communications/WhatsAppSettings.jsx", import.meta.url);
const appUrl = new URL("../src/App.jsx", import.meta.url);
const ordersUrl = new URL("../src/areas/pedidos/screens/OrdersWorkspace.jsx", import.meta.url);


test("el frontend usa únicamente la API propia y nunca recibe secretos Meta", async () => {
  const [api, panel] = await Promise.all([
    readFile(apiUrl, "utf8"),
    readFile(panelUrl, "utf8"),
  ]);
  assert.match(api, /\/api\/communications\/whatsapp\/capabilities\//);
  assert.match(api, /\/api\/communications\/whatsapp\/settings\//);
  assert.match(api, /\/api\/communications\/whatsapp\/drafts\//);
  assert.match(api, /\/dispatch\//);
  assert.doesNotMatch(`${api}\n${panel}`, /META_(APP_SECRET|SYSTEM_USER_TOKEN|WABA_ID|PHONE_NUMBER_ID)/);
});


test("cada despacho prepara una copia para todos sus contactos activos", async () => {
  const panel = await readFile(panelUrl, "utf8");
  assert.match(panel, /item\.contacts\.map\(\(contact\)/);
  assert.match(panel, /shipment_id: item\.shipmentId/);
  assert.match(panel, /contact_id: contact\.id/);
  assert.match(panel, /una copia independiente para cada contacto activo/);
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
  assert.doesNotMatch(orders, /WhatsAppCloudPanel/);
});


test("la configuración vive fuera de Pedidos y nunca solicita secretos", async () => {
  const [settings, app] = await Promise.all([
    readFile(settingsUrl, "utf8"),
    readFile(appUrl, "utf8"),
  ]);
  assert.match(app, /path="\/integraciones\/whatsapp"/);
  assert.match(settings, /Estado operativo/);
  assert.match(settings, /Los secretos nunca se ingresan aquí/);
  assert.doesNotMatch(settings, /type="password"/);
  assert.match(settings, /Detalles técnicos y diagnóstico/);
  assert.match(settings, /Perfil comercial de la línea/);
  assert.match(settings, /Copias internas del piloto/);
  assert.match(settings, /Simulación · no ejecuta cambios/);
  assert.match(settings, /disabled title="Requiere autorización/);
});


test("Pedidos conserva el fallback manual y muestra el piloto sin exponer números", async () => {
  const orders = await readFile(ordersUrl, "utf8");
  assert.match(orders, /Piloto interno de WhatsApp/);
  assert.match(orders, /pilotRecipientMasked/);
  assert.match(orders, /automatización apagada; no procesa pedidos/);
  assert.match(orders, /<strong>SKU \{item\.sku \|\| "Sin SKU"\}<\/strong>/);
});


test("Pedidos muestra acciones correlacionadas y un historial aditivo de novedades", async () => {
  const orders = await readFile(ordersUrl, "utf8");
  assert.match(orders, />Confirmado<\/button>/);
  assert.match(orders, />Agotado<\/button>/);
  assert.match(orders, />Listo para despacho<\/button>/);
  assert.match(orders, />Reportar novedad<\/button>/);
  assert.match(orders, /Novedades e historial/);
  assert.match(orders, /supplier_response_events\.map/);
  assert.match(orders, /Producto averiado/);
  assert.match(orders, /Problema con la guía/);
});


test("la configuración interna no afirma activación cuando la bandera está apagada", async () => {
  const settings = await readFile(settingsUrl, "utf8");
  assert.match(settings, /internalOrderNotificationsEnabled/);
  assert.match(settings, /Configurado · apagado/);
  assert.doesNotMatch(settings, /Camila|1898/);
});
