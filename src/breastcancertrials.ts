import stripBom from "strip-bom-stream";
import fs from "node:fs";
import csv from "csv-parser";

export const rxnormSnomedMapping = new Map<string, string>();
export const stageSnomedMapping = new Map<string, string>();
export const ajccStageSnomedMapping = new Map<string, string>();
export const loincBiomarkerMapping = new Map<string, string>();
export const snomedBiomarkerMapping = new Map<string, string>();

/*
 * Imports the mapping CSV at the given file path into the given variable.
 */
export function importCodeMappingFile(filePath: string, mapping: Map<string, string>): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .on("error", (error) => {
        reject(error);
      })
      .pipe(stripBom())
      .pipe(csv())
      .on(
        "data",
        (data: { rxnorm: string; snomed: string; qualifiervaluesnomed: string; clinicalfindingsnomed: string, ajcc: string, loincBiomarker: string, bctLioncBiomarker: string, snomedValue: string, hl7value: string }) => {
          if (data.rxnorm != undefined) {
            mapping.set(data.rxnorm, data.snomed);
          } else if (data.qualifiervaluesnomed != undefined) {
            mapping.set(data.qualifiervaluesnomed, data.clinicalfindingsnomed);
          } else if (data.ajcc != undefined) {
            mapping.set(data.ajcc, data.snomed);
          } else if (data.loincBiomarker != undefined) {
            mapping.set(data.loincBiomarker, data.bctLioncBiomarker);
          } else if (data.snomedValue != undefined) {
            mapping.set(data.snomedValue, data.hl7value);
          } else {
            reject(new Error("Invalid input mapping file."));
            return;
          }
        }
      )
      .on("end", () => {
        console.log("Loaded code mapping with: " + mapping.size.toString() + " entries.");
        resolve(mapping);
      });
  });
}

// Imports RxNorm to SNOMED Code Mapping.
export function importRxnormSnomedMapping(): Promise<Map<string, string>> {
  return importCodeMappingFile("./data/rxnorm-snomed-mapping.csv", rxnormSnomedMapping);
}

// Imports Stage SNOMED Code Mapping from Qualifer Value Stage Codes and Clincal Finding Stage Codes.
export function importStageSnomedMapping(): Promise<Map<string, string>> {
  return importCodeMappingFile("./data/stage-snomed-mapping.csv", stageSnomedMapping);
}

// Imports Stage AJCC Code Mapping SNOMED Code Mapping.
export function importStageAjccMapping(): Promise<Map<string, string>> {
  return importCodeMappingFile("./data/ajcc-stage-snomed-mapping.csv", ajccStageSnomedMapping);
}

// Imports Loinc to Loinc Biomarker Code Mapping.
export function importLoincBiomarkerMapping(): Promise<Map<string, string>> {
  return importCodeMappingFile("./data/loinc-to-loinc-biomarker-mapping.csv", loincBiomarkerMapping);
}

// Imports SNOMED Value to HL7 Value Code Mapping.
export function importSnomedHl7Mapping(): Promise<Map<string, string>> {
  return importCodeMappingFile("./data/snomedvalue-to-hl7value-biomarker.csv", snomedBiomarkerMapping);
}

export interface TrialResponse {
  resultNumber: string;
  trialId: string;
  trialTitle: string;
  scientificTitle: string;
  phaseNumber: string;
  purpose: string;
  whoIsThisFor: string;
  whatIsInvolved: string;
  whatIsBeingStudied: string;
  learnMore: string;
  ctGovLink: string;
  eligibilityCriteriaLink: string;
  trialCategories: string[];
  trialMutations: string[];
  newTrialFlag: boolean;
  zip: string;
  distance: string;
  siteName: string;
  city: string;
  state: string;
  visits: string;
  latitude: number;
  longitude: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  noVisitsRequiredFlag: boolean;
  numberOfSites: string;
}
