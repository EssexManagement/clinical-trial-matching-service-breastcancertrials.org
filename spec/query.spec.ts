import {
  ClinicalTrialGovService,
  ClinicalTrialMatcher,
  fhir,
} from "clinical-trial-matching-service";
import {
  APIError,
  createClinicalTrialLookup,
  performCodeMapping,
  sendQuery,
} from "../src/query";
import nock from "nock";
import { Coding, TrialResponse } from "../src/breastcancertrials";
import { isResearchStudy } from "clinical-trial-matching-service/dist/fhir-types";

/**
 * This creates an example trial. (It's shared between test suites.)
 */
function createExampleTrial(): TrialResponse {
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
    eligibilityCriteriaLink:
      "https://clinicaltrials.gov/ct2/show/NCT03377387#eligibility",
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
    numberOfSites: "1",
  };
}

/**
 * Create an empty patient bundle
 */
function createEmptyBundle(): fhir.Bundle {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [],
  };
}

describe(".createClinicalTrialLookup", () => {
  it("raises an error if missing an endpoint", () => {
    const backupService = new ClinicalTrialGovService("temp");
    expect(() => {
      createClinicalTrialLookup({}, backupService);
    }).toThrowError("Missing API_ENDPOINT in configuration");
  });

  it("creates a function", () => {
    expect(
      typeof createClinicalTrialLookup(
        { api_endpoint: "http://www.example.com/" },
        new ClinicalTrialGovService("temp")
      )
    ).toEqual("function");
  });

  describe("generated matcher function", () => {
    const endpoint = "http://www.example.com/endpoint";
    let matcher: ClinicalTrialMatcher;
    let backupService: ClinicalTrialGovService;
    let scope: nock.Scope;
    let interceptor: nock.Interceptor;
    beforeEach(() => {
      // Note: backupService is never initialized therefore it won't actually work
      backupService = new ClinicalTrialGovService("temp");
      // Don't actually download anything
      spyOn(backupService, "downloadTrials").and.callFake(() => {
        return Promise.resolve();
      });
      spyOn(backupService, "getDownloadedTrial").and.callFake(() => {
        return Promise.resolve({
          required_header: [
            {
              download_date: [""],
              link_text: [""],
              url: [""],
            },
          ],
          id_info: [
            {
              nct_id: ["NCT12345678"],
            },
          ],
          brief_title: ["title"],
          sponsors: [
            {
              lead_sponsor: [
                {
                  agency: ["Example Agency"],
                },
              ],
            },
          ],
          source: ["http://www.example.com/source"],
          overall_status: ["Recruiting"],
          study_type: ["Observational"],
        });
      });
      matcher = createClinicalTrialLookup(
        { api_endpoint: endpoint },
        backupService
      );
      scope = nock("http://www.example.com");
      interceptor = scope.post("/endpoint");
    });
    afterEach(() => {
      expect(scope.isDone()).toBeTrue();
    });

    it("runs queries", () => {
      // Reply with an empty array
      interceptor.reply(200, []);
      return expectAsync(
        matcher(createEmptyBundle()).then((result) => {
          expect(result.type).toEqual("searchset");
          // Rather than deal with casting just do this
          expect(result["total"]).toEqual(0);
          expect(scope.isDone()).toBeTrue();
        })
      ).toBeResolved();
    });

    it("fills in missing data", () => {
      interceptor.reply(200, [createExampleTrial()]);
      return expectAsync(
        matcher(createEmptyBundle()).then((result) => {
          const study = result.entry[0].resource;
          if (isResearchStudy(study)) {
            expect(study.title).toEqual('Title');
          } else {
            fail('Expected research study');
          }
        })
      ).toBeResolved();
    });
  });
});

describe(".performCodeMapping", () => {
  let mappings: Map<string, string>;
  beforeEach(() => {
    // Rather than load the "real" mappings just do some fake ones for the test
    mappings = new Map<string, string>([
      ["AAA", "111"],
      ["BBB", "222"],
    ]);
  });

  it("ignores invalid entries", () => {
    const bundle: fhir.Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [],
    };
    // This involves lying to TypeScript as it ensures we only add valid objects
    bundle.entry.push(({ foo: "bar" } as unknown) as fhir.BundleEntry);
    performCodeMapping(bundle, "MedicationStatement", mappings);
    // This test succeeds if it doesn't blow up
  });

  it("maps properly", () => {
    const bundle: fhir.Bundle = createEmptyBundle();
    bundle.entry.push({
      resource: {
        resourceType: "MedicationStatement",
        code: {
          coding: [
            {
              system: "",
              code: "AAA",
            },
          ],
        },
      },
    });
    bundle.entry.push({
      resource: {
        resourceType: "Condition",
        code: {
          coding: [],
        },
        stage: [{
          summary: {
            coding: [
              {
                system: "unused",
                code: "BBB",
              },
              {
                system: "unused",
                code: "CCC",
              },
            ],
          },
          type: {
            coding: [
              {
                system: "unused",
                code: "XXX",
              },
            ],
          },
        }],
      },
    } as fhir.BundleEntry);
    const medicationCodableConcept: Coding = {
      coding: [
        {
          code: "AAA",
        },
      ],
      text: "Example",
    };
    bundle.entry[0].resource[
      "medicationCodeableConcept"
    ] = medicationCodableConcept;
    let result = performCodeMapping(bundle, "MedicationStatement", mappings);
    expect(result.entry.length).toEqual(2);
    let resource: fhir.Resource = result.entry[0].resource;
    expect(resource).toBeDefined();
    expect(resource.resourceType).toEqual("MedicationStatement");
    const concept = resource["medicationCodeableConcept"] as Coding;
    expect(concept).toBeDefined();
    expect(concept.text).toEqual("Example");
    expect(concept.coding).toEqual([
      { system: "http://snomed.info/sct", code: "111" },
    ]);
    resource = result.entry[1].resource;
    expect(resource).toBeDefined();
    // At present, the condition resource should be unchanged
    expect(resource['stage']).toEqual([{
      summary: {
        coding: [
          {
            system: "unused",
            code: "BBB",
          },
          {
            system: "unused",
            code: "CCC",
          },
        ],
      },
      type: {
        coding: [
          {
            system: "unused",
            code: "XXX",
          },
        ],
      },
    }]);
    // Repeat for conditions
    result = performCodeMapping(bundle, "Condition", mappings);
    resource = result.entry[1].resource;
    expect(resource.resourceType).toEqual('Condition');
    expect(resource['stage']).toEqual([{
      summary: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "222",
          },
          {
            system: "unused",
            code: "CCC",
          },
        ],
      },
      type: {
        coding: [
          {
            system: "unused",
            code: "XXX",
          },
        ],
      }
    }]);
  });
});

describe(".sendQuery", () => {
  let scope: nock.Scope;
  let interceptor: nock.Interceptor;
  const endpoint = "http://www.example.com/endpoint";
  beforeEach(() => {
    scope = nock("http://www.example.com");
    interceptor = scope.post("/endpoint");
  });
  afterEach(() => {
    expect(scope.isDone()).toBeTrue();
  });

  it("sets the content-type header", () => {
    interceptor
      .matchHeader("Content-type", "application/fhir+json")
      .reply(200, []);
    return expectAsync(
      sendQuery(endpoint, "ignored").then(() => {
        expect(scope.isDone()).toBeTrue();
      })
    ).toBeResolved();
  });

  it("returns trial responses from the server", () => {
    const exampleTrial = createExampleTrial();
    interceptor.reply(200, [exampleTrial]);
    return expectAsync(
      sendQuery(endpoint, "ignored").then((result) => {
        expect(result).toEqual([exampleTrial]);
      })
    ).toBeResolved();
  });

  it("rejects the Promise if the response isn't JSON", () => {
    interceptor.reply(200, "Not JSON");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(
      APIError
    );
  });

  it("rejects the Promise if the response isn't the expected JSON", () => {
    interceptor.reply(200, "null");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(
      APIError
    );
  });

  it("rejects the Promise if server returns an error response", () => {
    interceptor.reply(500, "This is an error.");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(
      APIError
    );
  });

  it("rejects the Promise if the connection fails", () => {
    interceptor.replyWithError("Oops");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(
      "Oops"
    );
  });
});
