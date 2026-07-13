/**
 * DOM layer: rendering, events, and UI wiring for the library app.
 * Module 4 — imports domain + storage modules; bootstraps on DOMContentLoaded.
 */

import {
  books,
  members,
  borrowBook,
  findBookByISBN,
  filterBooksByCategory,
  searchBooksByTitle,
  seedDemoData,
  LibraryStats,
  DigitalBook
} from './library.js';
import {
  exportLibraryData,
  importLibraryData,
  saveToLocalStorage,
  loadFromLocalStorage
} from './storage.js';

let catalogueContainer = null;
let searchInput = null;
let filterDropdown = null;

/**
 * Cache DOM nodes, attach listeners, and load the catalogue.
 */
export function initializeUI() {
  catalogueContainer = document.querySelector('#catalogue-list');
  searchInput = document.getElementById('search');
  filterDropdown = document.querySelector('#filter-category');

  if (catalogueContainer === null) {
    console.error('Catalogue container #catalogue-list not found');
    return;
  }
  if (searchInput === null) {
    console.error('Search input #search not found');
    return;
  }
  if (filterDropdown === null) {
    console.error('Filter dropdown #filter-category not found');
    return;
  }

  setupEventListeners();

  // Prefer persisted state; only seed when storage and memory are both empty
  const loaded = loadFromLocalStorage();
  if (!loaded && books.length === 0) {
    seedDemoData();
    saveToLocalStorage();
  }

  loadCatalogue();
  updateStatisticsDisplay();
}

function setupEventListeners() {
  // 1) Search as the user types
  searchInput.addEventListener('input', handleSearch);

  // 2) Category filter — change (not click)
  filterDropdown.addEventListener('change', handleFilterChange);

  // 3) Borrow form submit
  const borrowForm = document.getElementById('borrow-form');
  if (borrowForm !== null) {
    borrowForm.addEventListener('submit', handleBorrowSubmit);
  }

  // 4) Event delegation: book card clicks inside the catalogue
  catalogueContainer.addEventListener('click', handleBookClick);

  // 5) Event delegation: tab navigation
  const headerNav = document.querySelector('header nav');
  if (headerNav !== null) {
    headerNav.addEventListener('click', handleTabClick);
  }

  // 6) Export button (optional control)
  const exportBtn = document.getElementById('export-data');
  if (exportBtn !== null) {
    exportBtn.addEventListener('click', handleExportClick);
  }

  // 7) Import button (optional control)
  const importBtn = document.getElementById('import-data');
  if (importBtn !== null) {
    importBtn.addEventListener('click', handleImportClick);
  }

  // 8) Save button
  const saveBtn = document.getElementById('save-data');
  if (saveBtn !== null) {
    saveBtn.addEventListener('click', () => {
      saveToLocalStorage();
    });
  }
}

/** Clear and re-render the full catalogue. */
export function loadCatalogue() {
  renderBookCatalogue(books);
}

/**
 * Render books with template literals, DocumentFragment, and data attributes.
 * @param {Array} bookList
 */
export function renderBookCatalogue(bookList) {
  if (catalogueContainer === null) {
    return;
  }

  catalogueContainer.innerHTML = '';

  if (!Array.isArray(bookList) || bookList.length === 0) {
    catalogueContainer.innerHTML = '<p class="empty-state">No books found.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const book of bookList) {
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.dataset.isbn = book.isbn;
    bookCard.setAttribute('role', 'button');
    bookCard.tabIndex = 0;

    const availableLabel = book instanceof DigitalBook
      ? 'Unlimited'
      : (book.availableCopies ?? 0);

    bookCard.innerHTML = `
      <h3>${book.title}</h3>
      <p>Author: ${book.author}</p>
      <p>Available: ${availableLabel}</p>
      <p class="category-tag">${book.category ?? 'uncategorised'}</p>
    `;

    fragment.appendChild(bookCard);
  }

  catalogueContainer.appendChild(fragment);
}

export function handleBorrowSubmit(event) {
  event.preventDefault();

  const memberIdInput = document.getElementById('member-id');
  const isbnInput = document.getElementById('isbn');

  if (memberIdInput === null || isbnInput === null) {
    alert('Borrow form fields are missing');
    return;
  }

  const rawId = memberIdInput.value.trim();
  const isbn = isbnInput.value.trim();

  if (!rawId || !isbn) {
    alert('Member ID and ISBN are required');
    return;
  }

  const memberId = Number.isNaN(Number(rawId)) ? rawId : Number(rawId);

  try {
    const success = borrowBook(memberId, isbn);
    if (success) {
      alert('Book borrowed successfully');
      event.target.reset();
      saveToLocalStorage();
      loadCatalogue();
      updateStatisticsDisplay();
    } else {
      alert('Unable to borrow book — check availability or borrow limits');
    }
  } catch (error) {
    alert(`Borrow failed: ${error.message}`);
  }
}

/** Event delegation: resolve nearest book card via closest(). */
export function handleBookClick(event) {
  const bookElement = event.target.closest('.book-card');
  if (bookElement === null) {
    return;
  }

  const bookId = bookElement.dataset.isbn;
  if (bookId) {
    displayBookDetails(bookId);
  }
}

/** Event delegation for section tabs. */
export function handleTabClick(event) {
  const button = event.target.closest('button');
  if (button === null) {
    return;
  }

  const catalogueSection = document.getElementById('catalogue-section');
  const memberSection = document.getElementById('member-section');
  const statisticsSection = document.getElementById('statistics-section');
  const borrowSection = document.getElementById('borrow-section');

  const sections = [catalogueSection, memberSection, statisticsSection, borrowSection];
  for (const section of sections) {
    if (section !== null) {
      section.style.display = 'none';
    }
  }

  if (button.id === 'catalogue-tab') {
    if (catalogueSection !== null) catalogueSection.style.display = 'block';
    if (borrowSection !== null) borrowSection.style.display = 'block';
  } else if (button.id === 'members-tab') {
    if (memberSection !== null) {
      memberSection.style.display = 'block';
      createMemberForm();
      renderMemberList();
    }
  } else if (button.id === 'statistics-tab') {
    if (statisticsSection !== null) {
      statisticsSection.style.display = 'block';
      updateStatisticsDisplay();
    }
  }
}

export function handleSearch(event) {
  const searchTerm = event.target.value;
  const results = searchBooksByTitle(searchTerm);
  renderBookCatalogue(results);
}

export function handleFilterChange() {
  if (filterDropdown === null) {
    return;
  }

  const selectedCategory = filterDropdown.value;
  const filtered = filterBooksByCategory(selectedCategory);
  renderBookCatalogue(filtered);
}

export function handleExportClick() {
  const json = exportLibraryData();
  const output = document.getElementById('data-output');
  if (output !== null) {
    output.value = json;
  } else {
    console.log(json);
  }
}

export function handleImportClick() {
  const input = document.getElementById('data-output');
  if (input === null || !input.value.trim()) {
    alert('Paste JSON into the data area before importing');
    return;
  }

  const ok = importLibraryData(input.value);
  if (ok) {
    saveToLocalStorage();
    loadCatalogue();
    updateStatisticsDisplay();
    alert('Library data imported');
  } else {
    alert('Import failed — invalid JSON');
  }
}

export function displayBookDetails(isbn) {
  const book = findBookByISBN(isbn);
  if (book === null || book === undefined) {
    return;
  }

  const detailsContainer = document.getElementById('book-details');
  if (detailsContainer === null) {
    return;
  }

  const html = `
    <div class="book-details">
      <h2>${book.title}</h2>
      <p><strong>Author:</strong> ${book.author}</p>
      <p><strong>ISBN:</strong> ${book.isbn}</p>
      <p><strong>Year:</strong> ${book.year}</p>
      <p><strong>Category:</strong> ${book.category ?? 'n/a'}</p>
      <p><strong>Available:</strong> ${book.availableCopies}</p>
    </div>
  `;

  detailsContainer.innerHTML = html;
}

export function updateStatisticsDisplay() {
  LibraryStats.updateStats();
  const { totalBooks, totalMembers, totalBorrowings } = LibraryStats.getSummary();

  const totalBooksEl = document.querySelector('.total-books');
  const totalMembersEl = document.querySelector('.total-members');
  const borrowedEl = document.querySelector('.books-borrowed');

  if (totalBooksEl !== null) {
    totalBooksEl.textContent = String(totalBooks);
  }
  if (totalMembersEl !== null) {
    totalMembersEl.textContent = String(totalMembers);
  }
  if (borrowedEl !== null) {
    borrowedEl.textContent = String(totalBorrowings);
  }
}

export function createMemberForm() {
  const formContainer = document.getElementById('member-form');
  if (formContainer === null) {
    return;
  }

  formContainer.innerHTML = `
    <form id="add-member-form" class="member-form">
      <label for="name">Name</label>
      <input type="text" id="name" name="name" placeholder="Full name" required>
      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="email@example.com" required>
      <label for="membership-type">Membership</label>
      <select id="membership-type" name="membershipType">
        <option value="standard">Standard</option>
        <option value="premium">Premium</option>
      </select>
      <button type="submit">Add Member</button>
    </form>
  `;

  const form = document.getElementById('add-member-form');
  if (form !== null) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      alert('Use the library API / seed data to register members in this demo.');
    });
  }
}

function renderMemberList() {
  const list = document.getElementById('member-list');
  if (list === null) {
    return;
  }

  list.innerHTML = members
    .map((member) => `<p data-member-id="${member.id}">${member.name} (${member.membershipType})</p>`)
    .join('');
}

// Correct bootstrap: wait for DOMContentLoaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializeUI);
}
