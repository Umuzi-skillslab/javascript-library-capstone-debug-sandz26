/**
 * Persistence helpers: JSON serialisation and localStorage.
 * Module 3 of 3+ — isolates storage concerns from domain logic.
 */

import { books, members, setBooks, setMembers } from './library.js';

/**
 * Export library state as a JSON string.
 * @returns {string}
 */
export function exportLibraryData() {
  try {
    const data = {
      books,
      members
    };
    return JSON.stringify(data);
  } catch (error) {
    console.error(`exportLibraryData failed: ${error.message}`);
    return '[]';
  }
}

/**
 * Import library state from a JSON string with validation.
 * @param {string} jsonString
 * @returns {boolean}
 */
export function importLibraryData(jsonString) {
  try {
    if (typeof jsonString !== 'string' || !jsonString.trim()) {
      throw new Error('jsonString must be a non-empty string');
    }

    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      throw new Error('Parsed data must be an object');
    }
    if (!Array.isArray(data.books) || !Array.isArray(data.members)) {
      throw new Error('books and members must be arrays');
    }

    setBooks(data.books);
    setMembers(data.members);
    return true;
  } catch (error) {
    console.error(`importLibraryData failed: ${error.message}`);
    return false;
  }
}

/**
 * Persist catalogue and members to localStorage.
 * @returns {boolean}
 */
export function saveToLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is unavailable');
    }

    localStorage.setItem('libraryBooks', JSON.stringify(books));
    localStorage.setItem('libraryMembers', JSON.stringify(members));
    return true;
  } catch (error) {
    console.error(`saveToLocalStorage failed: ${error.message}`);
    return false;
  }
}

/**
 * Load catalogue and members from localStorage.
 * @returns {boolean}
 */
export function loadFromLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is unavailable');
    }

    const booksData = localStorage.getItem('libraryBooks');
    const membersData = localStorage.getItem('libraryMembers');

    if (booksData === null || membersData === null) {
      return false;
    }

    const parsedBooks = JSON.parse(booksData);
    const parsedMembers = JSON.parse(membersData);

    if (!Array.isArray(parsedBooks) || !Array.isArray(parsedMembers)) {
      throw new Error('Stored library data is invalid');
    }

    setBooks(parsedBooks);
    setMembers(parsedMembers);
    return true;
  } catch (error) {
    console.error(`loadFromLocalStorage failed: ${error.message}`);
    return false;
  }
}
