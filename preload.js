const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monSysteme', {
    // UTILISATEURS
    sauvegarderUtilisateur: (data) => ipcRenderer.invoke('save-user', data),
    lireUtilisateurs: () => ipcRenderer.invoke('get-users'),
    supprimerUtilisateur: (id) => ipcRenderer.invoke('delete-user', id),
    getUserById: (id) => ipcRenderer.invoke('get-user-by-id', id),
    updateUserSport: (data) => ipcRenderer.invoke('update-user-sport', data),

    // CONNEXION
    recupererComptes: () => ipcRenderer.invoke('get-public-accounts'),
    verifierConnexion: (id, mdp) => ipcRenderer.invoke('check-login', { id, mdp }),

    // NUTRITION & POIDS
    saveNutrition: (data) => ipcRenderer.invoke('save-nutrition', data),
    getNutrition: (userId) => ipcRenderer.invoke('get-nutrition', userId),
    getHistoriquePoids: (userId) => ipcRenderer.invoke('get-historique-poids', userId),
    addPoids: (data) => ipcRenderer.invoke('add-poids', data),
    clearHistoriquePoids: (userId) => ipcRenderer.invoke('clear-historique-poids', userId),

    // ALIMENTS (CIQUAL)
    importCiqual: () => ipcRenderer.invoke('import-ciqual'),
    searchAliments: (criteria) => ipcRenderer.invoke('search-aliments', criteria),
    getCategories: () => ipcRenderer.invoke('get-categories'),

    // --- NOUVEAU : CUISINE ---
    getRecettes: () => ipcRenderer.invoke('get-recettes'),
    getRecetteDetails: (id) => ipcRenderer.invoke('get-recette-details', id),
    deleteRecette: (id) => ipcRenderer.invoke('delete-recette', id),
    saveFullRecette: (data) => ipcRenderer.invoke('save-full-recette', data),

    // --- NOUVEAU : PLANNING ---
    getPlanning: (userId) => ipcRenderer.invoke('get-planning', userId),
    savePlanningSlot: (data) => ipcRenderer.invoke('save-planning-slot', data),
    generateRandomPlanning: (data) => ipcRenderer.invoke('generate-random-planning', data),
    searchRecettesAvance: (criteria) => ipcRenderer.invoke('search-recettes-avance', criteria),

    // --- REPAS PERSONNALISÉS (CE QUI MANQUAIT) ---
    getRepasConfig: (userId) => ipcRenderer.invoke('get-repas-config', userId),
    generateShoppingList: (userId) => ipcRenderer.invoke('generate-shopping-list', userId),
    saveRepasConfig: (data) => ipcRenderer.invoke('save-repas-config', data)
});