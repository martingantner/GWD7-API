import { APIRequestContext } from '@playwright/test';

export class AuthClient {
  constructor(private api: APIRequestContext) {}

  async login(username: string, password: string, pin = '') {
    const response = await this.api.post('/api/v1/Authorization', {
      data: { userName: username, password, twoFactorPin: pin }
    });

    const json = await response.json();
    console.log('Auth JSON:', json);
    await new Promise(resolve => setTimeout(resolve, 1000)); 
    if (!json.accessToken) { 
        throw new Error('Authentication failed: accessToken missing. Response was: ' + JSON.stringify(json)); 
    }

  // Response 
  //console.log('⬅ RESPONSE'); 
  //console.log('Status:', response.status()); 
  //console.log('Headers:', response.headers()); 
  //console.log('Body:', await response.json());

    return json.accessToken;
  }
}