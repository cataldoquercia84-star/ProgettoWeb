
# Codex Hub - Biblioteca Digitale


Questo file contiene le istruzioni per avviare e testare il progetto "Codex Hub", realizzato per l'esame di Tecnologia e Web. 

## 🛠 Come installare e avviare il progetto (in locale)

1. Apri il terminale e posizionati all'interno della cartella backend del progetto.
2. Installa le dipendenze necessarie con il comando:
  npm install
      Fai partire il server eseguendo:
  npm start
Apri il browser e vai all'indirizzo http://localhost:3000 (o la porta indicata nel terminale).

Nota: Il terminale deve restare aperto per mantenere il server attivo. Per spegnerlo, premi Ctrl+C nel terminale.

🌐 Link remoto
Il progetto è stato caricato online ed è raggiungibile a questo indirizzo:
https://progettoweb-s6il.onrender.com

👑 Primo accesso (Amministratore)
Alla creazione del database (che avviene in automatico al primo avvio), viene generato un account di default per accedere subito come amministratore.

Username: Admin

Password: Admin$1234

Con questo account è possibile gestire l'intero catalogo e gli utenti.

👤 Cosa può fare un Utente normale
Registrarsi: È richiesta una password sicura (minimo 8 caratteri, almeno una lettera maiuscola, una minuscola, un numero e un carattere speciale come $!@#).

Accedere: Tramite il modulo di login.

Sfogliare il catalogo: Visualizzazione dei libri disponibili. I libri esauriti (0 copie) presentano un bordo rosso e non sono prenotabili.

Prenotare un libro: La disponibilità scala in automatico. Il prestito ha una durata fissa di 30 giorni.

Gestire i prestiti: Visualizzare i libri attualmente in prestito con i giorni rimanenti alla scadenza.

Restituire un libro: Ripristina la copia nel database.

⚙️ Cosa può fare l'Amministratore
Oltre alle funzionalità di base, l'admin ha un'area dedicata per:

Aggiungere nuovi libri: Inserendo titolo, autore, numero di copie e caricando una foto di copertina (se non viene inserita, il sistema ne usa una di default).

Gestire l'inventario: Aumentare o diminuire le copie dei libri già presenti.

Eliminare titoli: Rimuove definitivamente un libro e tutti i prestiti ad esso associati.

Monitorare statistiche: Vedere il numero totale dei libri, il totale delle copie, i prestiti attivi e la top 5 dei libri più prestati negli ultimi 30 giorni.

Elenco utenti: Visualizzare la lista di tutti gli utenti registrati a sistema.

🔑 Recupero Password Dimenticata
È previsto un flusso per chi smarrisce la password:

Cliccare su "Password dimenticata?" e inserire il proprio username.

Il sistema genera una password temporanea a schermo. Deve essere copiata subito, perché viene mostrata una volta sola.

Al successivo login con la password temporanea, il sistema blocca l'accesso e obbliga l'utente a impostare una nuova password sicura definitiva prima di procedere.
