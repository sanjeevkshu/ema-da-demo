/*
 * @responsive — layout hygiene on every page type at the Figma widths.
 * Deterministic, so it can block from day one:
 *   - nothing scrolls sideways
 *   - no clipped text in headings, buttons, labels or form controls
 *   - tap targets at least 24x24 px (WCAG 2.2 AA, 2.5.8; links inside text are exempt)
 *   - images keep their aspect ratio (no stretching)
 *   - exactly one <h1> per page (checked once, at desktop width)
 */
import { test, expect } from '@playwright/test';
import {
  PAGE_TYPES, WIDTHS, loadPage, describeEl,
} from './helpers.js';

for (const type of PAGE_TYPES) {
  for (const width of WIDTHS) {
    test(`@responsive ${type.name} (${type.path}) at ${width}px`, async ({ page }) => {
      await loadPage(page, type.path, width);
      const report = await page.evaluate((describe) => {
        // eslint-disable-next-line no-new-func
        const name = new Function(`return ${describe}`)();
        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
            && !el.closest('[aria-hidden="true"], [hidden], dialog:not([open])');
        };
        const vw = document.documentElement.clientWidth;
        const scope = [...document.querySelectorAll('header, main, footer')];
        const all = scope.flatMap((s) => [...s.querySelectorAll('*')]);

        // 1. sideways scroll, and the widest offenders
        const overflow = document.documentElement.scrollWidth - vw;
        const wide = overflow > 1
          ? all.filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1)
            .filter((el) => !el.closest('.carousel, [class*="slides"], [class*="track"]'))
            .slice(0, 5).map(name)
          : [];

        // 2. clipped text
        const clipped = all
          .filter((el) => el.matches('h1, h2, h3, h4, h5, h6, button, label, a.button, select, summary') && visible(el))
          .filter((el) => {
            const cs = getComputedStyle(el);
            if (el.tagName === 'SELECT') return el.scrollWidth > el.clientWidth + 2;
            const clips = /hidden|clip/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
            return clips && el.scrollWidth > el.clientWidth + 1;
          })
          .map(name);

        // 3. tap targets under 24x24. WCAG 2.5.8 exceptions: links inside running
        // text, and undersized targets whose 24px circle touches no other target
        const targets = all
          .filter((el) => el.matches('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"]') && visible(el))
          .map((el) => ({ el, r: el.getBoundingClientRect() }));
        const under = (t) => t.r.width < 24 || t.r.height < 24;
        const centre = (t) => [t.r.left + t.r.width / 2, t.r.top + t.r.height / 2];
        const distToRect = ([x, y], r) => Math.hypot(
          Math.max(r.left - x, 0, x - r.right),
          Math.max(r.top - y, 0, y - r.bottom),
        );
        const spaced = (t) => targets.every((o) => {
          if (o === t || o.el.contains(t.el) || t.el.contains(o.el)) return true;
          const c = centre(t);
          if (under(o)) return Math.hypot(c[0] - centre(o)[0], c[1] - centre(o)[1]) >= 24;
          return distToRect(c, o.r) >= 12;
        });
        const small = targets
          .filter((t) => under(t))
          .filter((t) => {
            const p = t.el.parentElement;
            const inline = t.el.tagName === 'A' && p && p.matches('p, li, td, span')
              && p.textContent.trim().length > t.el.textContent.trim().length + 3;
            return !inline && !spaced(t);
          })
          .map(({ el }) => {
            const r = el.getBoundingClientRect();
            return `${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`;
          });

        // 4. stretched images (object-fit: fill with a changed aspect ratio)
        const stretched = [...document.querySelectorAll('main img, header img, footer img')]
          .filter((img) => visible(img) && img.naturalWidth && getComputedStyle(img).objectFit === 'fill')
          .filter((img) => {
            const r = img.getBoundingClientRect();
            const drawn = r.width / r.height;
            const natural = img.naturalWidth / img.naturalHeight;
            return Math.abs(drawn - natural) / natural > 0.03;
          })
          .map(name);

        // 5. one <h1> per page (screen-reader navigation and SEO)
        const h1s = document.querySelectorAll('main h1').length;

        return {
          overflow, wide, clipped, small, stretched, h1s,
        };
      }, describeEl);

      expect.soft(report.overflow, `page scrolls sideways by ${report.overflow}px: ${report.wide.join('; ')}`).toBeLessThanOrEqual(1);
      expect.soft(report.clipped, 'clipped text').toEqual([]);
      expect.soft(report.small, 'tap targets under 24x24px').toEqual([]);
      expect.soft(report.stretched, 'stretched images').toEqual([]);
      if (width === WIDTHS[WIDTHS.length - 1]) expect.soft(report.h1s, 'h1 headings on the page').toBe(1);
    });
  }
}
