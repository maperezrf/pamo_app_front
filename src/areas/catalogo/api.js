import { api } from "../../api";

export const catalogApi = {
  workspace: (page, filters, columnFilters, tableSort, signal) =>
    api.catalogWorkspace(page, filters, columnFilters, tableSort, signal),
  columnOptions: api.catalogColumnOptions,
  channelRefreshStatus: api.catalogChannelRefreshStatus,
  startChannelRefresh: api.startCatalogChannelRefresh,
  alignment: api.catalogAlignment,
  executive: api.catalogExecutiveSimulation,
  importPlan: api.catalogShopifyImportPlan,
  shopifySyncWorkspace: api.catalogShopifySyncWorkspace,
  shopifySyncAction: api.catalogShopifySyncAction,
  pilot: api.catalogPilotSimulation,
  physicalQueue: api.catalogPhysicalReviewQueue,
  decidePhysicalEvidence: api.decideCatalogPhysicalEvidence,
  measurementWorkspace: api.catalogPhysicalMeasurementWorkspace,
  measurementAction: api.catalogPhysicalMeasurementAction,
  enviaQuoteContract: api.catalogEnviaQuoteContract,
  validateEnviaFixture: api.validateCatalogEnviaFixture,
  simulatePrice: api.simulateCatalogPrice,
  updateHypothesis: api.updateCatalogHypothesis,
  phase6Workspace: api.catalogPhase6Workspace,
  phase6Pricing: api.catalogPhase6Pricing,
  phase6Multwarehouse: api.catalogPhase6Multwarehouse,
  phase7Workspace: api.catalogPhase7Workspace,
  sodimacWorkspace: api.catalogSodimacWorkspace,
  sodimacAction: api.catalogSodimacAction,
};
