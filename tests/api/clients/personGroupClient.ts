import { APIRequestContext } from '@playwright/test';

export class PersonClient {
  constructor(private api: APIRequestContext) {}

  async createPerson(data: any) {
    const responsePerson = await this.api.post('/api/v1/Person', { data });
    return await responsePerson.json();
  }
}
