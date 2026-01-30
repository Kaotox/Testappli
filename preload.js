const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monSysteme', {
    // ... tes autres fonctions ...
    sauvegarderUtilisateur: (donnees) => ipcRenderer.invoke('save-user', donnees),
    lireUtilisateurs: () => ipcRenderer.invoke('get-users'),
    supprimerUtilisateur: (id) => ipcRenderer.invoke('delete-user', id),
    verifierConnexion: (id, mdp) => ipcRenderer.invoke('check-login', { id: id, mdp: mdp }),
    
    // --- NOUVEAU : Récupérer la liste des profils ---
    recupererComptes: () => ipcRenderer.invoke('get-public-accounts')
});