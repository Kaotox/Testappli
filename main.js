const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

// --- 1. CONFIGURATION DE LA BASE DE DONNÉES ---
const dbPath = path.join(app.getPath('userData'), 'ma-base.db');
const db = new Database(dbPath, { verbose: console.log });

// A. Table des utilisateurs (La liste des gens)
const createTableQuery = `
    CREATE TABLE IF NOT EXISTS utilisateurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        role TEXT,
        email TEXT,
        age INTEGER,
        poids INTEGER,
        taille INTEGER,
        niveausport FLOAT
    );
`;
db.exec(createTableQuery);

// B. Table des comptes de connexion (Login) - ON UTILISE BIEN 'COMPTES' ICI
const createComptesTable = `
    CREATE TABLE IF NOT EXISTS comptes (
        identifiant TEXT PRIMARY KEY,
        mot_de_passe TEXT NOT NULL,
        role TEXT NOT NULL
    );
`;
db.exec(createComptesTable);

// --- CRÉATION DES COMPTES PAR DÉFAUT ---
// On vérifie dans la table 'comptes' (et plus 'admins')
const verifComptes = db.prepare('SELECT count(*) as total FROM comptes').get();

if (verifComptes.total === 0) {
    console.log("⚠️ Création des comptes par défaut...");
    const insertCompte = db.prepare('INSERT INTO comptes (identifiant, mot_de_passe, role) VALUES (?, ?, ?)');
    
    // 1. Compte ADMIN (Accès total)
    insertCompte.run('admin', 'admin1234', 'admin');
    
    // 2. Compte UTILISATEUR (Lecture seule)
    insertCompte.run('erwan', '0000', 'user');
}

// --- 2. CRÉATION DE LA FENÊTRE ---
function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') 
    }
  })
  win.loadFile('index.html') // On charge index.html, mais renderer.js redirigera vers login.html
}

// --- 3. LES ÉCOUTEURS (Le Back-end) ---

// SAUVEGARDER UN UTILISATEUR
ipcMain.handle('save-user', async (event, data) => {
    try {
        // On ajoute email et age dans la requête SQL
        const insertStmt = db.prepare('INSERT INTO utilisateurs (nom, role, email, age, poids, taille, niveausport) VALUES (?, ?, ?, ?, ?, ?, ?)');
        
        // On passe les 4 valeurs au lieu de 2
        // data.email et data.age viendront de ton formulaire HTML/JS côté client
        const info = insertStmt.run(data.nom, data.role, data.email, data.age, data.poids, data.taille, data.niveausport);
        
        return { success: true, message: "Sauvegardé avec les nouveaux critères !" };
    } catch (error) {
        console.error(error);
        return { success: false, message: error.message };
    }
});

// LIRE LES UTILISATEURS
ipcMain.handle('get-users', async () => {
    try {
        const readStmt = db.prepare('SELECT * FROM utilisateurs ORDER BY id DESC');
        return readStmt.all();
    } catch (error) {
        console.error(error);
        return [];
    }
});

// SUPPRIMER UN UTILISATEUR
ipcMain.handle('delete-user', async (event, id) => {
    try {
        const deleteStmt = db.prepare('DELETE FROM utilisateurs WHERE id = ?');
        const info = deleteStmt.run(id);
        if (info.changes > 0) return { success: true };
        else return { success: false, message: "Utilisateur introuvable" };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// VÉRIFIER LOGIN (C'est ici qu'on regarde la table 'comptes')
ipcMain.handle('check-login', async (event, creds) => {
    try {
        const stmt = db.prepare('SELECT * FROM comptes WHERE identifiant = ? AND mot_de_passe = ?');
        const user = stmt.get(creds.id, creds.mdp);

        if (user) {
            // On renvoie le rôle (admin ou user) au renderer
            return { success: true, role: user.role };
        } else {
            return { success: false, message: "Identifiant ou mot de passe incorrect." };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
});

// RÉCUPÉRER LES COMPTES (Pour l'écran de login style Netflix)
ipcMain.handle('get-public-accounts', async () => {
    try {
        // On ne sélectionne que l'identifiant et le rôle (PAS le mot de passe)
        const stmt = db.prepare('SELECT identifiant, role FROM comptes');
        return stmt.all();
    } catch (error) {
        return [];
    }
});

// --- DÉMARRAGE ---
app.whenReady().then(() => {
  createWindow()
  
  // Optionnel : Ouvre le dossier de la BDD pour vérifier
  shell.showItemInFolder(dbPath); 

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})