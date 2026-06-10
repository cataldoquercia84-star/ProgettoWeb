// ====================================================================
// FILE: app.js
// DESCRIZIONE: Logica front-end per biblioteca digitale
// ====================================================================

// -------------------- CONFIGURAZIONE --------------------

const API_URL = (window.location.protocol === "file:" || window.location.port === "5500" || window.location.port === "5501")
  ? "http://localhost:3000" 
  : window.location.origin;

let currentUser = null;           // utente loggato (null se nessuno)

let currentSlideIndex = 0;        // indice della slide corrente nel carosello
let booksCache = [];               // copia locale dei libri per non rifare fetch
let autoSlideInterval = null;      // timer per scorrimento automatico
let hoverAttached = false;         // evita di attaccare l'evento hover più volte

let currentSortField = "title";    // campo per ordinamento: "title" o "author"
let currentSortDir = "asc";        // direzione: "asc" crescente, "desc" decrescente
let currentAdminSortField = "title";
let currentAdminSortDir = "asc";

// -------------------------------------------------------------------
// getDaysRemaining(dueDate)
// Calcola i giorni rimanenti alla scadenza di un prestito
// dueDate: stringa ISO "2025-01-15T10:30:00Z"
// Restituisce numero intero (negativo se scaduto)
// -------------------------------------------------------------------
function getDaysRemaining(dueDate) {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// -------------------------------------------------------------------
// getStatusColor(daysRemaining)
// Restituisce la classe CSS per colorare il bordo della card prestito
// -------------------------------------------------------------------
function getStatusColor(daysRemaining) {
  if (daysRemaining < 0) return "scaduto";
  if (daysRemaining <= 5) return "urgente";
  if (daysRemaining <= 10) return "attenzione";
  return "ok";
}

// -------------------------------------------------------------------
// getStatusText(daysRemaining)
// Restituisce il testo da mostrare per la scadenza (es. "⚠️ SCADUTO!")
// -------------------------------------------------------------------
function getStatusText(daysRemaining) {
  if (daysRemaining < 0) return "⚠️ SCADUTO!";
  if (daysRemaining === 0) return "⚠️ Scade OGGI!";
  if (daysRemaining === 1) return "⚠️ Scade domani!";
  return `📅 ${daysRemaining} giorni rimanenti`;
}

// -------------------------------------------------------------------
// escapeHtml(str)
// PREVIENE ATTACCHI XSS: sostituisce caratteri pericolosi con entità HTML
// Esempio: "<script>" diventa "&lt;script&gt;"
// -------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// -------------------------------------------------------------------
// validatePassword(password)
// Verifica i requisiti: almeno 8 caratteri, maiuscola, minuscola, numero, carattere speciale
// STESSA LOGICA DEL BACKEND (server.js) - devono combaciare!
// -------------------------------------------------------------------
function validatePassword(password) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

// Mostra la password mentre tieni premuto
function showPassword(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.type = "text";
}

// Nasconde la password quando rilasci
function hidePassword(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.type = "password";
}

// -------------------------------------------------------------------
// RIFERIMENTI AGLI ELEMENTI DOM
// Raccogliamo tutti gli elementi HTML in un unico oggetto "els"
// Così se cambio un id, lo cambio solo qui
// -------------------------------------------------------------------
const els = {
  loginPanel: document.getElementById("login-panel"),
  registerPanel: document.getElementById("register-panel"),
  booksSection: document.getElementById("books-section"),
  booksList: document.getElementById("books-list"),
  loansSection: document.getElementById("loans-section"),
  loansList: document.getElementById("loans-list"),
  adminSection: document.getElementById("admin-section"),
  adminLoansList: document.getElementById("admin-loans-list"),
  adminStats: document.getElementById("admin-stats"),
  adminTopBorrowed: document.getElementById("admin-top-borrowed"),
  adminUsersList: document.getElementById("admin-users-list"),
  serverStatus: document.getElementById("server-status"),
  welcomeMsg: document.getElementById("welcome-message"),
  authButton: document.getElementById("auth-button"),
  loginUser: document.getElementById("login-user"),
  loginPass: document.getElementById("login-password"),
  regUser: document.getElementById("register-user"),
  regPass: document.getElementById("register-password"),
  newTitle: document.getElementById("new-title"),
  newAuthor: document.getElementById("new-author"),
  newCopies: document.getElementById("new-copies"),
  newImage: document.getElementById("new-image")
};

// -------------------------------------------------------------------
// clearForms()
// Svuota i campi dei form di login e registrazione
// -------------------------------------------------------------------
function clearForms() {
  if (els.loginUser) els.loginUser.value = "";
  if (els.loginPass) els.loginPass.value = "";
  if (els.regUser) els.regUser.value = "";
  if (els.regPass) els.regPass.value = "";
}

// -------------------------------------------------------------------
// checkServer()
// Verifica periodicamente (ogni 3 secondi) se il backend è online
// Aggiorna l'indicatore verde/rosso nella barra superiore
// -------------------------------------------------------------------
async function checkServer() {
  try {
    const res = await fetch(`${API_URL}/books`);
    if (!res.ok) throw new Error();
    els.serverStatus.textContent = "Server Online";
    els.serverStatus.className = "server-online";
  } catch {
    els.serverStatus.textContent = "Server Offline";
    els.serverStatus.className = "server-offline";
  }
}
setInterval(checkServer, 3000);
checkServer();

// -------------------------------------------------------------------
// toggleLoginPanel()
// Mostra il pannello login e nasconde quello di registrazione
// -------------------------------------------------------------------
function toggleLoginPanel() {
  els.loginPanel.classList.toggle("hidden");
  els.registerPanel.classList.add("hidden");
  clearForms();
}

// -------------------------------------------------------------------
// showLogin()
// Mostra solo il pannello login
// -------------------------------------------------------------------
function showLogin() {
  els.loginPanel.classList.remove("hidden");
  els.registerPanel.classList.add("hidden");
  clearForms();
}

// -------------------------------------------------------------------
// showRegister()
// Mostra solo il pannello registrazione
// -------------------------------------------------------------------
function showRegister() {
  els.loginPanel.classList.add("hidden");
  els.registerPanel.classList.remove("hidden");
  clearForms();
}

// -------------------------------------------------------------------
// logout()
// Termina la sessione, resetta l'interfaccia e torna al carosello pubblico
// -------------------------------------------------------------------
function logout() {
  currentUser = null;
  clearForms();
  els.loginPanel.classList.add("hidden");
  els.registerPanel.classList.add("hidden");
  els.loansSection.classList.add("hidden");
  els.adminSection.classList.add("hidden");
  els.booksSection.classList.remove("hidden");
  els.authButton.textContent = "Accedi";
  els.welcomeMsg.classList.add("hidden");
  
  const existingUserDiv = document.querySelector(".books-user-list");
  if (existingUserDiv) existingUserDiv.remove();

  if (autoSlideInterval) clearInterval(autoSlideInterval);
  
  const publicCarousel = document.getElementById("public-carousel-container");
  if (publicCarousel) publicCarousel.style.display = "flex";
  const dotsContainer = document.querySelector(".scroll-dots-container");
  if (dotsContainer) dotsContainer.style.display = "flex";
  
  loadBooks();
}

// -------------------------------------------------------------------
// authAction()
// Gestisce il click sul bottone "Accedi/Logout" nella barra superiore
// -------------------------------------------------------------------
function authAction() {
  if (currentUser) logout();
  else toggleLoginPanel();
}

// -------------------------------------------------------------------
// showServerError()
// Mostra un alert rosso temporaneo in cima alla pagina
// -------------------------------------------------------------------
function showServerError() {
  const alertBox = document.createElement("div");
  alertBox.className = "server-alert";
  alertBox.innerHTML = `<strong>⚠ Server non raggiungibile</strong><br>Verifica lo stato del backend.`;
  document.body.prepend(alertBox);
  setTimeout(() => alertBox.remove(), 4000);
}

// -------------------------------------------------------------------
// sortBooksArray(books, field, direction)
// Funzione generica per ordinare un array di libri
// Crea una COPIA con spread [...books] per non modificare l'originale
// localeCompare() confronta stringhe in italiano (gestisce accenti)
// -------------------------------------------------------------------
function sortBooksArray(books, field, direction) {
  const sorted = [...books];
  sorted.sort((a, b) => {
    let valA = (field === "title") ? a.title : (a.author || "");
    let valB = (field === "title") ? b.title : (b.author || "");
    let comparison = valA.localeCompare(valB);
    return direction === "asc" ? comparison : -comparison;
  });
  return sorted;
}

// -------------------------------------------------------------------
// sortBooks(field, direction)
// Gestisce il click sui pulsanti di ordinamento nella sezione catalogo
// Aggiorna lo stile attivo e ricarica i libri
// -------------------------------------------------------------------
function sortBooks(field, direction) {
  currentSortField = field;
  currentSortDir = direction;
  document.querySelectorAll("#books-section .sort-btn").forEach(btn => {
    if (btn.dataset.sort === field && btn.dataset.dir === direction) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  if (!currentUser) loadBooks();
  else if (currentUser.role === "user") loadBooksUserView();
}

// -------------------------------------------------------------------
// sortAdminBooks(field, direction)
// Stessa cosa ma per la vista admin (ordinamento dell'inventario)
// -------------------------------------------------------------------
function sortAdminBooks(field, direction) {
  currentAdminSortField = field;
  currentAdminSortDir = direction;
  document.querySelectorAll("#admin-section .sort-btn.admin-sort").forEach(btn => {
    if (btn.dataset.sort === field && btn.dataset.dir === direction) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  loadAdminInventory();
}

// -------------------------------------------------------------------
// showTempPasswordModal(tempPassword)
// Mostra il modale con la password temporanea e la mette nell'input
// L'utente può copiarla con il bottone
// -------------------------------------------------------------------
function showTempPasswordModal(tempPassword) {
  const modal = document.getElementById("temp-password-modal");
  const input = document.getElementById("temp-password-display");
  if (input) input.value = tempPassword;
  if (modal) modal.style.display = "flex";
}

// -------------------------------------------------------------------
// closeTempPasswordModal()
// Chiude il modale della password temporanea
// -------------------------------------------------------------------
function closeTempPasswordModal() {
  const modal = document.getElementById("temp-password-modal");
  if (modal) modal.style.display = "none";
}

// -------------------------------------------------------------------
// requestPasswordReset()
// Chiede username, chiama /request-reset, mostra password generata
// Il backend crea password casuale: Math.random().toString(36).slice(-8)
// -------------------------------------------------------------------
async function requestPasswordReset() {
  const username = prompt("Inserisci il tuo username per recuperare la password:");
  if (!username || username.trim() === "") {
    alert("Username non valido.");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/request-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim() })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    showTempPasswordModal(data.tempPassword);
  } catch {
    showServerError();
  }
}

let pendingUserId = null;      // variabile temporanea per il cambio password
let pendingUserData = null;    // salva i dati dell'utente mentre cambia password

// -------------------------------------------------------------------
// showChangePasswordModal(userId, userData)
// Mostra il modale per cambiare password (dopo login con password temporanea)
// -------------------------------------------------------------------
function showChangePasswordModal(userId, userData) {
  pendingUserId = userId;
  pendingUserData = userData;
  const modal = document.getElementById("change-password-modal");
  if (modal) modal.style.display = "flex";
}

// -------------------------------------------------------------------
// submitPasswordChange()
// Invia la nuova password al backend con validazione lato client
// Se ok, chiude modale, pulisce i campi e fa logout (torna al login)
// -------------------------------------------------------------------
async function submitPasswordChange() {
  const newPassword = document.getElementById("new-password-input").value;
  const confirmPassword = document.getElementById("confirm-password-input").value;
  
  if (!validatePassword(newPassword)) {
    alert("La password deve avere almeno 8 caratteri, contenere maiuscola, minuscola, numero e carattere speciale.");
    return;
  }
  if (newPassword !== confirmPassword) {
    alert("Le password non coincidono.");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: pendingUserId, newPassword })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    alert("Password cambiata con successo! Ora puoi usare la nuova password per accedere.");
    document.getElementById("change-password-modal").style.display = "none";
    document.getElementById("new-password-input").value = "";
    document.getElementById("confirm-password-input").value = "";
    logout();
  } catch {
    showServerError();
  }
}

// -------------------------------------------------------------------
// login()
// Macro principale: invia credenziali al backend
// Se needsPasswordChange = true, apre modale cambio password
// Altrimenti salva currentUser e chiama renderUI()
// Supporta tasto Enter (vedi setupEnterKeySubmit)
// -------------------------------------------------------------------
async function login() {
  const username = els.loginUser.value.trim();
  const password = els.loginPass.value;
  if (!username || !password) {
    alert("Inserisci username e password");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: username, password })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    if (data.needsPasswordChange) {
      currentUser = { id: data.id, user: data.user, role: data.role };
      showChangePasswordModal(data.id, currentUser);
      els.loginPanel.classList.add("hidden");
      return;
    }
    currentUser = data;
    els.loginPanel.classList.add("hidden");
    els.registerPanel.classList.add("hidden");
    clearForms();
    els.authButton.textContent = "Logout";
    els.welcomeMsg.textContent = `👋 Benvenuto, ${currentUser.user}`;
    els.welcomeMsg.classList.remove("hidden");
    renderUI();
  } catch {
    showServerError();
  }
}

// -------------------------------------------------------------------
// register()
// Registra nuovo utente con validazione password complessa
// -------------------------------------------------------------------
async function register() {
  const username = els.regUser.value.trim();
  const password = els.regPass.value;
  if (!username || !password) {
    alert("Inserisci username e password");
    return;
  }
  if (!validatePassword(password)) {
    alert("La password deve avere almeno 8 caratteri, contenere maiuscola, minuscola, numero e carattere speciale.");
    return;
  }
  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: username, password })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    alert("Registrazione completata! Ora puoi accedere.");
    clearForms();
    showLogin();
  } catch {
    showServerError();
  }
}

// -------------------------------------------------------------------
// renderUI()
// Macro fondamentale: decide cosa mostrare in base all'utente loggato
// - Se !currentUser: carosello pubblico
// - Se admin: pannello admin (inventario, statistiche, utenti)
// - Se user: libri disponibili + prestiti attivi
// -------------------------------------------------------------------
function renderUI() {
  if (!currentUser) {
    els.booksSection.classList.remove("hidden");
    els.loansSection.classList.add("hidden");
    els.adminSection.classList.add("hidden");
    loadBooks();
  } else if (currentUser.role === "admin") {
    els.booksSection.classList.add("hidden");
    els.loansSection.classList.add("hidden");
    els.adminSection.classList.remove("hidden");
    loadAdminInventory();
    loadAdminStats();
    loadAdminUsers();
  } else {
    els.booksSection.classList.remove("hidden");
    els.loansSection.classList.remove("hidden");
    els.adminSection.classList.add("hidden");
    loadBooksUserView();
    loadLoans();
  }
}

// -------------------------------------------------------------------
// loadBooks()
// Carica i libri per il carosello (utente non loggato)
// Applica ordinamento, nasconde/mostra elementi, avvia scorrimento
// -------------------------------------------------------------------
async function loadBooks() {
  try {
    const res = await fetch(`${API_URL}/books`);
    let books = await res.json();
    booksCache = sortBooksArray(books, currentSortField, currentSortDir);
    const titleEl = document.getElementById("catalog-title");
    if (titleEl) titleEl.textContent = "📚 Esplora il nostro Catalogo";
    const container = document.querySelector(".carousel-container");
    if (container) container.style.display = "flex";
    const dotsContainer = document.querySelector(".scroll-dots-container");
    if (dotsContainer) dotsContainer.style.display = "flex";
    renderCarousel();
    setTimeout(() => renderScrollDots(), 50);
    setupAutoSlide();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// renderCarousel()
// Sotto-funzione: crea le card dei libri e le inserisce nel carosello
// Usa backgroundImage per mostrare la copertina
// -------------------------------------------------------------------
function renderCarousel() {
  els.booksList.innerHTML = "";
  booksCache.forEach(book => {
    const card = document.createElement("div");
    card.className = "item-card";
    const imgUrl = book.image ? `${API_URL}${book.image}` : `${API_URL}/uploads/default.jpg`;
    card.style.backgroundImage = `url('${imgUrl}')`;
    card.innerHTML = `
      <div class="book-overlay">
        <strong>${escapeHtml(book.title)}</strong>
        <small>${escapeHtml(book.author || "Autore sconosciuto")}</small>
        <span>📚 ${book.copies} copie disponibili</span>
      </div>
    `;
    els.booksList.appendChild(card);
  });
}

// -------------------------------------------------------------------
// loadBooksUserView()
// Vista utente loggato: mostra SOLO i libri NON già in prestito
// Calcola borrowedIds = array di id dei libri già presi in prestito
// Aggiunge classe "esaurito" se book.copies === 0
// -------------------------------------------------------------------
async function loadBooksUserView() {
  try {
    const res = await fetch(`${API_URL}/books`);
    let books = await res.json();
    books = sortBooksArray(books, currentSortField, currentSortDir);
    const loansRes = await fetch(`${API_URL}/loans/${currentUser.id}`);
    const userLoans = await loansRes.json();
    const borrowedIds = userLoans.map(l => l.bookId);
    const titleEl = document.getElementById("catalog-title");
    if (titleEl) titleEl.textContent = "📚 Libri Disponibili per il Prestito";
    const container = document.querySelector(".carousel-container");
    if (container) container.style.display = "none";
    const dotsContainer = document.querySelector(".scroll-dots-container");
    if (dotsContainer) dotsContainer.style.display = "none";
    const existingUserDiv = document.querySelector(".books-user-list");
    if (existingUserDiv) existingUserDiv.remove();
    const booksDiv = document.createElement("div");
    booksDiv.className = "books-user-list";
    books.forEach(book => {
      if (!borrowedIds.includes(book.id)) {
        const bookCard = document.createElement("div");
        bookCard.className = `loan-card ${book.copies === 0 ? "esaurito" : ""}`;
        const imgSrc = book.image ? `${API_URL}${book.image}` : `${API_URL}/uploads/default.jpg`;
        const disabled = book.copies > 0 ? "" : "disabled";
        bookCard.innerHTML = `
          <img src="${imgSrc}" class="book-thumbnail" alt="Copertina">
          <div class="book-info">
            <strong>${escapeHtml(book.title)}</strong><br>
            <small>${escapeHtml(book.author || "Autore sconosciuto")}</small><br>
            <span>📚 Disponibilità: ${book.copies} copie disponibili</span>
          </div>
          <button onclick="borrow(${book.id})" ${disabled}>
            ${book.copies > 0 ? "📖 Prenota" : "❌ Esaurito"}
          </button>
        `;
        booksDiv.appendChild(bookCard);
      }
    });
    els.booksSection.appendChild(booksDiv);
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// borrow(bookId)
// Prende in prestito un libro: chiama POST /borrow
// Decrementa le copie, crea un record in loans
// -------------------------------------------------------------------
async function borrow(bookId) {
  try {
    const res = await fetch(`${API_URL}/borrow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, bookId })
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    alert("Libro prenotato con successo!");
    await loadLoans();
    await loadBooksUserView();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// returnBook(bookId)
// Restituisce un libro: chiama POST /return
// Incrementa le copie, elimina il record in loans
// -------------------------------------------------------------------
async function returnBook(bookId) {
  try {
    await fetch(`${API_URL}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, bookId })
    });
    alert("Libro restituito con successo!");
    await loadLoans();
    await loadBooksUserView();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// loadLoans()
// Mostra i prestiti attivi dell'utente con stato e colore
// Usa getDaysRemaining, getStatusColor, getStatusText
// -------------------------------------------------------------------
async function loadLoans() {
  try {
    const res = await fetch(`${API_URL}/loans/${currentUser.id}`);
    const loans = await res.json();
    els.loansList.innerHTML = "";
    if (loans.length === 0) {
      els.loansList.innerHTML = "<p>📭 Non hai libri in prestito al momento.</p>";
    } else {
      loans.forEach(l => {
        const daysRemaining = getDaysRemaining(l.dueDate);
        const statusColor = getStatusColor(daysRemaining);
        const statusText = getStatusText(daysRemaining);
        const div = document.createElement("div");
        div.className = `loan-card loan-status-${statusColor}`;
        const imgSrc = l.image ? `${API_URL}${l.image}` : `${API_URL}/uploads/default.jpg`;
        div.innerHTML = `
          <img src="${imgSrc}" class="book-thumbnail" alt="Copertina">
          <div class="book-info">
            <strong>${escapeHtml(l.title)}</strong><br>
            <small>${escapeHtml(l.author)}</small><br>
            <span class="status-text" style="font-weight:bold;">${statusText}</span>
          </div>
          <button onclick="returnBook(${l.bookId})" style="background:#0d0d0d;">Restituisci</button>
        `;
        els.loansList.appendChild(div);
      });
    }
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// loadAdminInventory()
// Macro admin: mostra inventario completo con:
// - Info libro (titolo, autore, copie)
// - Bottoni +/- per aggiungere/rimuovere copie
// - Bottone elimina libro
// - Lista prestiti attivi per quel libro (con utente e scadenza)
// Promise.all() per fare due fetch in parallelo (più veloce)
// -------------------------------------------------------------------
async function loadAdminInventory() {
  try {
    const [booksRes, loansRes] = await Promise.all([
      fetch(`${API_URL}/books`),
      fetch(`${API_URL}/admin/allLoans`)
    ]);
    let books = await booksRes.json();
    books = sortBooksArray(books, currentAdminSortField, currentAdminSortDir);
    const loans = await loansRes.json();
    els.adminLoansList.innerHTML = "";
    if (books.length === 0) {
      els.adminLoansList.innerHTML = "<p>Nessun libro presente in inventario.</p>";
      return;
    }
    books.forEach(book => {
      const bookBlock = document.createElement("div");
      bookBlock.className = "admin-book-block";
      bookBlock.style.marginBottom = "25px";
      const imgSrc = book.image ? `${API_URL}${book.image}` : `${API_URL}/uploads/default.jpg`;
      const bookCard = document.createElement("div");
      bookCard.className = `loan-card ${book.copies === 0 ? "esaurito" : ""}`;
      bookCard.style.marginBottom = "8px";
      bookCard.innerHTML = `
        <img src="${imgSrc}" class="book-thumbnail" alt="Copertina">
        <div class="book-info">
          <strong>${escapeHtml(book.title)}</strong>
          <button class="delete-book-btn" onclick="deleteBook(${book.id})">🗑 Elimina</button>
          <br>
          <small>${escapeHtml(book.author || "Autore sconosciuto")}</small><br>
          <span>Disponibilità scaffale: <strong>${book.copies}</strong> copie in sede</span>
        </div>
        <div class="admin-box">
          <input type="number" id="add-qty-${book.id}" value="1" min="1" style="width:70px;">
          <button onclick="addCopies(${book.id})">➕ Rifornisci</button>
          <input type="number" id="remove-qty-${book.id}" value="1" min="1" style="width:70px;">
          <button class="remove-btn" onclick="removeCopies(${book.id})">➖ Rimuovi copia</button>
        </div>
      `;
      bookBlock.appendChild(bookCard);
      const subLoansContainer = document.createElement("div");
      subLoansContainer.className = "admin-sub-loans";
      const currentBookLoans = loans.filter(l => l.bookId === book.id);
      if (currentBookLoans.length > 0) {
        currentBookLoans.forEach(l => {
          const daysRemaining = getDaysRemaining(l.dueDate);
          const statusColor = getStatusColor(daysRemaining);
          const statusText = getStatusText(daysRemaining);
          const loanRow = document.createElement("div");
          loanRow.className = `sub-loan-row loan-status-${statusColor}`;
          loanRow.innerHTML = `
            <div class="book-info" style="font-size: 0.9em;">
              👤 In prestito a: <strong>${escapeHtml(l.user)}</strong> | <span class="status-text" style="font-weight:bold;">${statusText}</span>
              <br><small style="color: #666;">Scadenza: 📅 ${l.dueDate.slice(0, 10)}</small>
            </div>
          `;
          subLoansContainer.appendChild(loanRow);
        });
      } else {
        const noLoans = document.createElement("div");
        noLoans.className = "sub-loan-empty";
        noLoans.innerHTML = "✔ Nessun prestito attivo per questo titolo.";
        subLoansContainer.appendChild(noLoans);
      }
      bookBlock.appendChild(subLoansContainer);
      const separator = document.createElement("hr");
      separator.style.border = "0";
      separator.style.borderTop = "1px dashed #d6c7b2";
      separator.style.margin = "20px 0 10px 0";
      bookBlock.appendChild(separator);
      els.adminLoansList.appendChild(bookBlock);
    });
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// addNewBook()
// Aggiunge un nuovo libro usando FormData per l'upload dell'immagine
// -------------------------------------------------------------------
async function addNewBook() {
  const title = els.newTitle.value.trim();
  const author = els.newAuthor.value.trim();
  const copies = els.newCopies.value;
  const imageFile = els.newImage ? els.newImage.files[0] : null;
  if (!title || !author || !copies) {
    alert("Compila tutti i campi obbligatori!");
    return;
  }
  const formData = new FormData();
  formData.append("title", title);
  formData.append("author", author);
  formData.append("copies", copies);
  if (imageFile) formData.append("image", imageFile);
  try {
    const res = await fetch(`${API_URL}/admin/addBook`, { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    alert("Libro aggiunto con successo!");
    els.newTitle.value = "";
    els.newAuthor.value = "";
    els.newCopies.value = "1";
    if (els.newImage) els.newImage.value = "";
    loadAdminInventory();
    loadAdminStats();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// addCopies(bookId)
// Aggiunge copie a un libro esistente (POST /admin/addCopies)
// -------------------------------------------------------------------
async function addCopies(bookId) {
  const input = document.getElementById(`add-qty-${bookId}`);
  const qty = parseInt(input.value);
  if (isNaN(qty) || qty < 1) return alert("Inserisci una quantità valida");
  try {
    await fetch(`${API_URL}/admin/addCopies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, copies: qty })
    });
    alert("Inventario aggiornato!");
    loadAdminInventory();
    loadAdminStats();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// removeCopies(bookId)
// Rimuove copie da un libro (controlla che non vada in negativo)
// -------------------------------------------------------------------
async function removeCopies(bookId) {
  const input = document.getElementById(`remove-qty-${bookId}`);
  const qty = parseInt(input.value);
  if (isNaN(qty) || qty < 1) return alert("Inserisci una quantità valida");
  try {
    const booksRes = await fetch(`${API_URL}/books`);
    const books = await booksRes.json();
    const book = books.find(b => b.id === bookId);
    if (!book) return alert("Libro non trovato");
    if (book.copies - qty < 0) {
      alert(`Non puoi rimuovere ${qty} copie. Ce ne sono solo ${book.copies}.`);
      return;
    }
    await fetch(`${API_URL}/admin/removeCopies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, copies: qty })
    });
    alert("Copie rimosse con successo!");
    loadAdminInventory();
    loadAdminStats();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// deleteBook(bookId)
// Elimina un libro e tutti i prestiti associati (DELETE)
// Chiede conferma con confirm()
// -------------------------------------------------------------------
async function deleteBook(bookId) {
  if (!confirm("Eliminare tutte le copie del libro?")) return;
  try {
    await fetch(`${API_URL}/admin/deleteBook`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId })
    });
    alert("Copie azzerate.");
    loadAdminInventory();
    loadAdminStats();
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// loadAdminStats()
// Carica statistiche: numero libri, copie totali, prestiti attivi
// Poi i 5 libri più prestati nell'ultimo mese
// reduce() somma tutte le copie: (s, b) => s + b.copies
// -------------------------------------------------------------------
async function loadAdminStats() {
  try {
    const books = await (await fetch(`${API_URL}/books`)).json();
    const loans = await (await fetch(`${API_URL}/admin/allLoans`)).json();
    els.adminStats.innerHTML = `
      <p>📚 Titoli totali: <strong>${books.length}</strong></p>
      <p>📖 Copie totali: <strong>${books.reduce((s,b) => s + b.copies, 0)}</strong></p>
      <p>🔄 Prestiti attivi: <strong>${loans.length}</strong></p>
    `;
    const resTop = await fetch(`${API_URL}/admin/monthly-stats`);
    const topBooks = await resTop.json();
    if (els.adminTopBorrowed) {
      if (topBooks.length === 0) {
        els.adminTopBorrowed.innerHTML = "<p>Nessun prestito negli ultimi 30 giorni.</p>";
      } else {
        let html = "<ol>";
        topBooks.forEach(b => {
          html += `<li><strong>${escapeHtml(b.title)}</strong> (${escapeHtml(b.author)}) — 🔥 ${b.count} prestiti</li>`;
        });
        html += "</ol>";
        els.adminTopBorrowed.innerHTML = html;
      }
    }
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// loadAdminUsers()
// Carica lista di tutti gli utenti registrati (id, user, role)
// -------------------------------------------------------------------
async function loadAdminUsers() {
  try {
    const res = await fetch(`${API_URL}/admin/users`);
    const users = await res.json();
    if (els.adminUsersList) {
      if (users.length === 0) els.adminUsersList.innerHTML = "<p>Nessun utente registrato.</p>";
      else {
        let html = "";
        users.forEach(u => {
          html += `<div class="user-item"><span>👤 ${escapeHtml(u.user)}</span><span class="user-role">${u.role === "admin" ? "Amministratore" : "Utente"}</span></div>`;
        });
        els.adminUsersList.innerHTML = html;
      }
    }
  } catch { showServerError(); }
}

// -------------------------------------------------------------------
// togglePassword(id, btn)
// Mostra/nasconde la password nel campo input
// Cambia il testo del bottone da 👁 a 🙈
// -------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll(".show-pass-btn").forEach(btn => {

    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);

      const isHidden = input.type === "password";

      input.type = isHidden ? "text" : "password";

      btn.textContent = isHidden ? "🙈" : "👁";
    });

  });

});

// -------------------------------------------------------------------
// getCarouselLayout()
// Calcola layout del carosello: larghezza pagina, numero slide totali
// cardWidth + gap = spazio totale per card
// visibleCards = (carousel.clientWidth + gap) / (cardWidth + gap)
// -------------------------------------------------------------------
function getCarouselLayout() {
  const card = document.querySelector(".item-card");
  const carousel = els.booksList;
  if (!card || !carousel) return { pageWidth: 0, totalSlides: 1 };
  const cardWidth = card.offsetWidth;
  const gap = 20;
  const visibleCards = Math.floor((carousel.clientWidth + gap) / (cardWidth + gap)) || 1;
  const pageWidth = visibleCards * (cardWidth + gap);
  const totalSlides = Math.ceil(booksCache.length / visibleCards) || 1;
  return { pageWidth, totalSlides };
}

// -------------------------------------------------------------------
// renderScrollDots()
// Crea i pallini di navigazione sotto il carosello
// Un pallino per ogni pagina (slide group)
// -------------------------------------------------------------------
function renderScrollDots() {
  const dotsContainer = document.getElementById("scroll-dots");
  if (!dotsContainer) return;
  dotsContainer.innerHTML = "";
  const { totalSlides } = getCarouselLayout();
  if (totalSlides <= 1) return;
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement("div");
    dot.className = `scroll-dot ${i === currentSlideIndex ? "active" : ""}`;
    dot.onclick = () => scrollToIndex(i);
    dotsContainer.appendChild(dot);
  }
  attachScrollDotsListener();
}

// -------------------------------------------------------------------
// attachScrollDotsListener()
// Attacca l'evento scroll al carosello per aggiornare i pallini
// -------------------------------------------------------------------
function attachScrollDotsListener() {
  const carousel = els.booksList;
  if (!carousel) return;
  carousel.removeEventListener("scroll", updateScrollDots);
  carousel.addEventListener("scroll", updateScrollDots);
}

// -------------------------------------------------------------------
// updateScrollDots()
// Aggiorna il pallino attivo in base alla posizione di scroll
// Se si è alla fine, attiva l'ultimo pallino
// -------------------------------------------------------------------
function updateScrollDots() {
  const carousel = els.booksList;
  const dots = document.querySelectorAll(".scroll-dot");
  if (!carousel || dots.length === 0) return;
  const { pageWidth, totalSlides } = getCarouselLayout();
  if (pageWidth <= 0) return;
  const isAtEnd = Math.abs(carousel.scrollLeft + carousel.clientWidth - carousel.scrollWidth) < 5;
  let index = isAtEnd ? totalSlides - 1 : Math.round(carousel.scrollLeft / pageWidth);
  if (index >= totalSlides) index = totalSlides - 1;
  if (index < 0) index = 0;
  dots.forEach((dot, i) => {
    if (i === index) dot.classList.add("active");
    else dot.classList.remove("active");
  });
  currentSlideIndex = index;
}

// -------------------------------------------------------------------
// scrollToIndex(index)
// Scrolla il carosello fino alla pagina specificata
// -------------------------------------------------------------------
function scrollToIndex(index) {
  const { pageWidth, totalSlides } = getCarouselLayout();
  if (pageWidth <= 0) return;
  if (index >= totalSlides) index = 0;
  if (index < 0) index = totalSlides - 1;
  currentSlideIndex = index;
  els.booksList.scrollTo({ left: index * pageWidth, behavior: "smooth" });
}

// -------------------------------------------------------------------
// nextSlide()
// Va alla prossima slide del carosello
// -------------------------------------------------------------------
function nextSlide() {
  const { totalSlides } = getCarouselLayout();
  if (totalSlides <= 1) return;
  currentSlideIndex = (currentSlideIndex + 1) % totalSlides;
  scrollToIndex(currentSlideIndex);
}

// -------------------------------------------------------------------
// prevSlide()
// Va alla slide precedente del carosello
// -------------------------------------------------------------------
function prevSlide() {
  const { totalSlides } = getCarouselLayout();
  if (totalSlides <= 1) return;
  currentSlideIndex = (currentSlideIndex - 1 + totalSlides) % totalSlides;
  scrollToIndex(currentSlideIndex);
}

// -------------------------------------------------------------------
// setupAutoSlide()
// Avvia lo scorrimento automatico (ogni 4 secondi)
// mouseenter -> ferma, mouseleave -> riavvia
// -------------------------------------------------------------------
function setupAutoSlide() {
  if (autoSlideInterval) clearInterval(autoSlideInterval);
  autoSlideInterval = setInterval(nextSlide, 4000);
  if (!hoverAttached) {
    els.booksList.addEventListener("mouseenter", () => clearInterval(autoSlideInterval));
    els.booksList.addEventListener("mouseleave", () => {
      clearInterval(autoSlideInterval);
      autoSlideInterval = setInterval(nextSlide, 4000);
    });
    hoverAttached = true;
  }
}

// -------------------------------------------------------------------
// setupEnterKeySubmit()
// Permette di inviare login/registrazione premendo Enter
// -------------------------------------------------------------------
function setupEnterKeySubmit() {
  if (els.loginUser) els.loginUser.addEventListener("keypress", (e) => { if (e.key === "Enter") login(); });
  if (els.loginPass) els.loginPass.addEventListener("keypress", (e) => { if (e.key === "Enter") login(); });
  if (els.regUser) els.regUser.addEventListener("keypress", (e) => { if (e.key === "Enter") register(); });
  if (els.regPass) els.regPass.addEventListener("keypress", (e) => { if (e.key === "Enter") register(); });
}

// -------------------------------------------------------------------
// EVENTO PER COPIARE LA PASSWORD TEMPORANEA
// Se clicco su #copy-temp-password-btn, seleziono e copio il testo
// -------------------------------------------------------------------
document.addEventListener("click", function(e) {
  if (e.target.id === "copy-temp-password-btn") {
    const input = document.getElementById("temp-password-display");
    if (input) {
      input.select();
      document.execCommand("copy");
      navigator.clipboard.writeText(input.value);
      alert("Password copiata negli appunti!");
    }
  }
});

// -------------------------------------------------------------------
// EVENTO RESIZE
// Quando ridimensiono la finestra, ricalcolo i pallini del carosello
// -------------------------------------------------------------------
window.addEventListener("resize", () => {
  const container = document.querySelector(".carousel-container");
  if (container && container.style.display !== "none") renderScrollDots();
});

// -------------------------------------------------------------------
// window.onload()
// Quando la pagina è completamente caricata, avvio il carosello
// -------------------------------------------------------------------
window.onload = () => {
  loadBooks();
  setupEnterKeySubmit();
};
