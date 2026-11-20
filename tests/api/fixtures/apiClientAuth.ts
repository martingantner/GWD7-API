import { test as base } from '@playwright/test';
import { readFileSync } from 'fs';

const { token } = JSON.parse(readFileSync('test-data/auth.json', 'utf-8'));

export const test = base.extend<{
  api: any;
}>({
  api: async ({ request }: any, use: (arg0: any) => any) => {
    const api = await request.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    await use(api);
  }
});

export const expect = test.expect;
