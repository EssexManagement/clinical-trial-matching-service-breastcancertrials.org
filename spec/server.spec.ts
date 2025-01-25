import request from 'supertest';
import start, { BreastCancerTrialsService } from '../src/server';
import http from 'http';
import { SearchSet } from '@EssexManagement/clinical-trial-matching-service';

describe('BreastCancerTrialsService', () => {
  describe('when listening', () => {
    let service: BreastCancerTrialsService;
    let server: http.Server;
    beforeAll(async () => {
      service = new BreastCancerTrialsService({ endpoint: 'http://localhost/', port: 0 });
      await service.init();
      server = await service.listen();
    });
    afterAll(async () => {
      await service.close();
    });

    it('responds to /', () => {
      return request(server).get('/').set('Accept', 'application/json').expect(200);
    });

    it('uses the query runner', async () => {
      const runQuery = spyOn(service, 'matcher').and.callFake(() => {
        return Promise.resolve(new SearchSet([]));
      });
      await request(server)
        .post('/getClinicalTrial')
        .send({ resourceType: 'Bundle', type: 'collection', entry: [] })
        .set('Accept', 'application/json')
        .expect(200);
      expect(runQuery).toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it("raises an error if the endpoint isn't given", () => {
      expect(() => {
        new BreastCancerTrialsService({});
      }).toThrowError('Missing endpoint in configuration');
    });
  });
});

describe('start()', () => {
  const testedValues = ['NODE_ENV', 'MATCHING_SERVICE_ENDPOINT'];
  const initialEnv: Record<string, string | undefined> = {};
  beforeAll(() => {
    // Store the environment variables we're going to clobber in these tests
    for (const key of testedValues) {
      if (key in process.env) initialEnv[key] = process.env[key];
    }
  });
  afterAll(() => {
    // Restore the environment variables we clobbered
    for (const key of testedValues) {
      if (key in initialEnv) {
        process.env[key] = initialEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });
  it('loads configuration via dotenv-flow', () => {
    process.env.NODE_ENV = 'test';
    process.env.MATCHING_SERVICE_ENDPOINT = 'https://www.example.com/test/endpoint';
    process.env.MATCHING_SERVICE_PORT = '3005';
    process.env.CTGOV_CACHE_FILE = ':memory:';
    return expectAsync(
      start().then((service) => {
        expect(service.port).toEqual(3005);
        // TODO: Figure out a way to see what the API endpoint got set to
      })
    ).toBeResolved();
  });
});
