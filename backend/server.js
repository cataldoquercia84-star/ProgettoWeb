// ====================================================================
// FILE: server.js
// DESCRIZIONE: Backend Express con validazione password complessa
// ====================================================================

// ==============================================
// SECTION 1: IMPORT DEI MODULI
// ==============================================

const express = require("express");     
// express: framework web per Node.js, mi serve per creare le rotte API
// e gestire le richieste HTTP (GET, POST, DELETE, ecc.)

const cors = require("cors");           
// cors: middleware che permette al frontend (che gira su un'altra porta)
// di fare richieste al backend senza problemi di sicurezza

const bcrypt = require("bcrypt");       
// bcrypt: libreria per criptare le password prima di salvarle nel database
// uso hashSync() e hash() con 10 round di crittografia

const db = require("./db");             
// db: è il file db.js che ho creato io, contiene la connessione a SQLite
// e la creazione delle tabelle

const multer = require("multer");       
// multer: middleware per gestire l'upload di file (le immagini dei libri)

const path = require("path");           
// path: modulo nativo di Node.js che mi aiuta a creare percorsi validi
// sia su Windows che su Linux/Mac

// ==============================================
// SECTION 2: CONFIGURAZIONE EXPRESS
// ==============================================

const app = express();                  
// app: è la mia applicazione Express, su di essa attacco middleware e rotte

app.use(cors());                        
// dico a Express di usare CORS, così il frontend può chiamare il backend

app.use(express.json());                
// dico a Express di parsare automaticamente il body delle richieste in JSON
// se non mettessi questa riga, req.body sarebbe undefined

app.use("/uploads", express.static("uploads"));
// rendo pubblica la cartella "uploads" all'indirizzo /uploads
// esempio: se ho un file uploads/foto.jpg, si può vedere su http://localhost:3000/uploads/foto.jpg
app.use(express.static(path.join(__dirname, "..", "frontend")));
// ==============================================
// SECTION 3: CONFIGURAZIONE MULTER PER LE IMMAGINI
// ==============================================

const storage = multer.diskStorage({
  // storage: oggetto che dice a multer dove e come salvare i file
  
  destination: "uploads/",
  // destination: cartella dove vengono salvati i file caricati
  // se la cartella non esiste, multer la crea da solo
  
  filename: (req, file, cb) => {
    // filename: funzione che genera il nome del file salvato
    // req: la richiesta HTTP originale
    // file: informazioni sul file caricato
    // cb: callback che devo chiamare per passare il nome a multer
    
    const nomeUnico = Date.now() + path.extname(file.originalname);
    // Date.now(): numero di millisecondi dal 1970, garantisce unicità
    // path.extname(): estrae l'estensione del file (.jpg, .png, ecc.)
    // esempio: se carico "foto.jpg", diventa "1703123456789.jpg"
    
    cb(null, nomeUnico);
    // cb(null, nome): primo parametro null significa nessun errore
    // secondo parametro è il nome che voglio dare al file
  }
});

const upload = multer({ storage });
// upload: middleware pronto per essere usato nelle rotte che ricevono file
// uso upload.single("image") per prendere un solo file chiamato "image"

// ==============================================
// SECTION 4: FUNZIONE DI VALIDAZIONE PASSWORD
// ==============================================

function validatePassword(password) {
  // validatePassword: controlla che la password rispetti tutti i requisiti
  // restituisce true se OK, false se sbagliata
  
  if (password.length < 8) return false;
  // primo controllo: lunghezza minima 8 caratteri
  
  if (!/[A-Z]/.test(password)) return false;
  // secondo controllo: almeno una lettera maiuscola
  // .test() restituisce true se trova almeno una corrispondenza
  // ! nega, quindi se NON trova maiuscola -> false
  
  if (!/[a-z]/.test(password)) return false;
  // terzo controllo: almeno una lettera minuscola
  
  if (!/[0-9]/.test(password)) return false;
  // quarto controllo: almeno un numero
  
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  // quinto controllo: almeno un carattere speciale
  // [^A-Za-z0-9] significa: qualsiasi carattere che NON è lettera e NON è numero
  
  return true;
  // passati tutti i controlli, password valida
}

// ==============================================
// SECTION 5: API REGISTRAZIONE (POST /register)
// ==============================================

app.post("/register", async (req, res) => {
  // rotta per creare un nuovo account
  // async perché uso await per le operazioni sul database
  // req contiene i dati inviati dal frontend
  // res è l'oggetto che uso per rispondere al frontend
  
  const { user, password } = req.body;
  // destrutturazione: estraggo user e password dall'oggetto req.body
  // esempio: se req.body = { user: "Mario", password: "123" }
  // allora user = "Mario", password = "123"
  
  if (!user || !password) {
    // controllo se user o password sono vuoti/undefined
    return res.status(400).json({ error: "Username e password richiesti" });
    // status(400): Bad Request - il client ha inviato dati sbagliati
    // json(): invia una risposta in formato JSON
    // return: interrompe l'esecuzione della funzione
  }
  
  if (!validatePassword(password)) {
    // se la password non supera la validazione
    return res.status(400).json({ error: "La password deve avere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale." });
  }
  
  try {
    // try-catch: se qualcosa va male, catturo l'errore e non faccio crashare il server
    
    const existing = await new Promise((resolve, reject) => {
      // new Promise: converto una funzione callback in una Promise (così posso usare await)
      // db.get() è asincrono e usa callback, lo converto in Promise
      
      db.get("SELECT id FROM users WHERE user = ?", [user], (err, row) => {
        // db.get(): prende una sola riga dal database
        // "SELECT id FROM users WHERE user = ?": query SQL
        // ? è un placeholder, viene sostituito con il valore nell'array [user]
        // questo previene SQL injection
        
        if (err) reject(err);
        // se c'è errore, chiamo reject() che manda l'errore al catch
        
        else resolve(row);
        // se tutto ok, chiamo resolve() con il risultato (row)
        // row è undefined se non trova l'utente, altrimenti è l'oggetto utente
      });
    });
    
    if (existing) {
      // se existing non è undefined, significa che l'username esiste già
      return res.status(409).json({ error: "Username già esistente" });
      // 409 Conflict: l'utente sta cercando di creare qualcosa che già esiste
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    // bcrypt.hash(): cripta la password con 10 round (standard di sicurezza)
    // restituisce una stringa come: "$2b$10$...lunga stringa..."
    // questa stringa contiene: algoritmo, costo (10), salt, e hash finale
    
    await new Promise((resolve, reject) => {
      // un'altra Promise per db.run() (che esegue una query senza risultato)
      
      db.run(
        "INSERT INTO users (user, password, role, temp_password) VALUES (?, ?, ?, ?)",
        [user, hashedPassword, "user", 0],
        // user: lo username inserito
        // hashedPassword: la password criptata
        // "user": ruolo di default (non admin)
        // 0: temp_password = 0, significa password normale, non temporanea
        
        function(err) {
          // function normale (non arrow) per poter usare this.lastID
          if (err) reject(err);
          else resolve(this.lastID);
          // this.lastID: SQLite restituisce l'ID generato automaticamente per il nuovo record
        }
      );
    });
    
    res.json({ success: true });
    // successo: rispondo con { success: true } al frontend
    
  } catch (err) {
    console.error(err);
    // stampo l'errore in console per debug
    
    res.status(500).json({ error: "Errore interno" });
    // 500 Internal Server Error: errore del server
  }
});

// ==============================================
// SECTION 6: API LOGIN (POST /login)
// ==============================================

app.post("/login", (req, res) => {
  // NOTA: non ho messo async qui perché uso db.get con callback
  // invece di convertire tutto in Promise
  // è un modo diverso di scrivere la stessa cosa
  
  const { user, password } = req.body;
  
  db.get("SELECT * FROM users WHERE user = ?", [user], async (err, utente) => {
    // SELECT * prende tutte le colonne dell'utente
    // async nella callback perché dentro uso await bcrypt.compare
    
    if (err) {
      return res.status(500).json({ error: "Errore database" });
    }
    
    if (!utente) {
      // utente undefined = username non trovato
      return res.status(401).json({ error: "Credenziali non valide" });
      // 401 Unauthorized: credenziali sbagliate
      // non specifico se è username o password per sicurezza
    }
    
    const match = await bcrypt.compare(password, utente.password);
    // bcrypt.compare(): confronta la password in chiaro (password)
    // con l'hash salvato (utente.password)
    // restituisce true se coincidono, false altrimenti
    
    if (!match) {
      return res.status(401).json({ error: "Credenziali non valide" });
    }
    
    if (utente.temp_password === 1) {
      // temp_password === 1 significa che questa password è temporanea
      // l'utente deve cambiarla subito
      
      return res.json({
        id: utente.id,
        user: utente.user,
        role: utente.role,
        needsPasswordChange: true
        // needsPasswordChange: true = avviso il frontend di mostrare il modale
      });
    }
    
    // login normale, password definitiva
    res.json({
      id: utente.id,
      user: utente.user,
      role: utente.role
      // non mando la password né altri dati sensibili
    });
  });
});

// ==============================================
// SECTION 7: API REQUEST RESET (POST /request-reset)
// ==============================================

app.post("/request-reset", async (req, res) => {
  // richiesta di reset password: genera una password temporanea
  
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: "Username richiesto" });
  }
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM users WHERE user = ?", [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      return res.status(404).json({ error: "Username non trovato" });
      // 404 Not Found
    }
    
    const tempPassword = Math.random().toString(36).slice(-8);
    // Math.random(): numero casuale tra 0 e 0.999...
    // .toString(36): converto in base36 (0-9a-z)
    // .slice(-8): prendo gli ultimi 8 caratteri
    // esempio: 0.123456 -> "0.4f3g2h1" -> "0.4f3g2h1" -> slice(-8) = "4f3g2h1"
    // risultato: 8 caratteri alfanumerici casuali
    
    const hashedTemp = await bcrypt.hash(tempPassword, 10);
    // cripto la password temporanea prima di salvarla
    
    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET password = ?, temp_password = 1 WHERE id = ?",
        [hashedTemp, user.id],
        // UPDATE: modifico la password e imposto temp_password = 1
        
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    res.json({ success: true, tempPassword });
    // attenzione: mando la password IN CHIARO al frontend
    // è l'unica volta che l'utente può vederla
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante il reset" });
  }
});

// ==============================================
// SECTION 8: API CHANGE PASSWORD (POST /change-password)
// ==============================================

app.post("/change-password", async (req, res) => {
  // cambio password dopo che l'utente ha usato quella temporanea
  // o cambio volontario
  
  const { userId, newPassword } = req.body;
  
  if (!userId || !newPassword) {
    return res.status(400).json({ error: "Dati non validi" });
  }
  
  if (!validatePassword(newPassword)) {
    // stesso controllo della registrazione
    return res.status(400).json({ error: "La password deve avere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale." });
  }
  
  try {
    const hashedNew = await bcrypt.hash(newPassword, 10);
    
    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET password = ?, temp_password = 0 WHERE id = ?",
        [hashedNew, userId],
        // temp_password = 0: questa è una password definitiva
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    res.json({ success: true });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante il cambio password" });
  }
});

// ==============================================
// SECTION 9: API LIBRI (GET /books)
// ==============================================

app.get("/books", (req, res) => {
  // rotta pubblica: chiunque può vedere i libri
  
  db.all("SELECT * FROM books", [], (err, rows) => {
    // db.all(): restituisce TUTTE le righe che corrispondono alla query
    // []: array vuoto perché non ho placeholder nella query
    // rows: array di oggetti, ogni oggetto è un libro
    
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json(rows);
    // mando l'array completo al frontend
  });
});

// ==============================================
// SECTION 10: API PRESTITO (POST /borrow)
// ==============================================

app.post("/borrow", (req, res) => {
  // quando un utente vuole prendere un libro in prestito
  
  const { userId, bookId } = req.body;
  
  // controllo 1: l'utente esiste e non è admin?
  db.get("SELECT role FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: "Utente non trovato" });
    if (user.role === "admin") {
      return res.status(403).json({ error: "L'admin non può prendere libri in prestito" });
      // 403 Forbidden: permesso negato
    }
    
    // controllo 2: ha già questo libro in prestito?
    db.get("SELECT id FROM loans WHERE userId = ? AND bookId = ?", [userId, bookId], (err, loan) => {
      if (err) return res.status(500).json({ error: err.message });
      if (loan) {
        return res.status(400).json({ error: "Hai già questo libro in prestito" });
      }
      
      // controllo 3: ci sono copie disponibili?
      db.get("SELECT copies FROM books WHERE id = ?", [bookId], (err, book) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!book || book.copies <= 0) {
          return res.status(400).json({ error: "Copie esaurite" });
        }
        
        // tutto ok, procedo con il prestito
        
        const startDate = new Date().toISOString();
        // new Date(): data e ora attuale
        // .toISOString(): formatta come "2026-01-15T10:30:00.000Z"
        // formato standard ISO 8601, leggibile e ordinabile
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        // prendo la data attuale e aggiungo 30 giorni
        
        db.serialize(() => {
          // serialize(): esegue le query in sequenza, una dopo l'altra
          // garantisce che prima si decrementano le copie e poi si inserisce il prestito
          
          db.run("UPDATE books SET copies = copies - 1 WHERE id = ?", [bookId]);
          // decremento le copie disponibili di 1
          
          db.run(
            "INSERT INTO loans (userId, bookId, startDate, dueDate) VALUES (?, ?, ?, ?)",
            [userId, bookId, startDate, dueDate.toISOString()],
            (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ success: true });
            }
          );
        });
      });
    });
  });
});

// ==============================================
// SECTION 11: API RESTITUZIONE (POST /return)
// ==============================================

app.post("/return", (req, res) => {
  // restituzione di un libro
  
  const { userId, bookId } = req.body;
  
  db.serialize(() => {
    // prima: elimino il record del prestito
    db.run("DELETE FROM loans WHERE userId = ? AND bookId = ?", [userId, bookId]);
    
    // poi: incremento le copie disponibili di 1
    db.run("UPDATE books SET copies = copies + 1 WHERE id = ?", [bookId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ==============================================
// SECTION 12: API PRESTITI DI UN UTENTE (GET /loans/:userId)
// ==============================================

app.get("/loans/:userId", (req, res) => {
  // :userId è un parametro dinamico
  // esempio: /loans/5 -> userId = 5
  
  const { userId } = req.params;
  // req.params contiene i parametri dinamici
  // se la rotta è /loans/:userId, allora req.params.userId = valore
  
  db.all(
    `SELECT loans.*, books.title, books.author, books.image 
     FROM loans 
     JOIN books ON loans.bookId = books.id 
     WHERE loans.userId = ?`,
    // JOIN: unisco la tabella loans con books
    // ON loans.bookId = books.id: la colonna bookId di loans si riferisce a id di books
    // così posso prendere titolo, autore e immagine dal libro
    
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ==============================================
// SECTION 13: API ADMIN - LISTA UTENTI (GET /admin/users)
// ==============================================

app.get("/admin/users", (req, res) => {
  // solo per admin (ma il middleware di autenticazione non l'ho implementato per semplicità)
  
  db.all("SELECT id, user, role FROM users", [], (err, rows) => {
    // prendo solo id, user, role, escludo password e temp_password per sicurezza
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==============================================
// SECTION 14: API ADMIN - AGGIUNTA LIBRO (POST /admin/addBook)
// ==============================================

app.post("/admin/addBook", upload.single("image"), (req, res) => {
  // upload.single("image"): middleware che processa il file chiamato "image"
  // il file sarà disponibile in req.file
  
  const { title, author, copies } = req.body;
  // req.body contiene i campi di testo (title, author, copies)
  
  let image = "/uploads/default.jpg";
  // immagine di default se non viene caricata nessuna foto
  
  if (req.file) {
    image = `/uploads/${req.file.filename}`;
    // req.file.filename è il nome generato da multer (es: 1703123456789.jpg)
  }
  
  if (!title || !author || !copies) {
    return res.status(400).json({ error: "Tutti i campi testuali sono richiesti" });
  }
  
  db.run(
    "INSERT INTO books(title, author, copies, image) VALUES (?, ?, ?, ?)",
    [title, author, parseInt(copies), image],
    // parseInt(copies): converto la stringa in numero intero
    
    function(err) {
      if (err) return res.status(500).json({ error: "Errore nell'inserimento" });
      res.json({ success: true });
    }
  );
});

// ==============================================
// SECTION 15: API ADMIN - AGGIUNTA COPIE (POST /admin/addCopies)
// ==============================================

app.post("/admin/addCopies", (req, res) => {
  const { bookId, copies } = req.body;
  
  db.run("UPDATE books SET copies = copies + ? WHERE id = ?", [copies, bookId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ==============================================
// SECTION 16: API ADMIN - RIMOZIONE COPIE (POST /admin/removeCopies)
// ==============================================

app.post("/admin/removeCopies", (req, res) => {
  const { bookId, copies } = req.body;
  
  // controllo preventivo: non posso avere copie negative
  db.get("SELECT copies FROM books WHERE id = ?", [bookId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Libro non trovato" });
    
    if (row.copies - copies < 0) {
      return res.status(400).json({ error: "Non puoi rimuovere più copie di quelle disponibili" });
    }
    
    db.run("UPDATE books SET copies = copies - ? WHERE id = ?", [copies, bookId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ==============================================
// SECTION 17: API ADMIN - ELIMINA LIBRO (DELETE /admin/deleteBook)
// ==============================================


app.delete("/admin/deleteBook", (req, res) => {
  const { bookId } = req.body;

  db.run("UPDATE books SET copies = 0 WHERE id = ?", [bookId], function (err) {
    if (err) return res.status(500).json({ error: err.message });

    if (this.changes === 0) {
      return res.status(404).json({ error: "Libro non trovato" });
    }

    res.json({ success: true });
  });
});

/*
  db.serialize(() => {
    // prima elimino tutti i prestiti associati a questo libro
    db.run("DELETE FROM loans WHERE bookId = ?", [bookId]);
    
    // poi elimino il libro stesso
    db.run("DELETE FROM books WHERE id = ?", [bookId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (this.changes === 0) {
        // this.changes: numero di righe modificate dall'ultima query
        // se 0, significa che il libro con quell'id non esisteva
        return res.status(404).json({ error: "Libro non trovato" });
      }
      
      res.json({ success: true });
    });
  });
});*/

// ==============================================
// SECTION 18: API ADMIN - TUTTI I PRESTITI (GET /admin/allLoans)
// ==============================================

app.get("/admin/allLoans", (req, res) => {
  db.all(
    `SELECT loans.*, books.title, users.user 
     FROM loans 
     JOIN books ON books.id = loans.bookId 
     JOIN users ON users.id = loans.userId`,
    // due JOIN: collego loans a books (per avere il titolo)
    // e loans a users (per avere il nome dell'utente)
    
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ==============================================
// SECTION 19: API ADMIN - STATISTICHE MENSILI (GET /admin/monthly-stats)
// ==============================================

app.get("/admin/monthly-stats", (req, res) => {
  const sql = `
    SELECT books.title, books.author, COUNT(loans.id) AS count
    FROM loans 
    JOIN books ON books.id = loans.bookId
    WHERE datetime(loans.startDate) >= datetime('now', '-30 days')
    GROUP BY loans.bookId 
    ORDER BY count DESC 
    LIMIT 5
  `;
  // spiego la query:
  // COUNT(loans.id): conta quanti prestiti ci sono per ogni libro
  // WHERE startDate >= oggi - 30 giorni: solo prestiti dell'ultimo mese
  // GROUP BY bookId: raggruppa per libro, così il COUNT è per libro
  // ORDER BY count DESC: ordina dal più prestato al meno prestato
  // LIMIT 5: prendo solo i primi 5
  
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==============================================
// SECTION 20: AVVIO DEL SERVER
// ==============================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Ascolto della porta configurata dal terminale o default 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server attivo su http://localhost:" + PORT);
});
