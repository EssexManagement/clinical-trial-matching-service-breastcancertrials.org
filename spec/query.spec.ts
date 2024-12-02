import { ClinicalTrialsGovService, ClinicalTrialMatcher } from "clinical-trial-matching-service";
import { APIError, createClinicalTrialLookup, performCodeMapping, sendQuery } from "../src/query";
import nock from "nock";
import { Bundle, BundleEntry, CodeableConcept } from "fhir/r4";
import { importRxnormSnomedMapping, importStageSnomedMapping, importStageAjccMapping } from "../src/breastcancertrials";
import { createExampleTrialResponse, createBundle } from "./support/factory";

describe(".createClinicalTrialLookup", () => {
  it("raises an error if missing an endpoint", () => {
    const backupService = new ClinicalTrialsGovService("temp");
    expect(() => {
      createClinicalTrialLookup({}, backupService);
    }).toThrowError("Missing endpoint in configuration");
  });

  it("does not require a backup service to start", () => {
    // Basically, expect to get something with null
    expect(() => {
      expect(createClinicalTrialLookup({ endpoint: "https://www.example.com/" })).toBeDefined();
    }).not.toThrowError();
  });

  it("creates a function", () => {
    expect(
      typeof createClinicalTrialLookup({ endpoint: "https://www.example.com/" }, new ClinicalTrialsGovService("temp"))
    ).toEqual("function");
  });

  describe("generated matcher function", () => {
    const endpoint = "https://www.example.com/endpoint";
    let matcher: ClinicalTrialMatcher;
    let backupService: ClinicalTrialsGovService;
    let scope: nock.Scope;
    let interceptor: nock.Interceptor;
    beforeEach(() => {
      // Note: backupService is never initialized therefore it won't actually work
      backupService = new ClinicalTrialsGovService("temp");
      // Don't actually download anything
      spyOn(backupService, "updateResearchStudies").and.callFake((studies) => {
        return Promise.resolve(studies);
      });
      matcher = createClinicalTrialLookup({ endpoint: endpoint }, backupService);
      scope = nock("https://www.example.com");
      interceptor = scope.post("/endpoint");
    });
    afterEach(() => {
      expect(scope.isDone()).toBeTrue();
    });

    it("runs queries", () => {
      // Reply with an empty array
      interceptor.reply(200, []);
      return expectAsync(
        matcher(createBundle(), {}).then((result) => {
          expect(result.type).toEqual("searchset");
          // Rather than deal with casting just do this
          expect(result["total"]).toEqual(0);
          expect(scope.isDone()).toBeTrue();
        })
      ).toBeResolved();
    });

    it("fills in missing data", () => {
      interceptor.reply(200, [createExampleTrialResponse()]);
      return expectAsync(
        matcher(createBundle(), {}).then((result) => {
          const study = result.entry?.[0].resource;
          if (typeof study === 'object' && study?.resourceType === 'ResearchStudy') {
            expect(study.title).toEqual("Title");
          } else {
            fail("Expected research study");
          }
        })
      ).toBeResolved();
    });
  });
});

describe("performCodeMapping()", () => {
  beforeAll(() => {
    // Load all of the mappings "at once"
    return Promise.all([importRxnormSnomedMapping(), importStageSnomedMapping(), importStageAjccMapping()]);
  });

  it("ignores invalid entries", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: []
    };
    // This involves lying to TypeScript as it ensures we only add valid objects
    bundle.entry?.push({ foo: "bar" } as unknown as BundleEntry);
    // This entry is valid but is missing the medicationCodeableConcept that
    // the mapping is actually looking for
    bundle.entry?.push({
      resource: {
        resourceType: "MedicationStatement",
        status: "active",
        subject: {},
        medicationCodeableConcept: {
          coding: [
            {
              system: "http://example.com/",
              code: "unknown"
            }
          ]
        }
      }
    });
    performCodeMapping(bundle);
    // This test succeeds if it doesn't blow up
  });

  it("maps properly", () => {
    const bundle = createBundle([
      {
        resourceType: "MedicationStatement",
        status: "active",
        subject: {},
        medicationCodeableConcept: {
          text: "Example",
          coding: [
            {
              system: "http://cancerstaging.org",
              code: "4"
            }
          ]
        }
      },
      {
        resourceType: "Condition",
        subject: {},
        code: {
          coding: []
        },
        stage: [
          {
            summary: {
              coding: [
                {
                  system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                  code: "583218"
                },
                {
                  system: undefined,
                  code: "CCC"
                }
              ]
            },
            type: {
              coding: [
                {
                  system: "unused",
                  code: "XXX"
                }
              ]
            }
          }
        ]
      }
    ]);
    const result = performCodeMapping(bundle);
    expect(result.entry?.length).toEqual(2);
    let resource = result.entry?.[0].resource;
    expect(resource).toBeDefined();
    expect(resource?.resourceType).toEqual("MedicationStatement");
    const concept = resource?.["medicationCodeableConcept"] as CodeableConcept;
    expect(concept).toBeDefined();
    expect(concept?.text).toEqual("Example");
    expect(concept?.coding).toEqual([{ system: "http://snomed.info/sct", code: "2640006" }]);
    resource = result.entry?.[1].resource;
    expect(resource).toBeDefined();
    // At present, the condition resource should be unchanged
    expect(resource?.["stage"]).toEqual([
      {
        summary: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "426653008"
            },
            {
              system: undefined,
              code: "CCC"
            }
          ]
        },
        type: {
          coding: [
            {
              system: "unused",
              code: "XXX"
            }
          ]
        }
      }
    ]);
  });
});

it("handles a missing codeableconcept or coding", () => {
  const bundle = createBundle([
    {
      resourceType: "MedicationStatement",
      status: "active",
      subject: {}
    },
    {
      resourceType: "MedicationStatement",
      status: "active",
      subject: {},
      medicationCodeableConcept: {
        text: "Example"
      }
    }
  ]);
  const result = performCodeMapping(bundle);
  expect(result.entry?.length).toEqual(2);

  let resource = result.entry?.[0].resource;
  expect(resource).toBeDefined();
  expect(resource?.resourceType).toEqual("MedicationStatement");
  let concept = resource?.["medicationCodeableConcept"] as CodeableConcept;
  expect(concept).toBeUndefined();

  resource = result.entry?.[1].resource;
  expect(resource).toBeDefined();
  expect(resource?.resourceType).toEqual("MedicationStatement");
  concept = resource?.["medicationCodeableConcept"] as CodeableConcept;
  expect(concept).toBeDefined();
  expect(concept.coding).toBeUndefined();
});

describe(".sendQuery", () => {
  let scope: nock.Scope;
  let interceptor: nock.Interceptor;
  const endpoint = "https://www.example.com/endpoint";
  beforeEach(() => {
    scope = nock("https://www.example.com");
    interceptor = scope.post("/endpoint");
  });
  afterEach(() => {
    expect(scope.isDone()).toBeTrue();
  });

  it("sets the content-type header", () => {
    interceptor.matchHeader("Content-type", "application/fhir+json").reply(200, []);
    return expectAsync(
      sendQuery(endpoint, "ignored").then(() => {
        expect(scope.isDone()).toBeTrue();
      })
    ).toBeResolved();
  });

  it("returns trial responses from the server", () => {
    const exampleTrial = createExampleTrialResponse();
    interceptor.reply(200, [exampleTrial]);
    return expectAsync(
      sendQuery(endpoint, "ignored").then((result) => {
        expect(result).toEqual([exampleTrial]);
      })
    ).toBeResolved();
  });

  it("rejects the Promise if the response isn't JSON", () => {
    interceptor.reply(200, "Not JSON");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(APIError);
  });

  it("rejects the Promise if the response isn't the expected JSON", () => {
    interceptor.reply(200, "null");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(APIError);
  });

  it("rejects the Promise if server returns an error response", () => {
    interceptor.reply(500, "This is an error.");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError(APIError);
  });

  it("rejects the Promise if the connection fails", () => {
    interceptor.replyWithError("Oops");
    return expectAsync(sendQuery(endpoint, "ignored")).toBeRejectedWithError("Oops");
  });
});
