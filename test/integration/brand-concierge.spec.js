/*
 * Brand Concierge + Web SDK / AEP (scripts/brand-concierge.js).
 * Deterministic checks gate PRs into main. @golden checks the answers against
 * the site's facts; report-only until the deployed concierge is grounded.
 */
import { test, expect } from '@playwright/test';
import { ask, openChat } from './helpers.js';

test('Web SDK connects and the chat renders under the site CSP', async ({ page }) => {
  const violations = [];
  await page.exposeFunction('reportCsp', (v) => violations.push(v));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => window.reportCsp(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto('/pulse-loop?consent=accept');
  const interact = page.waitForResponse((r) => r.url().includes('/ee/v1/interact'));
  const box = await openChat(page);
  expect((await interact).status(), 'Edge Network accepts the org and datastream').toBe(200);
  await expect(box, 'PULSE styling config is applied').toHaveAttribute('placeholder', 'Ask PULSE anything');
  expect(violations).toEqual([]);
});

test('a message gets an answer, not a BRANDCON error', async ({ page }) => {
  await page.goto('/pulse-loop?consent=accept');
  await openChat(page);
  const { status, reply } = await ask(page, 'What is PULSE?');
  expect(status, 'conversations endpoint (400 = datastream not enabled for Brand Concierge)').toBe(200);
  expect(reply).not.toMatch(/something went wrong/i);
});

test('close button and Escape close the panel and return focus', async ({ page }) => {
  await page.goto('/pulse-loop?consent=accept');
  await openChat(page);
  await page.getByRole('button', { name: 'Close chat' }).click();
  await expect(page.locator('#concierge-panel')).not.toHaveAttribute('open', '');
  await expect(page.getByRole('button', { name: 'Ask PULSE' })).toBeFocused();
  await page.getByRole('button', { name: 'Ask PULSE' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#concierge-panel')).not.toHaveAttribute('open', '');
});

test.describe('@golden grounded answers', () => {
  const GOLDEN = [
    ['How long does the PULSE Loop battery last?', /7[-\s]day/i],
    ['What does PULSE Band Neo cost?', /\$129\b/],
    ['Is shipping free?', /\$100/],
  ];
  for (const [question, fact] of GOLDEN) {
    test(`${question} → ${fact}`, async ({ page }) => {
      await page.goto('/pulse-loop?consent=accept');
      await openChat(page);
      const { reply } = await ask(page, question);
      expect(reply).toMatch(fact);
    });
  }
});
