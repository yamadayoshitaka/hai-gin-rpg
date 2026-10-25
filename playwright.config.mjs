import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './qa',
  testMatch: 'battle-visual.spec.mjs',
  timeout: 90000,
  expect: {timeout: 12000},
  retries: 1,
  reporter: [['list'], ['html',{open:'never'}]],
  use: {
    ...devices['Pixel 7'],
    browserName:'chromium',
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    video:'on',
    screenshot:'on'
  },
  webServer: {
    command:'python3 -m http.server 4173 --bind 127.0.0.1',
    url:'http://127.0.0.1:4173/',
    reuseExistingServer:!process.env.CI,
    timeout:15000
  },
  outputDir:'test-results'
});
