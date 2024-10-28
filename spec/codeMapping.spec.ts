import { Bundle, BundleEntry, Coding, ConditionStage, FhirResource } from "fhir/r4";
import { performCodeMapping } from "../src/query";
import fs from "node:fs/promises";
import path from "node:path";
import {
  importRxnormSnomedMapping,
  importStageSnomedMapping,
  importStageAjccMapping,
} from "../src/breastcancertrials";

function expectCoding(codings: Coding[] | undefined, expectedCode: string, expectedSystem: string, index=0): void {
  if (!codings) {
    fail('missing codings');
    return;
  }
  if (codings.length <= index) {
    fail(`missing coding at ${index}, only ${codings.length} in array`);
    return;
  }
  const actualCoding = codings[index];
  expect(actualCoding.code).toEqual(expectedCode);
  expect(actualCoding.system).toEqual(expectedSystem);
}

/**
 * Check that a medication coding is as expected.
 */
function expectMedicationCoding(entry: BundleEntry<FhirResource> | undefined, expectedCode: string, expectedSystem: string, index=0): void {
  const resource = entry?.resource;
  if (!resource) {
    fail('entry/resource is missing');
    return;
  }
  if (resource.resourceType != 'MedicationStatement') {
    fail(`expected MedicationStatement, got "${resource.resourceType}"`);
    return;
  }
  expectCoding(resource.medicationCodeableConcept?.coding, expectedCode, expectedSystem, index);
}

/**
 * Check that a observation coding is as expected.
 */
function expectObservationCoding(entry: BundleEntry<FhirResource> | undefined, expectedCode: string, expectedSystem: string, index=0): void {
  const resource = entry?.resource;
  if (!resource) {
    fail('entry/resource is missing');
    return;
  }
  if (resource.resourceType != 'Observation') {
    fail(`expected Observation, got "${resource.resourceType}"`);
    return;
  }
  expectCoding(resource.code?.coding, expectedCode, expectedSystem, index);
}

/**
 * Check that a stage coding is as expected
 */
function getStage(entry: BundleEntry<FhirResource> | undefined, index=0): ConditionStage | undefined {
  const resource = entry?.resource;
  if (!resource) {
    fail('entry/resource is missing');
    return undefined;
  }
  if (resource.resourceType != 'Condition') {
    fail(`expected Condition, got "${resource.resourceType}"`);
    return undefined;
  }
  const stages = resource.stage;
  if (!stages) {
    fail('missing stage');
    return undefined;
  }
  if (stages.length <= index) {
    fail(`missing stage[${index}], only ${stages.length} in array`);
    return undefined;
  }
  return stages[index];
}

describe("Code Mapping Tests.", () => {
  // Setup
  let testPatientBundle: Bundle;
  beforeAll(async () => {
    await importRxnormSnomedMapping();
    await importStageSnomedMapping();
    await importStageAjccMapping();
    const patientDataPath = path.join(
      __dirname,
      "../../spec/data/patient_data.json"
    );
    testPatientBundle = JSON.parse(await fs.readFile(patientDataPath, { encoding: "utf8" })) as Bundle;
  });

  it("Test Coding Mappings.", function () {
    // Map the RxNorm-SNOMED codes in the patient bundle.
    performCodeMapping(testPatientBundle);
    // Map the Staging SNOMED codes in the patient bundle.
    //performCodeMapping(testPatientBundle);

    const entries = testPatientBundle.entry;
    if (!entries) {
      fail('Test data is missing test entries');
      return;
    }
    // Test that RxNorm code 904425 gets mapped to SNOMED 96290008 (located in entry[1] in patient_data)
    expectMedicationCoding(entries[1], "96290008", "http://snomed.info/sct");
    let actualStage = getStage(entries[2]);
    if (actualStage) {
      // Test that Staging summary SNOMED code 258215001 gets mapped to SNOMED 13104003 (located in entry[2], stage[0], coding[1] in patient_data)
      expectCoding(actualStage.summary?.coding, "13104003", "http://snomed.info/sct", 1);
      // Test that Staging type SNOMED code 261639007 gets mapped to SNOMED 64062008 (located in entry[2], stage[0], coding[0] in patient_data)
      expectCoding(actualStage.type?.coding, "64062008", "http://snomed.info/sct");
    }
    // Test that LOINC code 34566 Does NOT map to anything else (located in entry[3] in patient_data).
    expectObservationCoding(entries[3], "34566", "http://loinc.org");
    // Test that RxNorm code 1156253 gets mapped to SNOMED 395926009 (located in entry[5] in patient_data).
    expectMedicationCoding(entries[5], "395926009", "http://snomed.info/sct");
    // Test that RxNorm code 583218 gets mapped to SNOMED 426653008 (located in entry[6] in patient_data).
    expectMedicationCoding(entries[6], "426653008", "http://snomed.info/sct");
    // Test that RxNorm code 583214 gets mapped to SNOMED 426653008 (located in entry[7] in patient_data).
    expectMedicationCoding(entries[7], "426653008", "http://snomed.info/sct");
    // Test that Staging summary SNOMED code 261638004 gets mapped to SNOMED 73082003 (located in entry[8], stage[0] in patient_data)
    actualStage = getStage(entries[8]);
    if (actualStage) {
      expectCoding(actualStage.summary?.coding, "73082003", "http://snomed.info/sct");
    }
    // Test that Staging type SNOMED code 258228008 gets mapped to SNOMED 2640006 (located in entry[9], stage[1] in patient_data)
    actualStage = getStage(entries[9], 1);
    if (actualStage) {
      expectCoding(actualStage.type?.coding, "2640006", "http://snomed.info/sct");
    }
  });
});
