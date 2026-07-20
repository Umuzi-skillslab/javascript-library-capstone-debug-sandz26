/**
 * Pure helpers and validation utilities for the library system.
 * Module 2 of 3+ — no DOM or mutable catalogue side effects.
 */

/**
 * Pure function: calculate a late fine with type and NaN guards.
 * @param {number} daysLate
 * @param {number} [rate=0.5]
 * @returns {number} Fine rounded to 2 decimal places
 */
export function calculateFineAmount(daysLate, rate = 0.5) {
  if (daysLate === null || daysLate === undefined) {
    return 0;
  }
  if (typeof daysLate !== 'number' || Number.isNaN(daysLate)) {
    return 0;
  }
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return 0;
  }
  if (daysLate < 0) {
    return 0;
  }

  const fine = daysLate * rate;
  return Number(fine.toFixed(2));
}

/**
 * Pure function: format book details with template literals and string methods.
 * @param {{ title: string, author: string, year: number }} book
 */
export function formatBookInfo(book) {
  if (!book || typeof book !== 'object') {
    return '';
  }

  const title = String(book.title ?? '').trim();
  const author = String(book.author ?? '').trim();
  const year = book.year;

  return `Title: ${title.toUpperCase()}\nAuthor: ${author}\nYear: ${year}`;
}

/**
 * Pure function: merge unique ISBN lists using rest + spread.
 * @param {...string[]} isbnLists
 * @returns {string[]}
 */
export function mergeUniqueIsbns(...isbnLists) {
  const merged = isbnLists.flatMap((list) => (Array.isArray(list) ? list : []));
  return [...new Set(merged)];
}

/** Type guard for non-empty strings. */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Accept string or number identifiers. */
export function isValidId(value) {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Array destructuring helper: first / rest titles.
 * @param {string[]} titles
 */
export function splitFirstTitle(titles) {
  if (!Array.isArray(titles) || titles.length === 0) {
    return { first: null, rest: [] };
  }
  const [first, ...rest] = titles;
  return { first, rest };
}

/**
 * Object parameter destructuring for display labels.
 * @param {{ label: string, value: * }} param0
 */
export function formatStatLabel({ label, value }) {
  return `${label}: ${value}`;
}

/**
 * Human-readable membership tenure for UI display.
 * @param {number} days
 * @returns {string}
 */
export function formatMembershipTenure(days) {
  if (typeof days !== 'number' || Number.isNaN(days) || days < 0) {
    return 'Unknown';
  }
  if (days === 0) {
    return 'Joined today';
  }
  if (days === 1) {
    return '1 day';
  }
  if (days < 30) {
    return `${days} days`;
  }
  if (days < 60) {
    return 'About 1 month';
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `About ${months} months`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? 'About 1 year' : `About ${years} years`;
}
