/* Shared hosts and page helpers for the integration specs. */
import { expect } from '@playwright/test';

export const PROD_URL = process.env.INTEGRATION_PROD_URL || 'https://pulse-portal-ivory.vercel.app';
export const LIVE_URL = process.env.INTEGRATION_LIVE_URL || 'https://main--ema-da-demo--sanjeevkshu.aem.live';

const ADOBE = /adoberesources\.net|experience\.adobe\.net|adobedc\.net/;

/** Records every request to Adobe's Web SDK, Web Client or Edge Network. */
export function trackAdobe(page) {
  const requests = [];
  page.on('request', (req) => { if (ADOBE.test(req.url())) requests.push(req.url()); });
  return requests;
}

/** Opens the Ask PULSE chat and waits for its message box. */
export async function openChat(page) {
  await page.getByRole('button', { name: 'Ask PULSE' }).click();
  const box = page.getByRole('textbox', { name: 'Type your message' });
  await expect(box).toBeVisible({ timeout: 30000 });
  return box;
}

/** Sends a message and returns the concierge's reply text once it settles. */
export async function ask(page, question) {
  const box = page.getByRole('textbox', { name: 'Type your message' });
  const replies = page.locator('#brand-concierge-mount').getByText('Brand Concierge says');
  const before = await replies.count();
  const conversation = page.waitForResponse((r) => r.url().includes('/brand-concierge/'), { timeout: 45000 });
  await box.fill(question);
  await box.press('Enter');
  const response = await conversation;
  await expect(replies).toHaveCount(before + 1, { timeout: 45000 });
  const mount = page.locator('#brand-concierge-mount');
  let text = '';
  // the reply streams in; wait until it stops changing
  await expect.poll(async () => {
    const next = await mount.innerText();
    const stable = next === text && !/Thinking…|Loading/.test(next);
    text = next;
    return stable;
  }, { timeout: 45000, intervals: [1500] }).toBe(true);
  const at = text.lastIndexOf('Brand Concierge says');
  return { status: response.status(), reply: text.slice(at).replace(/\s+/g, ' ') };
}
