import { ClinicalStudy, fhir } from "clinical-trial-matching-service";
import { StatusEnum, StudyTypeEnum } from "clinical-trial-matching-service/dist/clinicalstudy";
import { TrialResponse } from "../../src/breastcancertrials";

/**
 * Create an empty patient bundle
 */
export function createEmptyBundle(): fhir.Bundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: []
  };
}

/**
 * Creates the minimum set of items needed for a clinical study. Options can be
 * set to override defaults otherwise used for required fields.
 */
export function createEmptyClinicalStudy(
  options: {
    id?: string;
    source?: string;
    briefTitle?: string;
    sponsorAgency?: string;
    overallStatus?: StatusEnum;
    studyType?: StudyTypeEnum;
    briefSummary?: string;
  } = {}
): ClinicalStudy {
  const id = options.id ?? "NCT12345678",
    source = options.source ?? "http://www.example.com/source",
    briefTitle = options.briefTitle ?? "Title",
    sponsorAgency = options.sponsorAgency ?? "Example Agency",
    overallStatus = options.overallStatus ?? "Recruiting",
    studyType = options.studyType ?? "Observational",
    briefSummary = options.briefTitle;
  const result: ClinicalStudy = {
    required_header: [
      {
        download_date: [""],
        link_text: [""],
        url: [""]
      }
    ],
    id_info: [
      {
        nct_id: [id]
      }
    ],
    brief_title: [briefTitle],
    sponsors: [
      {
        lead_sponsor: [
          {
            agency: [sponsorAgency]
          }
        ]
      }
    ],
    source: [source],
    overall_status: [overallStatus],
    study_type: [studyType]
  };
  if (briefSummary) {
    result.brief_summary = [{ textblock: [briefSummary] }];
  }
  return result;
}

/**
 * This creates an example trial. (It's shared between test suites.)
 */
export function createExampleTrialResponse(): TrialResponse {
  return {
    resultNumber: "1",
    trialId: "NCT12345678",
    trialTitle: "Title",
    scientificTitle: "Scientific Title",
    phaseNumber: "I-II",
    purpose: "Purpose.",
    whoIsThisFor: "Who is this for?",
    whatIsInvolved: "What is involved?",
    whatIsBeingStudied: "What is being studied?",
    learnMore: "Learn more",
    ctGovLink: "https://clinicaltrials.gov/ct2/show/NCT03377387",
    eligibilityCriteriaLink: "https://clinicaltrials.gov/ct2/show/NCT03377387#eligibility",
    trialCategories: ["METASTATIC", "TREATMENT_BIOLOGICAL"],
    trialMutations: [],
    newTrialFlag: false,
    zip: "01780",
    distance: "3",
    siteName: "Example",
    city: "Bedford",
    state: "MA",
    visits: "Monthly visits, ongoing",
    latitude: 42,
    longitude: -75,
    contactName: "Contact",
    contactPhone: "781-555-0100",
    contactEmail: null,
    noVisitsRequiredFlag: false,
    numberOfSites: "1"
  };
}
