/**
 * Provider Registry Index
 * Central exports for all provider registries
 */

export {
    AcademicRegistry, academicRegistryCapabilities, arxivCapabilities, context7Capabilities, getAcademicRegistry, openAlexCapabilities, semanticScholarCapabilities, vibeCheckCapabilities, wikidataCapabilities
} from "./providers/academic.js";

export type {
    AcademicProviderRegistry, ProviderCapability,
    ProviderRegistration
} from "./providers/academic.js";
