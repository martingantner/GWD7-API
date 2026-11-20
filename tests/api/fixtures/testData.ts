// mev: maybe not needed - select random User
import { test as base } from '@playwright/test';
import { readFileSync } from 'fs';

const users = JSON.parse(readFileSync('test-data/users.json', 'utf-8'));

export const test = base.extend<{
  randomUser: any;
}>({
  randomUser: async ({}: any, use: (arg0: any) => any) => {
    const user = users[Math.floor(Math.random() * users.length)];
    await use(user);
  }
});

export const expect = test.expect;
