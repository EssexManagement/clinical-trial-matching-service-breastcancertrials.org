import { convertToResearchStudy } from '../src/research-study';
import { TrialResponse } from "../src/breastcancertrials";

import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

import { Fhir } from 'fhir/fhir';
import { ValidatorMessage } from 'fhir/validator';
import { parseStudyJson, createResearchStudyFromClinicalStudy } from 'clinical-trial-matching-service';

function specPath(filePath: string): string {
  return path.join(__dirname, '../../spec', filePath);
}

describe('FHIR Validation', () => {
  const fhir = new Fhir();

  it('converting result to ResearchStudy produces a valid FHIR object', async function () {
    const readFile = util.promisify(fs.readFile);
    const data = await readFile(specPath('data/trial_object.json'), { encoding: 'utf8' });
    const json: TrialResponse = JSON.parse(data) as TrialResponse;
    const clinicalStudyXML = await readFile(specPath('data/NCT03377387.json'), { encoding: 'utf8' });
    const clinicalStudy = parseStudyJson(clinicalStudyXML);
    const study = convertToResearchStudy(json);
    if (clinicalStudy) {
      createResearchStudyFromClinicalStudy(clinicalStudy, study);
    }
    const result = fhir.validate(study);
    if (result.messages && result.messages.length > 0) {
      console.error('Validation has messages:');
      for (const message of result.messages) {
        formatValidationMessage(message);
      }
    }
    expect(result.valid).toBeTrue();
  });
});

/**
 * Helper function to format a validation message from fhir.validate
 */
function formatValidationMessage(message: ValidatorMessage, output: (str: string) => void = console.error): void {
  let m = message.message ? message.message : '(no message from validator)';
  if (message.severity) {
    m = '[' + message.severity.toUpperCase() + '] ' + m;
  }
  if (message.location) {
    m += ' ' + message.location;
  }
  if (message.resourceId) {
    m += ' in ' + message.resourceId;
  }
  output(m);
}
