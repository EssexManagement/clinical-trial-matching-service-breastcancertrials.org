import { Study } from "@EssexManagement/clinical-trial-matching-service";
import { Bundle, FhirResource } from "fhir/r4";
import { ProtocolSection, Status, StudyType } from "@EssexManagement/clinical-trial-matching-service/dist/ctg-api";
import { TrialResponse } from "../../src/breastcancertrials";

/**
 * Create a patient bundle
 */
export function createBundle(resources?: FhirResource[]): Bundle<FhirResource> {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: resources ? resources.map(r => ({ resource: r })) : []
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
    overallStatus?: Status;
    studyType?: StudyType;
    briefSummary?: string;
  } = {}
): Study {
  const id = options.id ?? "NCT12345678",
    source = options.source ?? "http://www.example.com/source",
    briefTitle = options.briefTitle ?? "Title",
    sponsorAgency = options.sponsorAgency ?? "Example Agency",
    overallStatus = options.overallStatus ?? Status.RECRUITING,
    studyType = options.studyType ?? StudyType.OBSERVATIONAL,
    briefSummary = options.briefTitle;
  const protocolSection: ProtocolSection = {
    identificationModule: {
      nctId: id,
      briefTitle: briefTitle,
      organization: {
        fullName: source
      }
    },
    designModule: {
      studyType: studyType
    },
    statusModule: {
      overallStatus: overallStatus,
    },
    descriptionModule: {
      briefSummary: briefSummary,
    },
    sponsorCollaboratorsModule: {
      leadSponsor: {
        name: sponsorAgency,
      },
    }
  };
  const result: Study = {
    protocolSection: protocolSection
  };
  if (briefSummary) {
    protocolSection.descriptionModule = {
      briefSummary: briefSummary
    };
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
