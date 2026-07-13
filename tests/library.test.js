/**
 * Comprehensive Jest suite for the library management system.
 * Covers classes, recursion, array methods, storage, DOM, and edge cases.
 */

import { jest } from '@jest/globals';
import {
  Book,
  DigitalBook,
  Member,
  PremiumMember,
  books,
  members,
  clearLibrary,
  setBooks,
  setMembers,
  addMultipleBooks,
  borrowBook,
  findBookByISBN,
  findMemberById,
  getBooksByAuthor,
  calculateTotalLateFees,
  combineBookCollections,
  updateMemberInfo,
  searchBooksByCategory,
  countBorrowedBooksRecursive,
  processReturnQueue,
  findOverdueBooks,
  LibraryStats,
  createFeeCalculator,
  mapBooks,
  someBooksMatch,
  everyBookMatches,
  searchBooksByTitle,
  filterBooksByCategory,
  seedDemoData,
  MAX_BOOKS_PER_MEMBER,
  MAX_BOOKS_PREMIUM
} from '../src/library.js';
import {
  calculateFineAmount,
  formatBookInfo,
  mergeUniqueIsbns,
  splitFirstTitle,
  formatStatLabel,
  isNonEmptyString
} from '../src/utils.js';
import {
  exportLibraryData,
  importLibraryData,
  saveToLocalStorage,
  loadFromLocalStorage
} from '../src/storage.js';
import {
  initializeUI,
  renderBookCatalogue,
  handleBorrowSubmit,
  handleSearch,
  handleFilterChange,
  displayBookDetails,
  updateStatisticsDisplay,
  handleBookClick,
  handleTabClick,
  handleExportClick,
  handleImportClick,
  createMemberForm,
  loadCatalogue
} from '../src/ui.js';

beforeEach(() => {
  clearLibrary();
  localStorage.clear();
  document.body.innerHTML = `
    <header>
      <nav>
        <button id="catalogue-tab">Catalogue</button>
        <button id="members-tab">Members</button>
        <button id="statistics-tab">Statistics</button>
      </nav>
    </header>
    <div id="catalogue-list"></div>
    <input id="search" />
    <select id="filter-category">
      <option value="all">All</option>
      <option value="fiction">Fiction</option>
    </select>
    <form id="borrow-form">
      <input id="member-id" />
      <input id="isbn" />
      <button type="submit">Borrow</button>
    </form>
    <div id="book-details"></div>
    <p class="total-books">0</p>
    <p class="total-members">0</p>
    <p class="books-borrowed">0</p>
    <div id="member-form"></div>
    <div id="member-list"></div>
    <section id="catalogue-section"></section>
    <section id="borrow-section"></section>
    <section id="member-section" style="display:none"></section>
    <section id="statistics-section" style="display:none"></section>
    <button id="export-data"></button>
    <button id="import-data"></button>
    <button id="save-data"></button>
    <textarea id="data-output"></textarea>
  `;
});

describe('Book Class', () => {
  test('creates a book with availableCopies and totalCopies', () => {
    const book = new Book('978-0-123', 'Test Book', 'Author Name', 2020, 5, 'fiction');
    expect(book.isbn).toBe('978-0-123');
    expect(book.title).toBe('Test Book');
    expect(book.availableCopies).toBe(5);
    expect(book.totalCopies).toBe(5);
  });

  test('isAvailable and checkOut manage stock correctly', () => {
    const book = new Book('978-0-1', 'Stock', 'A', 2020, 1);
    expect(book.isAvailable()).toBe(true);
    expect(book.checkOut(1)).toBe(true);
    expect(book.availableCopies).toBe(0);
    expect(book.isAvailable()).toBe(false);
    expect(book.checkOut(2)).toBe(false);
  });

  test('getInfo uses template literal content', () => {
    const book = new Book('978-0-2', 'Ocean', 'Lee', 2018, 2);
    const info = book.getInfo();
    expect(info).toContain('Ocean');
    expect(info).toContain('Lee');
    expect(info).toMatch(/Available: 2\/2/);
  });
});

describe('DigitalBook Class', () => {
  test('inherits from Book and calls super successfully', () => {
    const digi = new DigitalBook('978-1-1', 'Cloud', 'Sol', 2023, 10, 'epub');
    expect(digi).toBeInstanceOf(Book);
    expect(digi).toBeInstanceOf(DigitalBook);
    expect(digi.title).toBe('Cloud');
    expect(digi.format).toBe('epub');
  });

  test('download increments downloads and records member', () => {
    const digi = new DigitalBook('978-1-2', 'Patterns', 'Sol', 2023, 8, 'pdf');
    expect(digi.download(99)).toBe(true);
    expect(digi.downloads).toBe(1);
    expect(digi.checkedOut[0].memberId).toBe(99);
  });
});

describe('Member Class', () => {
  test('canBorrow returns boolean and respects limit', () => {
    const member = new Member(1, 'John Doe', 'john@example.com', 'standard');
    expect(typeof member.canBorrow()).toBe('boolean');
    expect(member.canBorrow()).toBe(true);
    member.borrowedBooks = Array(MAX_BOOKS_PER_MEMBER).fill('x');
    expect(member.canBorrow()).toBe(false);
  });

  test('joinDate and getMembershipDuration exist', () => {
    const member = new Member(2, 'Ada', 'ada@example.com');
    expect(member.joinDate).toBeInstanceOf(Date);
    expect(typeof member.getMembershipDuration()).toBe('number');
    expect(member.getMembershipDuration()).toBeGreaterThanOrEqual(0);
  });

  test('getMemberInfo uses destructured fields', () => {
    const member = new Member(3, 'Sam', 'sam@example.com');
    expect(member.getMemberInfo()).toContain('Sam');
    expect(member.getMemberInfo()).toContain('3');
  });
});

describe('PremiumMember Class', () => {
  test('inherits Member and overrides canBorrow to allow 10 books', () => {
    const premium = new PremiumMember(10, 'Amina', 'amina@example.com');
    expect(premium).toBeInstanceOf(Member);
    expect(premium.membershipType).toBe('premium');
    premium.borrowedBooks = Array(MAX_BOOKS_PER_MEMBER).fill('x');
    expect(premium.canBorrow()).toBe(true);
    premium.borrowedBooks = Array(MAX_BOOKS_PREMIUM).fill('x');
    expect(premium.canBorrow()).toBe(false);
  });

  test('has premium-specific properties', () => {
    const premium = new PremiumMember(11, 'Lee', 'lee@example.com');
    expect(premium.priorityHolds).toBe(true);
    expect(premium.lateFeeDiscount).toBe(0.25);
  });
});

describe('Library Functions', () => {
  test('findBookByISBN returns the matching book', () => {
    const book = new Book('978-0-123', 'Test Book', 'Author', 2020, 2);
    addMultipleBooks(book);
    expect(findBookByISBN('978-0-123')).toBe(book);
  });

  test('getBooksByAuthor filters with ===', () => {
    addMultipleBooks(
      new Book('1', 'A', 'Ken', 2020, 1),
      new Book('2', 'B', 'Ken', 2021, 1),
      new Book('3', 'C', 'Other', 2022, 1)
    );
    expect(getBooksByAuthor('Ken')).toHaveLength(2);
  });

  test('borrowBook succeeds for valid member and book', () => {
    addMultipleBooks(new Book('978-9', 'Borrow Me', 'Auth', 2020, 2));
    members.push(new Member(1, 'John', 'j@e.com'));
    expect(borrowBook(1, '978-9')).toBe(true);
    expect(findMemberById(1).borrowedBooks).toContain('978-9');
  });
});

describe('Array Operations', () => {
  test('filter via getBooksByAuthor and filterBooksByCategory', () => {
    addMultipleBooks(
      new Book('a', 'T1', 'A', 2020, 1, 'fiction'),
      new Book('b', 'T2', 'B', 2020, 1, 'reference')
    );
    expect(filterBooksByCategory('fiction')).toHaveLength(1);
    expect(getBooksByAuthor('A')).toHaveLength(1);
  });

  test('mapBooks maps titles', () => {
    addMultipleBooks(new Book('a', 'Alpha', 'A', 2020, 1));
    expect(mapBooks((b) => b.title)).toEqual(['Alpha']);
  });

  test('calculateTotalLateFees uses reduce', () => {
    const fees = calculateTotalLateFees({
      overdueBooks: [{ daysLate: 4 }, { daysLate: 2 }]
    });
    expect(fees).toBe(3);
  });

  test('combineBookCollections uses spread', () => {
    const combined = combineBookCollections([{ isbn: '1' }], [{ isbn: '2' }], [{ isbn: '3' }]);
    expect(combined).toHaveLength(3);
  });

  test('addMultipleBooks uses rest parameters', () => {
    const count = addMultipleBooks(
      new Book('1', 'One', 'A', 2020, 1),
      new Book('2', 'Two', 'B', 2021, 1)
    );
    expect(count).toBe(2);
    expect(books).toHaveLength(2);
  });

  test('some and every helpers work', () => {
    addMultipleBooks(new Book('1', 'One', 'A', 2020, 1));
    expect(someBooksMatch((b) => b.title === 'One')).toBe(true);
    expect(everyBookMatches((b) => typeof b.isbn === 'string')).toBe(true);
  });
});

describe('Recursive Functions', () => {
  test('searchBooksByCategory finds matches and stops at base case', () => {
    const list = [
      new Book('1', 'A', 'X', 2020, 1, 'fiction'),
      new Book('2', 'B', 'Y', 2020, 1, 'reference'),
      new Book('3', 'C', 'Z', 2020, 1, 'fiction')
    ];
    const found = searchBooksByCategory(list, 'fiction');
    expect(found).toHaveLength(2);
    expect(searchBooksByCategory([], 'fiction')).toEqual([]);
  });

  test('countBorrowedBooksRecursive sums borrowed counts', () => {
    const m1 = new Member(1, 'A', 'a@a.com');
    const m2 = new Member(2, 'B', 'b@b.com');
    m1.borrowedBooks = ['1', '2'];
    m2.borrowedBooks = ['3'];
    expect(countBorrowedBooksRecursive([m1, m2])).toBe(3);
    expect(countBorrowedBooksRecursive(null)).toBe(0);
  });
});

describe('Error Handling', () => {
  test('borrowBook returns false for missing member/book without throwing', () => {
    expect(borrowBook(999, 'missing')).toBe(false);
    expect(borrowBook(null, 'x')).toBe(false);
  });

  test('importLibraryData handles invalid JSON via try-catch', () => {
    expect(importLibraryData('{bad')).toBe(false);
    expect(importLibraryData('')).toBe(false);
  });

  test('Book constructor validates types', () => {
    expect(() => new Book('', 'T', 'A', 2020, 1)).toThrow();
    expect(() => new Book('1', 'T', 'A', 'year', 1)).toThrow();
  });

  test('calculateFineAmount handles null and NaN edge cases', () => {
    expect(calculateFineAmount(null)).toBe(0);
    expect(calculateFineAmount(Number.NaN)).toBe(0);
    expect(calculateFineAmount(-3)).toBe(0);
  });

  test('processReturnQueue rejects non-arrays', () => {
    expect(() => processReturnQueue('nope')).toThrow(TypeError);
  });
});

describe('String Operations', () => {
  test('formatBookInfo uses template literals and string methods', () => {
    const info = formatBookInfo({ title: '  quiet  ', author: 'Ada', year: 2019 });
    expect(info).toContain('QUIET');
    expect(info).toContain('Author: Ada');
    expect(info).toContain('Year: 2019');
  });

  test('isNonEmptyString validates strings', () => {
    expect(isNonEmptyString('ok')).toBe(true);
    expect(isNonEmptyString('  ')).toBe(false);
  });
});

describe('Math Operations', () => {
  test('calculateFineAmount returns correct currency amount', () => {
    expect(calculateFineAmount(5)).toBe(2.5);
    expect(typeof calculateFineAmount(5)).toBe('number');
  });

  test('LibraryStats.getAverageCopies uses Math rounding', () => {
    addMultipleBooks(
      new Book('1', 'A', 'A', 2020, 2),
      new Book('2', 'B', 'B', 2020, 4)
    );
    expect(LibraryStats.getAverageCopies()).toBe(3);
  });

  test('createFeeCalculator higher-order function works', () => {
    const calc = createFeeCalculator(1);
    expect(calc(3)).toBe(3);
  });
});

describe('Destructuring and Modern Helpers', () => {
  test('updateMemberInfo destructures updates', () => {
    const member = new Member(1, 'Old', 'old@e.com');
    updateMemberInfo(member, { name: 'New', email: 'new@e.com' });
    expect(member.name).toBe('New');
    expect(member.email).toBe('new@e.com');
  });

  test('splitFirstTitle uses array destructuring', () => {
    expect(splitFirstTitle(['A', 'B', 'C'])).toEqual({ first: 'A', rest: ['B', 'C'] });
  });

  test('formatStatLabel uses parameter destructuring', () => {
    expect(formatStatLabel({ label: 'Books', value: 4 })).toBe('Books: 4');
  });

  test('mergeUniqueIsbns uses rest and spread', () => {
    expect(mergeUniqueIsbns(['1', '2'], ['2', '3'])).toEqual(['1', '2', '3']);
  });
});

describe('JSON Operations', () => {
  test('exportLibraryData returns stringified JSON', () => {
    addMultipleBooks(new Book('1', 'A', 'A', 2020, 1));
    members.push(new Member(1, 'M', 'm@e.com'));
    const json = exportLibraryData();
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.books).toHaveLength(1);
    expect(parsed.members).toHaveLength(1);
  });

  test('importLibraryData restores arrays', () => {
    const payload = JSON.stringify({
      books: [{ isbn: '9', title: 'Z' }],
      members: [{ id: 1, name: 'Z' }]
    });
    expect(importLibraryData(payload)).toBe(true);
    expect(books[0].isbn).toBe('9');
    expect(members[0].id).toBe(1);
  });
});

describe('LocalStorage', () => {
  test('saveToLocalStorage and loadFromLocalStorage round-trip', () => {
    addMultipleBooks(new Book('1', 'A', 'A', 2020, 1));
    members.push(new Member(1, 'M', 'm@e.com'));
    expect(saveToLocalStorage()).toBe(true);
    clearLibrary();
    expect(books).toHaveLength(0);
    expect(loadFromLocalStorage()).toBe(true);
    expect(books).toHaveLength(1);
    expect(members).toHaveLength(1);
  });

  test('loadFromLocalStorage returns false when empty', () => {
    expect(loadFromLocalStorage()).toBe(false);
  });
});

describe('Control Flow Helpers', () => {
  test('processReturnQueue increments index and finishes', () => {
    expect(processReturnQueue(['a', 'b'])).toEqual(['a', 'b']);
  });

  test('findOverdueBooks uses for-of and date checks', () => {
    const book = new Book('1', 'Old', 'A', 2020, 1);
    book.checkedOut.push({
      memberId: 1,
      checkoutDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });
    addMultipleBooks(book);
    expect(findOverdueBooks(14).length).toBeGreaterThan(0);
  });

  test('LibraryStats.getAllTitles uses for-of', () => {
    addMultipleBooks(new Book('1', 'Alpha', 'A', 2020, 1));
    expect(LibraryStats.getAllTitles()).toEqual(['Alpha']);
  });

  test('getMostPopularBook uses reduce', () => {
    const quiet = new Book('1', 'Quiet', 'A', 2020, 3);
    const loud = new Book('2', 'Loud', 'B', 2020, 3);
    quiet.checkOut(1);
    loud.checkOut(1);
    loud.checkOut(2);
    addMultipleBooks(quiet, loud);
    expect(LibraryStats.getMostPopularBook().isbn).toBe('2');
  });
});

describe('DOM Manipulation', () => {
  test('initializeUI renders catalogue without throwing', () => {
    seedDemoData();
    expect(() => initializeUI()).not.toThrow();
    expect(document.querySelectorAll('.book-card').length).toBeGreaterThan(0);
  });

  test('renderBookCatalogue writes cards with data-isbn', () => {
    const book = new Book('978', 'Dom Book', 'A', 2020, 1);
    initializeUI();
    renderBookCatalogue([book]);
    const card = document.querySelector('.book-card');
    expect(card).not.toBeNull();
    expect(card.dataset.isbn).toBe('978');
  });

  test('handleSearch filters titles case-insensitively', () => {
    addMultipleBooks(new Book('1', 'Silent Sea', 'A', 2020, 1));
    initializeUI();
    handleSearch({ target: { value: 'silent' } });
    expect(document.querySelectorAll('.book-card')).toHaveLength(1);
  });

  test('handleBorrowSubmit prevents default and borrows', () => {
    addMultipleBooks(new Book('978-0', 'Borrow', 'A', 2020, 1));
    members.push(new Member(1, 'John', 'j@e.com'));
    saveToLocalStorage();
    initializeUI();
    document.getElementById('member-id').value = '1';
    document.getElementById('isbn').value = '978-0';

    const event = {
      preventDefault: jest.fn(),
      target: document.getElementById('borrow-form')
    };
    window.alert = jest.fn();
    handleBorrowSubmit(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(findMemberById(1).borrowedBooks).toContain('978-0');
  });

  test('handleBorrowSubmit validates empty inputs', () => {
    saveToLocalStorage();
    initializeUI();
    document.getElementById('member-id').value = '';
    document.getElementById('isbn').value = '';
    window.alert = jest.fn();
    const event = {
      preventDefault: jest.fn(),
      target: document.getElementById('borrow-form')
    };
    handleBorrowSubmit(event);
    expect(window.alert).toHaveBeenCalled();
  });

  test('handleBorrowSubmit reports failure when borrow is impossible', () => {
    addMultipleBooks(new Book('978-x', 'Gone', 'A', 2020, 0));
    members.push(new Member(1, 'John', 'j@e.com'));
    saveToLocalStorage();
    initializeUI();
    document.getElementById('member-id').value = '1';
    document.getElementById('isbn').value = '978-x';
    window.alert = jest.fn();
    handleBorrowSubmit({
      preventDefault: jest.fn(),
      target: document.getElementById('borrow-form')
    });
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Unable to borrow')
    );
  });

  test('handleBookClick delegation shows details', () => {
    addMultipleBooks(new Book('978-d', 'Detail', 'A', 2020, 1));
    saveToLocalStorage();
    initializeUI();
    renderBookCatalogue(books);
    const card = document.querySelector('.book-card');
    handleBookClick({ target: card });
    expect(document.getElementById('book-details').innerHTML).toContain('Detail');
  });

  test('handleBookClick ignores clicks outside cards', () => {
    initializeUI();
    handleBookClick({ target: document.body });
    expect(document.getElementById('book-details').innerHTML).toBe('');
  });

  test('handleFilterChange filters by category', () => {
    addMultipleBooks(
      new Book('1', 'F', 'A', 2020, 1, 'fiction'),
      new Book('2', 'R', 'B', 2020, 1, 'reference')
    );
    saveToLocalStorage();
    initializeUI();
    document.getElementById('filter-category').value = 'fiction';
    handleFilterChange();
    expect(document.querySelectorAll('.book-card')).toHaveLength(1);
  });

  test('updateStatisticsDisplay writes counts', () => {
    seedDemoData();
    saveToLocalStorage();
    initializeUI();
    updateStatisticsDisplay();
    expect(document.querySelector('.total-books').textContent).not.toBe('0');
  });

  test('displayBookDetails ignores missing books', () => {
    initializeUI();
    displayBookDetails('missing-isbn');
    expect(document.getElementById('book-details').innerHTML).toBe('');
  });

  test('handleTabClick switches visible sections', () => {
    initializeUI();
    handleTabClick({ target: document.getElementById('members-tab') });
    expect(document.getElementById('member-section').style.display).toBe('block');
    handleTabClick({ target: document.getElementById('statistics-tab') });
    expect(document.getElementById('statistics-section').style.display).toBe('block');
    handleTabClick({ target: document.getElementById('catalogue-tab') });
    expect(document.getElementById('catalogue-section').style.display).toBe('block');
  });

  test('export and import UI handlers round-trip JSON', () => {
    addMultipleBooks(new Book('1', 'A', 'A', 2020, 1));
    members.push(new Member(1, 'M', 'm@e.com'));
    saveToLocalStorage();
    initializeUI();
    handleExportClick();
    expect(document.getElementById('data-output').value).toContain('"books"');
    window.alert = jest.fn();
    handleImportClick();
    expect(window.alert).toHaveBeenCalledWith('Library data imported');
  });

  test('handleImportClick alerts on empty JSON area', () => {
    initializeUI();
    document.getElementById('data-output').value = '';
    window.alert = jest.fn();
    handleImportClick();
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Paste JSON')
    );
  });

  test('handleImportClick alerts on invalid JSON', () => {
    initializeUI();
    document.getElementById('data-output').value = '{bad';
    window.alert = jest.fn();
    handleImportClick();
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Import failed')
    );
  });

  test('createMemberForm renders fields and prevents default submit', () => {
    initializeUI();
    createMemberForm();
    const form = document.getElementById('add-member-form');
    expect(form).not.toBeNull();
    window.alert = jest.fn();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(window.alert).toHaveBeenCalled();
  });

  test('renderBookCatalogue shows empty state', () => {
    initializeUI();
    renderBookCatalogue([]);
    expect(document.getElementById('catalogue-list').innerHTML).toContain('No books found');
  });

  test('loadCatalogue renders current books', () => {
    addMultipleBooks(new Book('1', 'LoadMe', 'A', 2020, 1));
    saveToLocalStorage();
    initializeUI();
    loadCatalogue();
    expect(document.body.innerHTML).toContain('LoadMe');
  });

  test('initializeUI exits early when catalogue node missing', () => {
    document.getElementById('catalogue-list').remove();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    initializeUI();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('Edge Cases', () => {
  test('empty catalogue search and filter return empty/safe results', () => {
    expect(searchBooksByTitle('x')).toEqual([]);
    expect(filterBooksByCategory('all')).toEqual([]);
    expect(findBookByISBN('none')).toBeNull();
    expect(findMemberById(1)).toBeNull();
  });

  test('setBooks and setMembers validate arrays', () => {
    expect(() => setBooks('no')).toThrow();
    expect(() => setMembers(null)).toThrow();
    setBooks([]);
    setMembers([]);
    expect(books).toEqual([]);
    expect(members).toEqual([]);
  });

  test('returnCopy restores availability', () => {
    const book = new Book('1', 'A', 'A', 2020, 1);
    book.checkOut(7);
    expect(book.returnCopy(7)).toBe(true);
    expect(book.availableCopies).toBe(1);
    expect(book.returnCopy(7)).toBe(false);
  });

  test('borrowBook downloads digital titles', () => {
    addMultipleBooks(new DigitalBook('d1', 'Digi', 'A', 2023, 5, 'epub'));
    members.push(new Member(1, 'John', 'j@e.com'));
    expect(borrowBook(1, 'd1')).toBe(true);
    expect(findBookByISBN('d1').downloads).toBe(1);
  });

  test('DigitalBook getInfo and download null guard', () => {
    const digi = new DigitalBook('d2', 'Digi', 'A', 2023, 5, 'pdf');
    expect(digi.getInfo()).toContain('pdf');
    expect(digi.download(null)).toBe(false);
  });

  test('Member and updateMemberInfo validation errors', () => {
    expect(() => new Member(null, 'A', 'a@a.com')).toThrow();
    expect(() => new Member(1, '', 'a@a.com')).toThrow();
    expect(() => updateMemberInfo(null, {})).toThrow();
    expect(() => updateMemberInfo({}, null)).toThrow();
  });

  test('searchBooksByCategory guards invalid inputs', () => {
    expect(searchBooksByCategory(null, 'fiction')).toEqual([]);
    expect(searchBooksByCategory([{ category: 'fiction' }], 1)).toEqual([]);
  });

  test('LibraryStats summary and empty popular book', () => {
    expect(LibraryStats.getMostPopularBook()).toBeNull();
    expect(LibraryStats.getAverageCopies()).toBe(0);
    addMultipleBooks(new Book('1', 'A', 'A', 2020, 2));
    members.push(new Member(1, 'M', 'm@e.com'));
    const summary = LibraryStats.getSummary();
    expect(summary.totalBooks).toBe(1);
    expect(summary).toHaveProperty('averageCopies');
  });

  test('storage helpers handle invalid payloads and write errors', () => {
    expect(importLibraryData(JSON.stringify({ books: 'x', members: [] }))).toBe(false);
    expect(importLibraryData(JSON.stringify(null))).toBe(false);
    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(saveToLocalStorage()).toBe(false);
    setSpy.mockRestore();

    localStorage.setItem('libraryBooks', JSON.stringify([{ isbn: '1' }]));
    localStorage.setItem('libraryMembers', JSON.stringify('bad'));
    expect(loadFromLocalStorage()).toBe(false);
  });

  test('checkOut rejects null memberId', () => {
    const book = new Book('1', 'A', 'A', 2020, 1);
    expect(book.checkOut(null)).toBe(false);
  });

  test('findOverdueBooks validates daysOverdue type', () => {
    expect(() => findOverdueBooks('x')).toThrow(TypeError);
  });

  test('mapBooks and fee calculator validate callbacks/rates', () => {
    expect(() => mapBooks('nope')).toThrow();
    expect(() => createFeeCalculator('bad')).toThrow();
    expect(someBooksMatch('nope')).toBe(false);
    expect(everyBookMatches('nope')).toBe(false);
    expect(everyBookMatches(() => true)).toBe(true);
  });

  test('searchBooksByTitle blank term returns a copy of books', () => {
    addMultipleBooks(new Book('1', 'A', 'A', 2020, 1));
    expect(searchBooksByTitle('')).toHaveLength(1);
    expect(searchBooksByTitle(1)).toEqual([]);
  });

  test('formatBookInfo and merge helpers handle bad input', () => {
    expect(formatBookInfo(null)).toBe('');
    expect(splitFirstTitle([])).toEqual({ first: null, rest: [] });
    expect(calculateFineAmount(2, Number.NaN)).toBe(0);
  });

  test('calculateTotalLateFees handles missing records', () => {
    expect(calculateTotalLateFees(null)).toBe(0);
    expect(calculateTotalLateFees({ overdueBooks: [{ daysLate: 'x' }] })).toBe(0);
  });
});
