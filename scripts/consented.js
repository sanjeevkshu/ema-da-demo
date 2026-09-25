// add functionality that requires user consent here (analytics, martech, etc.)

// Adobe Brand Concierge: a no-op until its IDs are set (scripts/brand-concierge.js)
import('./brand-concierge.js').then(({ default: initConcierge }) => initConcierge());
