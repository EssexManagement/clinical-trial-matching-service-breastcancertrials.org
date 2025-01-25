/**
 * Handles conversion of patient bundle data to a proper request for matching service apis.
 * Retrieves api response as promise to be used in conversion to fhir ResearchStudy
 */

import {
  ClinicalTrialsGovService,
  SearchSet,
  ServiceConfiguration,
} from "@EssexManagement/clinical-trial-matching-service";
import { Bundle, CodeableConcept, Coding } from "fhir/r4";
import {
  rxnormSnomedMapping,
  stageSnomedMapping,
  ajccStageSnomedMapping,
  loincBiomarkerMapping,
  snomedBiomarkerMapping,
  TrialResponse
} from "./breastcancertrials";
import { convertToResearchStudy } from "./research-study";
import https from "https";
import { IncomingMessage } from "http";

export interface QueryConfiguration extends ServiceConfiguration {
  api_endpoint?: string;
}

export class APIError extends Error {
  constructor(
    message: string,
    public result: IncomingMessage,
    public body: string
  ) {
    super(message);
  }
}

/**
 * Create a new matching function using the given configuration.
 * @param configuration the configuration to use to configure the matcher
 * @param backupService the backup service to use
 */
export function createClinicalTrialLookup(
  configuration: QueryConfiguration,
  backupService?: ClinicalTrialsGovService
): (patientBundle: Bundle) => Promise<SearchSet> {
  // Raise errors on missing configuration
  if (typeof configuration.endpoint !== "string") {
    throw new Error("Missing endpoint in configuration");
  }
  const endpoint = configuration.endpoint;
  return async function getMatchingClinicalTrials(
    patientBundle: Bundle
  ): Promise<SearchSet> {
    patientBundle = performCodeMapping(patientBundle);
    // For now, the full patient bundle is the query
    const result = await sendQuery(endpoint, JSON.stringify(patientBundle, null, 2));
    const studies = result.map(convertToResearchStudy);
    if (backupService) {
      await backupService.updateResearchStudies(studies);
    }
    const ss = new SearchSet();
    for (const study of studies) {
      // If returned from BCT, then the study has a match likelihood of 1
      ss.addEntry(study, 1);
    }
    return ss;
  };
}

/*
 * Maps the Relevant codes in the patient bundle to the codes in the given mapping.
 */
export function performCodeMapping(
  patientBundle: Bundle
): Bundle {
  for (const entry of patientBundle.entry) {
    if (!("resource" in entry)) {
      // Skip bad entries
      continue;
    }

    // If the current resource is a Medication Statement...
    if (
      entry.resource.resourceType == "MedicationStatement"
    ) {
      // Cast to a Coding to access the medicationCodableConcept coding attributes.
      const medicationCodableConcept = entry.resource[
        "medicationCodeableConcept"
      ] as Coding;
      mapCoding(medicationCodableConcept, "MedicationStatement");
    }
    // If the current resource is an Observation
    if (
      entry.resource.resourceType == "Observation"
    ) {
      const code = entry.resource[
        "code"
      ] as Coding;
      mapCoding(code, "Observation");
      const valueCodableConcept = entry.resource[
        "valueCodeableConcept"
      ] as Coding;
      mapCoding(valueCodableConcept, "Observation");
    }
    // If the current resource is a Staging Code...
    if (
      entry.resource.resourceType == "Condition" &&
      entry.resource["stage"] != undefined
    ) {
      // Cast to a Stage[] to access the stage's coding attributes.
      const staging = entry.resource["stage"];
      for (const stage of staging) {
        if (stage.summary != undefined) {
          mapCoding(stage.summary, "Condition");
        }
        if (stage.type != undefined) {
          mapCoding(stage.type, "Condition");
        }
      }
    }
  }
  return patientBundle;
}

/*
 * Converts the codes in a given CodeableConcept based on the given mapping.
 */
function mapCoding(coding: CodeableConcept | undefined, resourceType: string) {
  // Check all the codes for conversion based on the given mapping.
  let count = 0;
  // Check if coding is undefined in the event of an unexpected bundle format. If so, skip this resource.
  if (coding == undefined || coding.coding == undefined) {
    return;
  }
  for (const currentCoding of coding.coding) {
    const origSystem: string = currentCoding.system;
    let resultSystem = "http://snomed.info/sct";
    // set mapping
    let mapping = new Map<string, string>();
    if (origSystem != undefined) {
      if (origSystem.includes("rxnorm")) {
        mapping = rxnormSnomedMapping;
      } else if (origSystem.includes("loinc")) {
        mapping = loincBiomarkerMapping;
        resultSystem = origSystem;
      } else if (origSystem.includes("snomed") && resourceType == "Observation") {
        mapping = snomedBiomarkerMapping;
        resultSystem = "http://hl7.org/fhir/v2/0078";
      } else if (origSystem.includes("snomed")) {
        mapping = stageSnomedMapping;
      } else if (origSystem.includes("ajcc") || origSystem.includes("cancerstaging.org")) {
        mapping = ajccStageSnomedMapping;
      }
    }
    const potentialNewCode: string = mapping.get(currentCoding.code.toLowerCase());
    if (potentialNewCode != undefined) {
      // Code exists in the given mapping; update it.
      coding.coding[count].code = potentialNewCode;
      coding.coding[count].system = resultSystem;
      if (coding.coding[count].display != undefined) {
        coding.coding[count].display = undefined;
      }
    }
    count++;
  }
}

export function sendQuery(
  endpoint: string,
  query: string
): Promise<TrialResponse[]> {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(query, "utf8");
    console.log("Running raw query");
    console.log(query);

    const request = https.request(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/fhir+json",
        },
      },
      (result) => {
        let responseBody = "";
        result.on("data", (chunk) => {
          responseBody += chunk;
        });
        result.on("end", () => {
          console.log("Complete");
          if (result.statusCode === 200) {
            try {
              const json = JSON.parse(responseBody) as unknown;
              if (Array.isArray(json)) {
                // Assume it's correct
                resolve(json as TrialResponse[]);
              } else {
                reject(
                  new APIError(
                    "Unexpected JSON result from server",
                    result,
                    responseBody
                  )
                );
              }
            } catch (ex) {
              reject(
                new APIError(
                  "Unexpected exception parsing server response",
                  result,
                  responseBody
                )
              );
            }
          } else {
            reject(
              new APIError(
                `Server returned ${result.statusCode} ${result.statusMessage}`,
                result,
                responseBody
              )
            );
          }
        });
      }
    );

    request.on("error", (error) => reject(error));

    request.write(body);
    request.end();
  });
}
