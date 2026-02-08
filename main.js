const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs'); 

// Initialisation de la BDD avec logs pour voir ce qui se passe
const dbPath = path.join(app.getPath('userData'), 'ma-base.db');
const db = new Database(dbPath, { verbose: console.log });

// ==========================================
// --- A. CRÉATION DE TOUTES LES TABLES ---
// ==========================================

// 1. Utilisateurs & Comptes
db.exec(`CREATE TABLE IF NOT EXISTS utilisateurs (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, role TEXT, email TEXT, age INTEGER, poids INTEGER, taille INTEGER, niveausport FLOAT, sexe TEXT, objectif TEXT);`);
db.exec(`CREATE TABLE IF NOT EXISTS comptes (identifiant TEXT PRIMARY KEY, mot_de_passe TEXT NOT NULL, role TEXT NOT NULL);`);

// 2. Nutrition & Poids
db.exec(`CREATE TABLE IF NOT EXISTS nutrition (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, deficit_cal INTEGER, ratio_proteine FLOAT, ratio_lipide FLOAT, FOREIGN KEY(user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE);`);
db.exec(`CREATE TABLE IF NOT EXISTS historique_poids (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, date TEXT, poids FLOAT, FOREIGN KEY(user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE);`);
db.exec(`CREATE TABLE IF NOT EXISTS configuration_repas (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, nom TEXT, pourcentage INTEGER, FOREIGN KEY(user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE);`);

// 3. Planning
db.exec(`CREATE TABLE IF NOT EXISTS planning (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_id INTEGER, 
    jour TEXT, 
    nom_repas TEXT, 
    recette_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY(recette_id) REFERENCES recettes(id)
);`);

// 4. ALIMENTS & RECETTES
db.exec(`CREATE TABLE IF NOT EXISTS aliments (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, categorie TEXT, calories FLOAT, proteines FLOAT, glucides FLOAT, lipides FLOAT);`);
db.exec(`CREATE TABLE IF NOT EXISTS recettes (id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT, instructions TEXT, type TEXT DEFAULT 'plat');`);
db.exec(`CREATE TABLE IF NOT EXISTS recette_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    recette_id INTEGER, 
    aliment_id INTEGER, 
    quantite_base_g FLOAT,
    FOREIGN KEY(recette_id) REFERENCES recettes(id),
    FOREIGN KEY(aliment_id) REFERENCES aliments(id)
);`);


// ==========================================
// --- B. INITIALISATION DES DONNÉES ---
// ==========================================

// 1. Compte Admin
const checkAdmin = db.prepare("SELECT * FROM comptes WHERE identifiant = ?").get('admin');
if (!checkAdmin) {
    db.prepare("INSERT INTO comptes (identifiant, mot_de_passe, role) VALUES (?, ?, ?)").run('admin', 'admin1234', 'admin');
}

// 2. Recettes Manuelles (Tes recettes sur-mesure)
const checkRecettes = db.prepare('SELECT count(*) as count FROM recettes').get().count;

if (checkRecettes === 0) {
    console.log("👨‍🍳 Création des recettes manuelles...");
    const addIng = db.prepare('INSERT INTO recette_ingredients (recette_id, aliment_id, quantite_base_g) VALUES (?, ?, ?)');

    // RECETTE 1 : RISOTTO (Plat)
    const info1 = db.prepare('INSERT INTO recettes (nom, instructions, type) VALUES (?, ?, ?)').run('Risotto Poulet & Poireaux', 'Faire revenir...', 'plat');
    const idRisotto = info1.lastInsertRowid;
    try {
        addIng.run(idRisotto, 20054, 70);   // Riz
        addIng.run(idRisotto, 28520, 100);  // Poulet
        addIng.run(idRisotto, 19024, 30);   // Crème
        addIng.run(idRisotto, 20036, 150);  // Poireau
        addIng.run(idRisotto, 17002, 10);   // Huile
    } catch (e) {}

    // RECETTE 2 : PÂTES BOLOGNAISE (Plat)
    const info2 = db.prepare('INSERT INTO recettes (nom, instructions, type) VALUES (?, ?, ?)').run('Pâtes Bolognaise', 'Cuire...', 'plat');
    const idBolo = info2.lastInsertRowid;
    try {
        addIng.run(idBolo, 20500, 80);   // Pâtes
        addIng.run(idBolo, 6540, 100);   // Boeuf
        addIng.run(idBolo, 20045, 150);  // Tomate
        addIng.run(idBolo, 17002, 10);   // Huile
        addIng.run(idBolo, 20033, 50);   // Oignon
    } catch (e) {}

    // RECETTE 3 : EXEMPLE PETIT DEJ
    const info3 = db.prepare('INSERT INTO recettes (nom, instructions, type) VALUES (?, ?, ?)').run('Bowl Fromage Blanc & Fruits', 'Mélanger...', 'ptit_dej');
    const idDej = info3.lastInsertRowid;
    try {
        addIng.run(idDej, 19500, 200);   // Fromage blanc (Exemple ID)
        addIng.run(idDej, 13000, 100);   // Pomme (Exemple ID)
    } catch (e) {}
}


// ==========================================
// --- C. LOGIQUE MÉTIER (IPC HANDLERS) ---
// ==========================================

// Gestion Utilisateurs
ipcMain.handle('save-user', async (event, data) => {
    try {
        const insertStmt = db.prepare('INSERT INTO utilisateurs (nom, role, email, age, poids, taille, niveausport, sexe, objectif) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const info = insertStmt.run(data.nom, data.role, data.email, data.age, data.poids, data.taille, data.niveausport, data.sexe, data.objectif);
        const newUserId = info.lastInsertRowid; 
        
        const dateToday = new Date().toISOString().split('T')[0];
        db.prepare('INSERT INTO historique_poids (user_id, date, poids) VALUES (?, ?, ?)').run(newUserId, dateToday, data.poids);
        db.prepare('INSERT INTO nutrition (user_id, deficit_cal, ratio_proteine, ratio_lipide) VALUES (?, ?, ?, ?)').run(newUserId, 0, 1.8, 1.0);
        
        return { success: true, message: "Profil créé avec succès !" };
    } catch (error) { return { success: false, message: error.message }; }
});

ipcMain.handle('get-users', async () => { try { return db.prepare('SELECT * FROM utilisateurs ORDER BY id DESC').all(); } catch (error) { return []; } });
ipcMain.handle('delete-user', async (event, id) => { try { db.prepare('DELETE FROM utilisateurs WHERE id = ?').run(id); return { success: true }; } catch (error) { return { success: false, message: error.message }; } });
ipcMain.handle('get-user-by-id', async (event, id) => { try { return db.prepare('SELECT * FROM utilisateurs WHERE id = ?').get(id); } catch (error) { return null; } });
ipcMain.handle('update-user-sport', async (event, data) => { try { db.prepare('UPDATE utilisateurs SET niveausport = ? WHERE id = ?').run(data.niveausport, data.id); return { success: true }; } catch (error) { return { success: false, message: error.message }; } });

// Gestion Connexion
ipcMain.handle('get-public-accounts', async () => { try { return db.prepare('SELECT identifiant FROM comptes').all(); } catch (error) { return []; } });
ipcMain.handle('check-login', async (event, arg1) => {
    let id = arg1.id || arg1;
    let mdp = arg1.mdp || arg1.mot_de_passe; 
    try {
        const user = db.prepare('SELECT * FROM comptes WHERE identifiant = ? AND mot_de_passe = ?').get(id, mdp);
        if (user) return { success: true, role: user.role };
        else return { success: false, message: "Identifiant ou mot de passe incorrect" };
    } catch (error) { return { success: false, message: "Erreur technique : " + error.message }; }
});

// Gestion Nutrition & Poids
ipcMain.handle('save-nutrition', async (event, data) => {
    try {
        const check = db.prepare('SELECT id FROM nutrition WHERE user_id = ?').get(data.user_id);
        if (check) db.prepare('UPDATE nutrition SET deficit_cal = ?, ratio_proteine = ?, ratio_lipide = ? WHERE user_id = ?').run(data.deficit_cal, data.ratio_proteine, data.ratio_lipide, data.user_id);
        else db.prepare('INSERT INTO nutrition (user_id, deficit_cal, ratio_proteine, ratio_lipide) VALUES (?, ?, ?, ?)').run(data.user_id, data.deficit_cal, data.ratio_proteine, data.ratio_lipide);
        return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
});
ipcMain.handle('get-nutrition', async (event, userId) => { try { return db.prepare('SELECT * FROM nutrition WHERE user_id = ?').get(userId); } catch (error) { return null; } });

// Gestion Repas
ipcMain.handle('get-repas-config', async (event, userId) => {
    try {
        const repas = db.prepare('SELECT * FROM configuration_repas WHERE user_id = ?').all(userId);
        if (repas.length === 0) {
            return [
                { nom: "Petit Déjeuner", pourcentage: 25 },
                { nom: "Déjeuner", pourcentage: 35 },
                { nom: "Collation", pourcentage: 10 },
                { nom: "Dîner", pourcentage: 30 }
            ];
        }
        return repas;
    } catch (error) { return []; }
});

ipcMain.handle('save-repas-config', async (event, data) => {
    try {
        const { user_id, listeRepas } = data;
        const deleteOld = db.prepare('DELETE FROM configuration_repas WHERE user_id = ?');
        const insertNew = db.prepare('INSERT INTO configuration_repas (user_id, nom, pourcentage) VALUES (?, ?, ?)');
        const transaction = db.transaction(() => {
            deleteOld.run(user_id);
            for (const repas of listeRepas) insertNew.run(user_id, repas.nom, repas.pourcentage);
        });
        transaction();
        return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
});

// Graphique Poids
ipcMain.handle('get-historique-poids', async (event, userId) => { try { return db.prepare('SELECT * FROM historique_poids WHERE user_id = ? ORDER BY date ASC').all(userId); } catch (error) { return []; } });
ipcMain.handle('add-poids', async (event, data) => {
    try {
        db.prepare('INSERT INTO historique_poids (user_id, date, poids) VALUES (?, ?, ?)').run(data.user_id, data.date, data.poids);
        const latestEntry = db.prepare('SELECT poids FROM historique_poids WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(data.user_id);
        if (latestEntry) db.prepare('UPDATE utilisateurs SET poids = ? WHERE id = ?').run(latestEntry.poids, data.user_id);
        return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
});
ipcMain.handle('clear-historique-poids', async (event, userId) => { db.prepare('DELETE FROM historique_poids WHERE user_id = ?').run(userId); return { success: true }; });


// --- GESTION ALIMENTS & RECETTES ---

// Import CSV
function importerCSVInterne() {
    try {
        const csvPath = path.join(__dirname, 'data', 'Table_Ciqual.csv');
        if (!fs.existsSync(csvPath)) { console.log("Fichier CSV introuvable."); return; }
        const data = fs.readFileSync(csvPath, 'utf8');
        const lines = data.split('\n'); 
        const insert = db.prepare('INSERT INTO aliments (nom, categorie, calories, proteines, glucides, lipides) VALUES (?, ?, ?, ?, ?, ?)');
        const transaction = db.transaction((lignes) => {
            db.prepare('DELETE FROM aliments').run(); 
            for (let i = 1; i < lignes.length; i++) {
                const line = lignes[i].trim();
                if (!line) continue;
                const cols = line.split(';');
                if (cols.length < 10) continue;
                const nom = cols[3] ? cols[3].replace(/"/g, '') : 'Inconnu';
                const cat = cols[1] ? cols[1].replace(/"/g, '') : 'Divers';
                const cleanNum = (val) => { if (!val) return 0; let propre = val.replace(/"/g, '').replace('<', '').trim(); return parseFloat(propre) || 0; };
                insert.run(nom, cat, cleanNum(cols[5]), cleanNum(cols[7]), cleanNum(cols[8]), cleanNum(cols[9]));
            }
        });
        transaction(lines);
        console.log("✅ Importation CIQUAL terminée !");
    } catch (err) { console.error("Erreur import:", err); }
}

// Catégories & Recherche
ipcMain.handle('get-categories', async () => {
    try {
        const results = db.prepare('SELECT DISTINCT categorie FROM aliments WHERE categorie IS NOT NULL ORDER BY categorie ASC').all();
        return results.map(r => r.categorie);
    } catch (error) { return []; }
});

ipcMain.handle('search-aliments', async (event, criteria) => {
    try {
        let sql = 'SELECT * FROM aliments WHERE 1=1';
        const params = [];
        if (criteria.text) { sql += ' AND nom LIKE ?'; params.push(`%${criteria.text}%`); }
        if (criteria.category) { sql += ' AND categorie = ?'; params.push(criteria.category); }
        if (criteria.sort === 'cal_asc') sql += ' ORDER BY calories ASC';
        else if (criteria.sort === 'prot_desc') sql += ' ORDER BY proteines DESC';
        else sql += ' ORDER BY nom ASC';
        sql += ' LIMIT 50';
        return db.prepare(sql).all(...params);
    } catch (error) { return []; }
});

// Recettes CRUD
ipcMain.handle('delete-recette', async (event, id) => {
    try {
        db.prepare('DELETE FROM recette_ingredients WHERE recette_id = ?').run(id);
        db.prepare('DELETE FROM recettes WHERE id = ?').run(id);
        return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
});

ipcMain.handle('save-full-recette', async (event, data) => {
    try {
        const nomRecette = data.nom.trim();
        const check = db.prepare('SELECT id FROM recettes WHERE nom = ? COLLATE NOCASE').get(nomRecette);
        if (check && (!data.id || (data.id && check.id !== data.id))) {
            return { success: false, message: `La recette "${nomRecette}" existe déjà !` };
        }
        const transaction = db.transaction(() => {
            let recetteId = data.id;
            if (recetteId) {
                db.prepare('UPDATE recettes SET nom = ?, instructions = ? WHERE id = ?').run(nomRecette, data.instructions, recetteId);
                db.prepare('DELETE FROM recette_ingredients WHERE recette_id = ?').run(recetteId);
            } else {
                const info = db.prepare('INSERT INTO recettes (nom, instructions) VALUES (?, ?)').run(nomRecette, data.instructions);
                recetteId = info.lastInsertRowid;
            }
            const insertIng = db.prepare('INSERT INTO recette_ingredients (recette_id, aliment_id, quantite_base_g) VALUES (?, ?, ?)');
            for (const ing of data.ingredients) insertIng.run(recetteId, ing.id_aliment, ing.qte);
        });
        transaction();
        return { success: true };
    } catch (error) { return { success: false, message: "Erreur technique : " + error.message }; }
});

ipcMain.handle('get-recettes', async () => { return db.prepare('SELECT * FROM recettes').all(); });
ipcMain.handle('get-recette-details', async (event, recetteId) => {
    const sql = `SELECT ri.quantite_base_g, a.nom, a.calories, a.proteines, a.glucides, a.lipides FROM recette_ingredients ri JOIN aliments a ON ri.aliment_id = a.id WHERE ri.recette_id = ?`;
    return db.prepare(sql).all(recetteId);
});


// ==========================================
// --- GESTION PLANNING & FILTRES ---
// ==========================================

// 1. Sauvegarde Planning
ipcMain.handle('save-planning-slot', async (event, data) => {
    try {
        const existe = db.prepare('SELECT id FROM planning WHERE user_id = ? AND jour = ? AND nom_repas = ?').get(data.userId, data.jour, data.nomRepas);
        if (existe) db.prepare('UPDATE planning SET recette_id = ? WHERE id = ?').run(data.recetteId, existe.id);
        else db.prepare('INSERT INTO planning (user_id, jour, nom_repas, recette_id) VALUES (?, ?, ?, ?)').run(data.userId, data.jour, data.nomRepas, data.recetteId);
        return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
});

// 2. Lecture Planning
ipcMain.handle('get-planning', async (event, userId) => {
    try {
        const sql = `SELECT p.*, r.nom as nom_recette, r.type as type_recette FROM planning p LEFT JOIN recettes r ON p.recette_id = r.id WHERE p.user_id = ?`;
        return db.prepare(sql).all(userId);
    } catch (error) { return []; }
});

// 3. Recherche Recettes Avancée
ipcMain.handle('search-recettes-avance', async (event, criteria) => {
    try {
        let sql = `SELECT DISTINCT r.* FROM recettes r LEFT JOIN recette_ingredients ri ON r.id = ri.recette_id LEFT JOIN aliments a ON ri.aliment_id = a.id WHERE 1=1`;
        const params = [];
        if (criteria.text) { sql += ` AND (r.nom LIKE ? OR a.nom LIKE ?)`; params.push(`%${criteria.text}%`, `%${criteria.text}%`); }
        if (criteria.type) { sql += ` AND r.type = ?`; params.push(criteria.type); }
        return db.prepare(sql).all(...params);
    } catch (error) { return []; }
});

// 4. Génération Aléatoire
ipcMain.handle('generate-random-planning', async (event, data) => {
    try {
        const transaction = db.transaction(() => {
            for (const jour of data.jours) {
                for (const slot of data.structure) {
                    let recette = db.prepare('SELECT id FROM recettes WHERE type = ? ORDER BY RANDOM() LIMIT 1').get(slot.type);
                    if (!recette) recette = db.prepare('SELECT id FROM recettes ORDER BY RANDOM() LIMIT 1').get();
                    if (recette) {
                        const existe = db.prepare('SELECT id FROM planning WHERE user_id = ? AND jour = ? AND nom_repas = ?').get(data.userId, jour, slot.nom);
                        if (existe) db.prepare('UPDATE planning SET recette_id = ? WHERE id = ?').run(recette.id, existe.id);
                        else db.prepare('INSERT INTO planning (user_id, jour, nom_repas, recette_id) VALUES (?, ?, ?, ?)').run(data.userId, jour, slot.nom, recette.id);
                    }
                }
            }
        });
        transaction();
        return { success: true };
    } catch (error) { return { success: false, message: error.message }; }
});

// ==========================================
// --- GÉNÉRATEUR DE LISTE DE COURSES (UNIQUE) ---
// ==========================================

ipcMain.handle('generate-shopping-list', async (event, userId) => {
    console.log(`🛒 DÉBUT GÉNÉRATION LISTE pour User ${userId}`);
    try {
        const user = db.prepare('SELECT poids, niveausport, age, sexe, taille FROM utilisateurs WHERE id = ?').get(userId);
        const configNutri = db.prepare('SELECT * FROM nutrition WHERE user_id = ?').get(userId);
        if (!user || !configNutri) return { success: false, message: "Profil incomplet" };

        let mb = (10 * user.poids) + (6.25 * user.taille) - (5 * user.age);
        mb = (user.sexe === 'H') ? mb + 5 : mb - 161;
        const tdee = Math.round(mb * (user.niveausport || 1.2));
        const cibleJour = tdee + (configNutri.deficit_cal || 0);

        const cibleP = Math.round(user.poids * (configNutri.ratio_proteine || 1.8));
        const cibleL = Math.round(user.poids * (configNutri.ratio_lipide || 1.0));
        const cibleG = Math.max(0, Math.round((cibleJour - ((cibleP * 4) + (cibleL * 9))) / 4));

        const planning = db.prepare(`SELECT p.*, cr.pourcentage FROM planning p LEFT JOIN configuration_repas cr ON p.nom_repas = cr.nom AND p.user_id = cr.user_id WHERE p.user_id = ?`).all(userId);

        if (planning.length === 0) return { success: false, message: "Planning vide !" };

        let listeFinale = {}; 

        for (const slot of planning) {
            const pourcentage = slot.pourcentage || 25; 
            const ratio = pourcentage / 100;
            const cibleRepas = { p: cibleP * ratio, g: cibleG * ratio, l: cibleL * ratio, k: cibleJour * ratio };

            const ingredients = db.prepare(`SELECT ri.quantite_base_g, a.nom, a.categorie, a.proteines, a.glucides, a.lipides, a.calories FROM recette_ingredients ri JOIN aliments a ON ri.aliment_id = a.id WHERE ri.recette_id = ?`).all(slot.recette_id);

            if (ingredients.length === 0) continue; 

            let champP = null, maxP = 0;
            let champG = null, maxG = 0;
            ingredients.forEach((ing, idx) => {
                if(ing.quantite_base_g < 1) return;
                if(ing.proteines > maxP) { maxP = ing.proteines; champP = idx; }
                if(ing.glucides > maxG) { maxG = ing.glucides; champG = idx; }
            });

            let qtesCalculees = ingredients.map(i => i.quantite_base_g);
            if (champP !== null && maxP > 5) qtesCalculees[champP] = (cibleRepas.p * 100) / maxP;
            if (champG !== null && maxG > 10) qtesCalculees[champG] = (cibleRepas.g * 100) / maxG;
            
            let currentCal = 0;
            ingredients.forEach((ing, i) => {
                currentCal += (ing.calories * qtesCalculees[i]) / 100;
            });
            
            let facteur = 1;
            if (currentCal > 50) {
                facteur = cibleRepas.k / currentCal;
            }
            
            // Plafond de sécurité (Max x4 la portion de base)
            if (facteur > 4) facteur = 4;

            // D. AJOUT A LA LISTE FINALE
            ingredients.forEach((ing, i) => {
                const qteFinale = Math.round(qtesCalculees[i] * facteur);
                const rayon = (ing.categorie && ing.categorie.trim() !== "") ? ing.categorie : "Divers / Épicerie";
                if (!listeFinale[rayon]) listeFinale[rayon] = {};
                if (listeFinale[rayon][ing.nom]) listeFinale[rayon][ing.nom] += qteFinale;
                else listeFinale[rayon][ing.nom] = qteFinale;
            });
        }
        
        console.log(`✅ Liste générée avec succès.`);
        return { success: true, liste: listeFinale };

    } catch (error) {
        console.error("❌ Erreur liste courses:", error);
        return { success: false, message: error.message };
    }
});


// ==========================================
// --- D. DÉMARRAGE DE L'APPLICATION ---
// ==========================================
function createWindow () {
    const win = new BrowserWindow({
      width: 1200, height: 800,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
    })
    win.loadFile('index.html')
}

app.whenReady().then(() => {
    const count = db.prepare('SELECT count(*) as count FROM aliments').get().count;
    if (count === 0) importerCSVInterne();
    
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })