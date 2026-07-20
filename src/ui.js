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
  DigitalBook,
  addMember,
  editMember,
  deleteMember,
  ensureBookCovers,
  clearLibrary
} from './library.js';
import {
  exportLibraryData,
  importLibraryData,
  saveToLocalStorage,
  loadFromLocalStorage
} from './storage.js';
import { formatMembershipTenure } from './utils.js';

let catalogueContainer = null;
let searchInput = null;
let filterDropdown = null;
let editingMemberId = null;

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
  } else {
    ensureBookCovers();
  }

  setActiveTab('catalogue-tab');
  loadCatalogue();
  updateStatisticsDisplay();
  populateBorrowSelects();
}

function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  filterDropdown.addEventListener('change', handleFilterChange);

  const borrowForm = document.getElementById('borrow-form');
  if (borrowForm !== null) {
    borrowForm.addEventListener('submit', handleBorrowSubmit);
  }

  catalogueContainer.addEventListener('click', handleBookClick);

  const headerNav = document.querySelector('header nav');
  if (headerNav !== null) {
    headerNav.addEventListener('click', handleTabClick);
  }

  const exportBtn = document.getElementById('export-data');
  if (exportBtn !== null) {
    exportBtn.addEventListener('click', handleExportClick);
  }

  const importBtn = document.getElementById('import-data');
  if (importBtn !== null) {
    importBtn.addEventListener('click', handleImportClick);
  }

  const saveBtn = document.getElementById('save-data');
  if (saveBtn !== null) {
    saveBtn.addEventListener('click', () => {
      saveToLocalStorage();
      showToast('Library saved locally');
    });
  }

  const resetBtn = document.getElementById('reset-demo');
  if (resetBtn !== null) {
    resetBtn.addEventListener('click', handleResetDemo);
  }

  const memberList = document.getElementById('member-list');
  if (memberList !== null) {
    memberList.addEventListener('click', handleMemberListClick);
  }
}

function setActiveTab(tabId) {
  const buttons = document.querySelectorAll('header nav button');
  for (const button of buttons) {
    button.classList.toggle('is-active', button.id === tabId);
  }
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('app-toast');
  if (toast === null) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast toast-${type} is-visible`;
  toast.textContent = message;
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

/** Clear and re-render the full catalogue. */
export function loadCatalogue() {
  renderBookCatalogue(books);
  populateBorrowSelects();
}

/**
 * Render books as visual cover cards with DocumentFragment + data attributes.
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
    const bookCard = document.createElement('article');
    bookCard.className = 'book-card';
    bookCard.dataset.isbn = book.isbn;
    bookCard.setAttribute('role', 'button');
    bookCard.tabIndex = 0;

    const availableLabel = book instanceof DigitalBook
      ? 'Unlimited'
      : (book.availableCopies ?? 0);
    const isDigital = book instanceof DigitalBook;
    const cover = book.coverUrl || '';

    bookCard.innerHTML = `
      <div class="book-cover-wrap">
        <img
          class="book-cover"
          src="${cover}"
          alt="Cover of ${escapeHtml(book.title)}"
          loading="lazy"
          onerror="this.classList.add('is-fallback'); this.src=''; this.alt='';"
        >
        <span class="book-badge ${isDigital ? 'badge-digital' : 'badge-physical'}">
          ${isDigital ? 'Digital' : 'Physical'}
        </span>
      </div>
      <div class="book-card-body">
        <h3>${escapeHtml(book.title)}</h3>
        <p class="book-author">${escapeHtml(book.author)}</p>
        <div class="book-meta">
          <span class="category-tag">${escapeHtml(book.category ?? 'uncategorised')}</span>
          <span class="availability">${availableLabel === 'Unlimited' ? '∞' : availableLabel} avail.</span>
        </div>
      </div>
    `;

    fragment.appendChild(bookCard);
  }

  catalogueContainer.appendChild(fragment);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function populateBorrowSelects() {
  const memberSelect = document.getElementById('member-id');
  const isbnSelect = document.getElementById('isbn');
  if (memberSelect === null || isbnSelect === null) {
    return;
  }

  const memberValue = memberSelect.value;
  const isbnValue = isbnSelect.value;

  if (memberSelect.tagName === 'SELECT') {
    memberSelect.innerHTML = [
      '<option value="">Select member…</option>',
      ...members.map((member) => (
        `<option value="${member.id}">#${member.id} — ${escapeHtml(member.name)} (${member.membershipType})</option>`
      ))
    ].join('');
    memberSelect.value = memberValue;
  }

  if (isbnSelect.tagName === 'SELECT') {
    isbnSelect.innerHTML = [
      '<option value="">Select book…</option>',
      ...books.map((book) => (
        `<option value="${escapeHtml(book.isbn)}">${escapeHtml(book.title)} (${escapeHtml(book.isbn)})</option>`
      ))
    ].join('');
    isbnSelect.value = isbnValue;
  }
}

export function handleBorrowSubmit(event) {
  event.preventDefault();

  const memberIdInput = document.getElementById('member-id');
  const isbnInput = document.getElementById('isbn');

  if (memberIdInput === null || isbnInput === null) {
    showToast('Borrow form fields are missing', 'error');
    return;
  }

  const rawId = memberIdInput.value.trim();
  const isbn = isbnInput.value.trim();

  if (!rawId || !isbn) {
    showToast('Member and book are required', 'error');
    return;
  }

  const memberId = Number.isNaN(Number(rawId)) ? rawId : Number(rawId);

  try {
    const success = borrowBook(memberId, isbn);
    if (success) {
      showToast('Book borrowed successfully');
      event.target.reset();
      saveToLocalStorage();
      loadCatalogue();
      updateStatisticsDisplay();
      renderMemberList();
    } else {
      showToast('Unable to borrow — check availability or limits', 'error');
    }
  } catch (error) {
    showToast(`Borrow failed: ${error.message}`, 'error');
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

  setActiveTab(button.id);

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
  showToast('Data exported to the JSON panel');
}

export function handleImportClick() {
  const input = document.getElementById('data-output');
  if (input === null || !input.value.trim()) {
    showToast('Paste JSON into the data area before importing', 'error');
    return;
  }

  const ok = importLibraryData(input.value);
  if (ok) {
    ensureBookCovers();
    saveToLocalStorage();
    loadCatalogue();
    updateStatisticsDisplay();
    renderMemberList();
    showToast('Library data imported');
  } else {
    showToast('Import failed — invalid JSON', 'error');
  }
}

function handleResetDemo() {
  const confirmed = window.confirm('Reset catalogue and members to demo data? This replaces current local data.');
  if (!confirmed) {
    return;
  }
  clearLibrary();
  localStorage.removeItem('libraryBooks');
  localStorage.removeItem('libraryMembers');
  seedDemoData();
  saveToLocalStorage();
  loadCatalogue();
  updateStatisticsDisplay();
  createMemberForm();
  renderMemberList();
  showToast('Demo data restored');
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

  const availableLabel = book instanceof DigitalBook ? 'Unlimited' : book.availableCopies;
  const html = `
    <div class="book-details">
      <img class="book-details-cover" src="${book.coverUrl || ''}" alt="Cover of ${escapeHtml(book.title)}" onerror="this.style.display='none'">
      <div class="book-details-copy">
        <p class="eyebrow">${book instanceof DigitalBook ? 'Digital edition' : 'Physical edition'}</p>
        <h2>${escapeHtml(book.title)}</h2>
        <p><strong>Author:</strong> ${escapeHtml(book.author)}</p>
        <p><strong>ISBN:</strong> ${escapeHtml(book.isbn)}</p>
        <p><strong>Year:</strong> ${book.year}</p>
        <p><strong>Category:</strong> ${escapeHtml(book.category ?? 'n/a')}</p>
        <p><strong>Available:</strong> ${availableLabel}</p>
      </div>
    </div>
  `;

  detailsContainer.innerHTML = html;
  if (typeof detailsContainer.scrollIntoView === 'function') {
    detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
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

  const isEditing = editingMemberId !== null;
  const current = isEditing
    ? members.find((member) => member.id === editingMemberId)
    : null;

  formContainer.innerHTML = `
    <form id="add-member-form" class="member-form">
      <div class="form-heading">
        <h3>${isEditing ? 'Edit member' : 'Add member'}</h3>
        <p>${isEditing ? `Updating #${editingMemberId}` : 'Create a standard or premium account'}</p>
      </div>
      <label for="name">Name</label>
      <input type="text" id="name" name="name" placeholder="Full name" required value="${escapeHtml(current?.name ?? '')}">
      <label for="email">Email</label>
      <input type="email" id="email" name="email" placeholder="email@example.com" required value="${escapeHtml(current?.email ?? '')}">
      <label for="membership-type">Membership</label>
      <select id="membership-type" name="membershipType">
        <option value="standard" ${current?.membershipType === 'standard' ? 'selected' : ''}>Standard (max 5 books)</option>
        <option value="premium" ${current?.membershipType === 'premium' ? 'selected' : ''}>Premium (max 10 books)</option>
      </select>
      <div class="form-actions">
        <button type="submit">${isEditing ? 'Save changes' : 'Add member'}</button>
        ${isEditing ? '<button type="button" id="cancel-edit" class="btn-secondary">Cancel</button>' : ''}
      </div>
    </form>
  `;

  const form = document.getElementById('add-member-form');
  if (form !== null) {
    form.addEventListener('submit', handleMemberFormSubmit);
  }

  const cancelBtn = document.getElementById('cancel-edit');
  if (cancelBtn !== null) {
    cancelBtn.addEventListener('click', () => {
      editingMemberId = null;
      createMemberForm();
    });
  }
}

function handleMemberFormSubmit(event) {
  event.preventDefault();

  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const typeInput = document.getElementById('membership-type');

  if (nameInput === null || emailInput === null || typeInput === null) {
    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const membershipType = typeInput.value;

  try {
    if (editingMemberId !== null) {
      const updated = editMember(editingMemberId, { name, email, membershipType });
      if (!updated) {
        showToast('Member not found', 'error');
        return;
      }
      showToast('Member updated');
      editingMemberId = null;
    } else {
      addMember(name, email, membershipType);
      showToast('Member added');
    }

    saveToLocalStorage();
    createMemberForm();
    renderMemberList();
    updateStatisticsDisplay();
    populateBorrowSelects();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export function renderMemberList() {
  const list = document.getElementById('member-list');
  if (list === null) {
    return;
  }

  if (members.length === 0) {
    list.innerHTML = '<p class="empty-state">No members yet. Add one using the form.</p>';
    return;
  }

  list.innerHTML = `
    <div class="member-grid">
      ${members.map((member) => `
        <article class="member-card" data-member-id="${member.id}">
          <div class="member-card-top">
            <div>
              <h3>${escapeHtml(member.name)}</h3>
              <p class="member-email">${escapeHtml(member.email)}</p>
            </div>
            <span class="member-type member-type-${member.membershipType}">${member.membershipType}</span>
          </div>
          <dl class="member-stats">
            <div>
              <dt>ID</dt>
              <dd>${member.id}</dd>
            </div>
            <div>
              <dt>Borrowed</dt>
              <dd>${member.borrowedBooks.length}</dd>
            </div>
            <div class="member-tenure">
              <dt>Membership</dt>
              <dd>${formatMembershipTenure(member.getMembershipDuration())}</dd>
            </div>
          </dl>
          <div class="member-actions">
            <button type="button" class="btn-secondary" data-action="edit" data-member-id="${member.id}">Edit</button>
            <button type="button" class="btn-danger" data-action="delete" data-member-id="${member.id}">Delete</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

/** Event delegation for edit / delete on dynamic member cards. */
export function handleMemberListClick(event) {
  const button = event.target.closest('button[data-action]');
  if (button === null) {
    return;
  }

  const action = button.dataset.action;
  const rawId = button.dataset.memberId;
  const memberId = Number.isNaN(Number(rawId)) ? rawId : Number(rawId);

  if (action === 'edit') {
    editingMemberId = memberId;
    createMemberForm();
    const form = document.getElementById('member-form');
    if (form !== null && typeof form.scrollIntoView === 'function') {
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }

  if (action === 'delete') {
    const member = members.find((item) => item.id === memberId);
    const label = member ? member.name : `member #${memberId}`;
    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const removed = deleteMember(memberId);
    if (!removed) {
      showToast('Member not found', 'error');
      return;
    }

    if (editingMemberId === memberId) {
      editingMemberId = null;
      createMemberForm();
    }

    saveToLocalStorage();
    renderMemberList();
    updateStatisticsDisplay();
    populateBorrowSelects();
    showToast('Member deleted');
  }
}

// Correct bootstrap: wait for DOMContentLoaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializeUI);
}
