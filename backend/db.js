// ====================================================================
// FILE: db.js
// DESCRIZIONE: Inizializzazione database SQLite
// ====================================================================

// -------------------- IMPORT MODULI --------------------
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

// -------------------- CONNESSIONE AL DATABASE --------------------
// Se database.db non esiste, SQLite lo crea automaticamente
const db = new sqlite3.Database("./database.db");

// -------------------- CREAZIONE TABELLE --------------------
db.serialize(() => {
  
  // Tabella UTENTI
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE,
    password TEXT,
    role TEXT,
    temp_password INTEGER DEFAULT 0
  )`);
  
  // Tabella LIBRI
  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    author TEXT,
    copies INTEGER,
    image TEXT
  )`);
  
  // Tabella PRESTITI
  db.run(`CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    bookId INTEGER,
    startDate TEXT,
    dueDate TEXT
  )`);
});

// -------------------- INSERIMENTO ADMIN DI DEFAULT --------------------
// Viene eseguito solo se non esiste già un utente chiamato "Admin"
const adminHash = bcrypt.hashSync("Admin$1234", 10);
db.run("INSERT OR IGNORE INTO users(user, password, role, temp_password) VALUES (?, ?, ?, ?)",
  ["Admin", adminHash, "admin", 0]);

// -------------------- INSERIMENTO LIBRI DI DEFAULT --------------------
// Controlla quanti libri ci sono già nel database
// Se la tabella è VUOTA (nessun libro), inserisce i libri di default
// Se CI SONO GIÀ LIBRI, non fa nulla (così non crea duplicati ad ogni riavvio)

db.get("SELECT COUNT(*) as count FROM books", [], (err, row) => {
  if (err) {
    console.error("Errore nel controllo dei libri esistenti:", err);
    return;
  }
  
  // Se la tabella è vuota (nessun libro)
  if (row.count === 0) {
    console.log("📚 Database vuoto. Inserimento libri di default...");
    
    const books = [
      ["Il Signore degli Anelli", "J.R.R. Tolkien", 5, "/uploads/book1.jpg"],
      ["1984", "George Orwell", 4, "/uploads/book2.jpg"],
      ["Orgoglio e Pregiudizio", "Jane Austen", 6, "/uploads/book3.jpg"],
      ["Moby Dick", "Herman Melville", 3, "/uploads/book4.jpg"],
      ["I Promessi Sposi", "Alessandro Manzoni", 7, "/uploads/book5.jpg"],
      ["Harry Potter - La pietra Filosofale", "J.K. Rowling", 8, "/uploads/book6.jpg"],
      ["Il Nome della Rosa", "Umberto Eco", 4, "/uploads/book7.jpg"],
      ["La Divina Commedia", "Dante Alighieri", 5, "/uploads/book8.jpg"],
      ["Il Piccolo Principe", "Antoine de Saint-Exupéry", 9, "/uploads/book9.jpg"],
      ["Sherlock Holmes - Uno studio in rosso", "Arthur Conan Doyle", 6, "/uploads/book10.jpg"]
    ];
    
    // Inserisco ogni libro nel database
    books.forEach((book, index) => {
      db.run("INSERT INTO books(title, author, copies, image) VALUES (?, ?, ?, ?)", 
        book,
        (insertErr) => {
          if (insertErr) {
            console.error(`Errore nell'inserimento del libro "${book[0]}":`, insertErr);
          } else if (index === books.length - 1) {
            console.log(`✅ Inseriti ${books.length} libri di default.`);
          }
        }
      );
    });
  } else {
    // Se ci sono già libri, mostro quanti sono e non faccio nulla
    console.log(`📖 Trovati ${row.count} libri nel database. Nessun inserimento automatico.`);
  }
});

// -------------------- ESPORTAZIONE --------------------
module.exports = db;