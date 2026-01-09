/**
 * Provider Registry Index
 * Central exports for all provider registries
 */

export {
  AcademicRegistry,
  academicRegistryCapabilities,
  arxivCapabilities,
  context7Capabilities,
  cortexVibeCapabilities,
  getAcademicRegistry,
  openAlexCapabilities,
  researchQualityCapabilities,
  semanticScholarCapabilities,
  wikidataCapabilities,
} from "./providers/academic.js";

export type {
  AcademicProviderRegistry,
  ProviderCapability,
  ProviderRegistration,
} from "./providers/academic.js";
