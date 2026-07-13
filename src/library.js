/**
 * Core library management logic: Book/Member classes, borrowing, search, and stats.
 * Module 1 of 3+ — exports domain models and library operations.
 */

import {
  calculateFineAmount,
  formatBookInfo,
  isNonEmptyString,
  isValidId
} from './utils.js';

/** @type {Book[]} Global catalogue — mutated only via exported helpers */
export let books = [];

/** @type {Member[]} Global member registry */
export let members = [];

export const LATE_FEE_PER_DAY = 0.5;
export const MAX_BOOKS_PER_MEMBER = 5;
export const MAX_BOOKS_PREMIUM = 10;

/** Replace the books array (used by storage load / tests). */
export function setBooks(nextBooks) {
  if (!Array.isArray(nextBooks)) {
    throw new TypeError('setBooks expects an array');
  }
  books = nextBooks.map((item) => (item instanceof Book ? item : reviveBook(item)));
}

/** Replace the members array (used by storage load / tests). */
export function setMembers(nextMembers) {
  if (!Array.isArray(nextMembers)) {
    throw new TypeError('setMembers expects an array');
  }
  members = nextMembers.map((item) => (item instanceof Member ? item : reviveMember(item)));
}

/** Clear library state for tests and resets. */
export function clearLibrary() {
  books = [];
  members = [];
}

/**
 * Rebuild a Book or DigitalBook instance from plain JSON data.
 * @param {object} data
 * @returns {Book}
 */
export function reviveBook(data) {
  if (!data || typeof data !== 'object') {
    throw new TypeError('Invalid book data');
  }

  const isDigital = data.format !== undefined || data.fileSize !== undefined || data.downloads !== undefined;
  let book;
  const year = typeof data.year === 'number' ? data.year : Number(data.year) || 0;
  const category = data.category ?? 'fiction';

  if (isDigital) {
    book = new DigitalBook(
      String(data.isbn ?? 'unknown'),
      String(data.title ?? 'Untitled'),
      String(data.author ?? 'Unknown'),
      year,
      data.fileSize ?? 0,
      data.format ?? 'epub',
      category
    );
    book.downloads = data.downloads ?? 0;
  } else {
    const copies = data.totalCopies ?? data.availableCopies ?? 1;
    book = new Book(
      String(data.isbn ?? 'unknown'),
      String(data.title ?? 'Untitled'),
      String(data.author ?? 'Unknown'),
      year,
      typeof copies === 'number' ? copies : 1,
      category
    );
    if (typeof data.availableCopies === 'number') {
      book.availableCopies = data.availableCopies;
    }
  }

  book.checkedOut = Array.isArray(data.checkedOut) ? data.checkedOut : [];
  return book;
}

/**
 * Rebuild a Member or PremiumMember instance from plain JSON data.
 * @param {object} data
 * @returns {Member}
 */
export function reviveMember(data) {
  if (!data || typeof data !== 'object') {
    throw new TypeError('Invalid member data');
  }

  const id = data.id ?? 'unknown';
  const name = String(data.name ?? 'Unknown');
  const email = String(data.email ?? '');

  const member = data.membershipType === 'premium'
    ? new PremiumMember(id, name, email)
    : new Member(id, name, email, data.membershipType ?? 'standard');

  member.borrowedBooks = Array.isArray(data.borrowedBooks) ? [...data.borrowedBooks] : [];
  member.overdueBooks = Array.isArray(data.overdueBooks) ? [...data.overdueBooks] : [];
  if (data.joinDate) {
    member.joinDate = new Date(data.joinDate);
  }
  return member;
}

/**
 * Physical book with copy tracking and checkout history.
 */
export class Book {
  constructor(isbn, title, author, year, copies = 1, category = 'fiction') {
    if (typeof isbn !== 'string' || !isbn.trim()) {
      throw new TypeError('isbn must be a non-empty string');
    }
    if (typeof title !== 'string' || !title.trim()) {
      throw new TypeError('title must be a non-empty string');
    }
    if (typeof author !== 'string') {
      throw new TypeError('author must be a string');
    }
    if (typeof year !== 'number' || Number.isNaN(year)) {
      throw new TypeError('year must be a number');
    }
    if (typeof copies !== 'number' || copies < 0) {
      throw new TypeError('copies must be a non-negative number');
    }

    this.isbn = isbn;
    this.title = title;
    this.author = author;
    this.year = year;
    this.category = category;
    this.availableCopies = copies;
    this.totalCopies = copies;
    this.checkedOut = [];
  }

  /** Returns true when at least one physical copy can be borrowed. */
  isAvailable() {
    return this.availableCopies > 0;
  }

  /** Human-readable book summary using template literals. */
  getInfo() {
    return `Title: ${this.title} | Author: ${this.author} | Year: ${this.year} | Available: ${this.availableCopies}/${this.totalCopies}`;
  }

  /**
   * Check out a copy to a member when stock remains.
   * @param {string|number} memberId
   * @returns {boolean}
   */
  checkOut(memberId) {
    if (memberId === null || memberId === undefined) {
      return false;
    }
    if (!this.isAvailable()) {
      return false;
    }

    this.availableCopies -= 1;
    this.checkedOut.push({
      memberId,
      checkoutDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    });
    return true;
  }

  /**
   * Return a borrowed copy for a member.
   * @param {string|number} memberId
   * @returns {boolean}
   */
  returnCopy(memberId) {
    const index = this.checkedOut.findIndex((record) => record.memberId === memberId);
    if (index === -1) {
      return false;
    }
    this.checkedOut.splice(index, 1);
    if (this.availableCopies < this.totalCopies) {
      this.availableCopies += 1;
    }
    return true;
  }
}

/**
 * Digital book — inherits Book and tracks downloads instead of physical stock.
 */
export class DigitalBook extends Book {
  constructor(isbn, title, author, year, fileSize, format, category = 'fiction') {
    // Physical copy counts stay at 1 for stats; availability is always open digitally.
    super(isbn, title, author, year, 1, category);
    this.fileSize = fileSize;
    this.format = format;
    this.downloads = 0;
  }

  /** Digital titles remain borrowable regardless of physical stock fields. */
  isAvailable() {
    return true;
  }

  /**
   * Record a download for a member (digital checkout analogue).
   * @param {string|number} memberId
   * @returns {boolean}
   */
  download(memberId) {
    if (memberId === null || memberId === undefined) {
      return false;
    }
    this.downloads += 1;
    this.checkedOut.push({
      memberId,
      checkoutDate: new Date(),
      digital: true
    });
    return true;
  }

  /** Route physical checkout API to digital download without reducing stock. */
  checkOut(memberId) {
    return this.download(memberId);
  }

  getInfo() {
    return `${super.getInfo()} | Format: ${this.format} | Size: ${this.fileSize}MB | Downloads: ${this.downloads}`;
  }
}

/**
 * Standard library member.
 */
export class Member {
  constructor(id, name, email, membershipType = 'standard') {
    if (!isValidId(id)) {
      throw new TypeError('id must be a string or number');
    }
    if (!isNonEmptyString(name)) {
      throw new TypeError('name must be a non-empty string');
    }

    this.id = id;
    this.name = name;
    this.email = email;
    this.membershipType = membershipType;
    this.borrowedBooks = [];
    this.joinDate = new Date();
    this.overdueBooks = [];
  }

  /** Days since the member joined. */
  getMembershipDuration() {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((Date.now() - this.joinDate.getTime()) / msPerDay);
  }

  /** Member summary using destructuring. */
  getMemberInfo() {
    const { id, name, email, membershipType, borrowedBooks } = this;
    return `Member #${id}: ${name} <${email}> [${membershipType}] — ${borrowedBooks.length} borrowed`;
  }

  canBorrow() {
    return this.borrowedBooks.length < MAX_BOOKS_PER_MEMBER;
  }
}

/**
 * Premium member — higher borrow limit and benefit flag.
 */
export class PremiumMember extends Member {
  constructor(id, name, email) {
    super(id, name, email, 'premium');
    this.priorityHolds = true;
    this.lateFeeDiscount = 0.25;
  }

  canBorrow() {
    return this.borrowedBooks.length < MAX_BOOKS_PREMIUM;
  }
}

/**
 * Find overdue checkout records older than daysOverdue.
 * Uses for-of for nested iteration.
 */
export function findOverdueBooks(daysOverdue = 14) {
  if (typeof daysOverdue !== 'number' || Number.isNaN(daysOverdue)) {
    throw new TypeError('daysOverdue must be a number');
  }

  const overdue = [];
  const cutoffMs = daysOverdue * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const book of books) {
    for (const record of book.checkedOut) {
      if (!record || !record.checkoutDate) {
        continue;
      }
      const elapsed = now - new Date(record.checkoutDate).getTime();
      if (elapsed > cutoffMs) {
        overdue.push({ ...record, isbn: book.isbn, title: book.title });
      }
    }
  }

  return overdue;
}

/**
 * Process a return queue safely (fixed infinite loop via index increment).
 */
export function processReturnQueue(queue) {
  if (!Array.isArray(queue)) {
    throw new TypeError('queue must be an array');
  }

  const processed = [];
  let index = 0;

  while (index < queue.length) {
    const item = queue[index];
    processed.push(item);
    index += 1;
  }

  return processed;
}

/**
 * Recursive category search with null checks and a proper base case.
 * @returns {Book[]}
 */
export function searchBooksByCategory(bookList, category, index = 0) {
  if (bookList === null || bookList === undefined || !Array.isArray(bookList)) {
    return [];
  }
  if (typeof category !== 'string') {
    return [];
  }
  // Base case: past the end of the list
  if (index >= bookList.length) {
    return [];
  }

  const current = bookList[index];
  const rest = searchBooksByCategory(bookList, category, index + 1);

  if (current && current.category === category) {
    return [current, ...rest];
  }

  return rest;
}

/**
 * Second recursive function: sum borrowed-book counts across members.
 */
export function countBorrowedBooksRecursive(memberList, index = 0) {
  if (memberList === null || memberList === undefined || !Array.isArray(memberList)) {
    return 0;
  }
  if (index >= memberList.length) {
    return 0;
  }

  const current = memberList[index];
  const borrowed = Array.isArray(current?.borrowedBooks) ? current.borrowedBooks.length : 0;
  return borrowed + countBorrowedBooksRecursive(memberList, index + 1);
}

/** Filter books by author name (=== comparison). */
export function getBooksByAuthor(authorName) {
  if (typeof authorName !== 'string') {
    return [];
  }
  return books.filter((book) => book.author === authorName);
}

/**
 * Pure-style late-fee total via reduce.
 * @param {{ overdueBooks: Array<{ daysLate: number }> }} memberRecord
 */
export function calculateTotalLateFees(memberRecord) {
  if (!memberRecord || !Array.isArray(memberRecord.overdueBooks)) {
    return 0;
  }

  return memberRecord.overdueBooks.reduce((total, entry) => {
    const days = typeof entry.daysLate === 'number' ? entry.daysLate : 0;
    return total + days * LATE_FEE_PER_DAY;
  }, 0);
}

/** Combine collections with the spread operator. */
export function combineBookCollections(fiction, nonFiction, reference) {
  const fictionList = Array.isArray(fiction) ? fiction : [];
  const nonFictionList = Array.isArray(nonFiction) ? nonFiction : [];
  const referenceList = Array.isArray(reference) ? reference : [];
  return [...fictionList, ...nonFictionList, ...referenceList];
}

/** Rest parameters — accept any number of books and add them to the catalogue. */
export function addMultipleBooks(...newBooks) {
  for (const book of newBooks) {
    if (book && typeof book === 'object' && book.isbn) {
      books.push(book);
    }
  }
  return books.length;
}

/** Update member fields using object destructuring. */
export function updateMemberInfo(member, updates) {
  if (!member || typeof member !== 'object') {
    throw new TypeError('member must be an object');
  }
  if (!updates || typeof updates !== 'object') {
    throw new TypeError('updates must be an object');
  }

  const { name, email, membershipType } = updates;
  if (name !== undefined) {
    member.name = name;
  }
  if (email !== undefined) {
    member.email = email;
  }
  if (membershipType !== undefined) {
    member.membershipType = membershipType;
  }

  return member;
}

/**
 * Borrow a book with validation and try/catch.
 */
export function borrowBook(memberId, isbn) {
  try {
    if (memberId === null || memberId === undefined) {
      throw new Error('memberId is required');
    }
    if (typeof isbn !== 'string' || !isbn.trim()) {
      throw new Error('isbn must be a non-empty string');
    }

    const member = findMemberById(memberId);
    const book = findBookByISBN(isbn);

    if (!member) {
      throw new Error(`Member not found: ${memberId}`);
    }
    if (!book) {
      throw new Error(`Book not found: ${isbn}`);
    }
    if (!member.canBorrow()) {
      return false;
    }

    const checkedOut = book instanceof DigitalBook
      ? book.download(memberId)
      : book.checkOut(memberId);

    if (!checkedOut) {
      return false;
    }

    member.borrowedBooks.push(isbn);
    return true;
  } catch (error) {
    console.error(`borrowBook failed: ${error.message}`);
    return false;
  }
}

/** Locate a member with Array.prototype.find. */
export function findMemberById(id) {
  return members.find((member) => member.id === id) ?? null;
}

/** Locate a book by ISBN. */
export function findBookByISBN(isbn) {
  if (typeof isbn !== 'string') {
    return null;
  }
  return books.find((book) => book.isbn === isbn) ?? null;
}

/**
 * Aggregate library statistics with modern array methods.
 */
export const LibraryStats = {
  totalBooks: 0,
  totalMembers: 0,
  totalBorrowings: 0,

  /** Average copies using Math (Math.round / Math.max). */
  getAverageCopies() {
    if (books.length === 0) {
      return 0;
    }
    const sum = books.reduce((acc, book) => acc + book.totalCopies, 0);
    return Math.round((sum / books.length) * 100) / 100;
  },

  /** Titles list via for-of. */
  getAllTitles() {
    const titles = [];
    for (const book of books) {
      titles.push(book.title);
    }
    return titles;
  },

  /** Snapshot object suitable for destructuring by callers. */
  getSummary() {
    this.updateStats();
    const { totalBooks, totalMembers, totalBorrowings } = this;
    return { totalBooks, totalMembers, totalBorrowings, averageCopies: this.getAverageCopies() };
  },

  updateStats() {
    this.totalBooks = books.length;
    this.totalMembers = members.length;
    this.totalBorrowings = members.reduce(
      (sum, member) => sum + member.borrowedBooks.length,
      0
    );
  },

  getMostPopularBook() {
    if (books.length === 0) {
      return null;
    }

    return books.reduce((popular, book) => {
      if (!popular) {
        return book;
      }
      return book.checkedOut.length > popular.checkedOut.length ? book : popular;
    }, null);
  }
};

/**
 * Higher-order function: create a specialised fee calculator.
 * @param {number} rate
 * @returns {(days: number) => number}
 */
export function createFeeCalculator(rate) {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    throw new TypeError('rate must be a number');
  }
  return (daysLate) => calculateFineAmount(daysLate, rate);
}

/**
 * Higher-order function: apply a mapper to every book.
 * @param {(book: Book) => *} mapper
 */
export function mapBooks(mapper) {
  if (typeof mapper !== 'function') {
    throw new TypeError('mapper must be a function');
  }
  return books.map(mapper);
}

/** Whether any book matches a predicate (some). */
export function someBooksMatch(predicate) {
  if (typeof predicate !== 'function') {
    return false;
  }
  return books.some(predicate);
}

/** Whether every book matches a predicate (every). */
export function everyBookMatches(predicate) {
  if (typeof predicate !== 'function') {
    return false;
  }
  if (books.length === 0) {
    return true;
  }
  return books.every(predicate);
}

/** Case-insensitive title search using filter + map. */
export function searchBooksByTitle(searchTerm) {
  if (typeof searchTerm !== 'string') {
    return [];
  }
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) {
    return [...books];
  }
  return books.filter((book) => book.title.toLowerCase().includes(needle));
}

/** Filter by category, treating "all" as no filter. */
export function filterBooksByCategory(category) {
  if (category === null || category === undefined || category === 'all') {
    return [...books];
  }
  return books.filter((book) => book.category === category);
}

/** Seed demo catalogue and members for the UI. */
export function seedDemoData() {
  clearLibrary();

  const demoBooks = [
    new Book('978-0-123', 'The Silent Library', 'Ada Voss', 2019, 3, 'fiction'),
    new Book('978-0-456', 'Data Structures Deep Dive', 'Ken Park', 2021, 2, 'non-fiction'),
    new Book('978-0-789', 'Encyclopaedia of Rivers', 'Mira Cole', 2015, 1, 'reference'),
    new DigitalBook('978-1-001', 'Cloud Patterns', 'Rina Sol', 2023, 12, 'epub', 'non-fiction')
  ];

  const demoMembers = [
    new Member(1, 'John Doe', 'john@example.com', 'standard'),
    new PremiumMember(2, 'Amina Ndlovu', 'amina@example.com')
  ];

  addMultipleBooks(...demoBooks);
  members.push(...demoMembers);
  LibraryStats.updateStats();
}

// Re-export pure helpers so consumers can import from one place when useful
export { calculateFineAmount, formatBookInfo };
