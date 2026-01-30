// --- 1. VARIABLES GLOBALES ---
const navMenu = document.querySelector('nav');
const zoneContenu = document.getElementById('contenu-principal');
let roleActuel = null; 

// On cache le menu au démarrage
if(navMenu) navMenu.style.display = 'none'; 

// --- 2. FONCTIONS D'AFFICHAGE ---

async function chargerVue(fichier) {
    try {
        const res = await fetch(fichier);
        if (!res.ok) throw new Error(`Impossible de charger ${fichier}`);
        const html = await res.text();
        zoneContenu.innerHTML = html;

        // --- LOGIQUE SPÉCIFIQUE AUX PAGES ---

        // 1. PAGE D'ACCUEIL
        if (fichier === 'accueil.html') {
            afficherUtilisateurs();
        }

        // 2. PAGE PARAMÈTRES
        if (fichier === 'parametres.html') {
            const form = document.getElementById('form-add-user');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const donnees = {
                        nom: document.getElementById('input-nom').value,
                        role: document.getElementById('input-job').value,
                        email: document.getElementById('input-email').value,
                        age: document.getElementById('input-age').value,
                        poids: document.getElementById('input-poids').value,
                        taille: document.getElementById('input-taille').value,
                        niveausport: document.getElementById('input-niveausport').value,
                        sexe: document.getElementById('input-sexe').value,
                        objectif: document.getElementById('input-objectif').value
                    };

                    const resultat = await window.monSysteme.sauvegarderUtilisateur(donnees);
                    
                    const status = document.getElementById('status');
                    if (resultat.success) {
                        status.innerText = "✅ Utilisateur ajouté !";
                        status.style.color = "green";
                        form.reset();
                    } else {
                        status.innerText = "❌ Erreur : " + resultat.message;
                        status.style.color = "red";
                    }
                });
            }
        }

        // 3. PAGE DE CONNEXION (C'est ici qu'on s'amuse !)
        if (fichier === 'login.html') {
            const btnLogin = document.getElementById('btn-login-action');
            const inputMdp = document.getElementById('login-mdp');
            const inputId = document.getElementById('login-id');
            const selectProfil = document.getElementById('profile-select');
            const titreGreeting = document.getElementById('greeting');

            // --- A. REMPLIR LA LISTE DÉROULANTE DEPUIS LA BDD ---
            try {
                // On appelle la fonction du preload qui tape dans la BDD
                const comptes = await window.monSysteme.recupererComptes();
                
                comptes.forEach(compte => {
                    const opt = document.createElement('option');
                    opt.value = compte.identifiant; // La valeur sera l'ID (ex: 'erwan')
                    // On affiche l'ID avec une majuscule pour faire joli
                    opt.textContent = compte.identifiant.charAt(0).toUpperCase() + compte.identifiant.slice(1);
                    selectProfil.appendChild(opt);
                });

            } catch (err) {
                console.error("Erreur chargement profils:", err);
            }

            // --- B. MAGIE : QUAND ON SÉLECTIONNE UN PROFIL ---
            if (selectProfil) {
                selectProfil.addEventListener('change', (e) => {
                    const selection = e.target.value;
                    
                    if (selection) {
                        // 1. On change le titre
                        titreGreeting.innerText = `Bonjour ${selection.charAt(0).toUpperCase() + selection.slice(1)}`;
                        titreGreeting.style.color = "#3498db";
                        
                        // 2. On remplit automatiquement l'input "Identifiant"
                        inputId.value = selection;
                        
                        // 3. On place le curseur directement dans la case "Mot de passe"
                        inputMdp.focus();
                    } else {
                        // Si on désélectionne
                        titreGreeting.innerText = "Bonjour Inconnu";
                        titreGreeting.style.color = "#2c3e50";
                        inputId.value = "";
                    }
                });
            }

            // --- C. LOGIQUE DE CONNEXION CLASSIQUE ---
            const tenterConnexion = async () => {
                const id = inputId.value;
                const mdp = inputMdp.value;
                const errorMsg = document.getElementById('login-error');
                
                const resultat = await window.monSysteme.verifierConnexion(id, mdp);

                if (resultat.success) {
                    roleActuel = resultat.role; 
                    configurerInterfaceSelonRole();
                    if(navMenu) navMenu.style.display = 'flex'; 
                    chargerVue('accueil.html');     
                } else {
                    errorMsg.innerText = resultat.message;
                    inputMdp.style.borderColor = "red";
                    // Petite animation de secousse (optionnel)
                    inputMdp.classList.add('error-shake'); 
                    setTimeout(() => inputMdp.classList.remove('error-shake'), 300);
                }
            };

            if (btnLogin) btnLogin.addEventListener('click', tenterConnexion);
            if (inputMdp) {
                inputMdp.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') tenterConnexion();
                });
            }
        }

    } catch (err) {
        console.error("Erreur chargement vue:", err);
        zoneContenu.innerHTML = `<p style="color:red; text-align:center;">Erreur : ${err.message}</p>`;
    }
}

async function afficherUtilisateurs() {
    const listeDiv = document.getElementById('liste-utilisateurs');
    if (!listeDiv) return; 

    if (roleActuel !== 'admin') {
        listeDiv.innerHTML = `
            <div style="padding: 15px; background: #fff3cd; color: #856404; border-radius: 5px;">
                🔒 <strong>Accès restreint</strong><br>
                Seuls les administrateurs peuvent voir cette liste.
            </div>`;
        return; 
    }

    try {
        const utilisateurs = await window.monSysteme.lireUtilisateurs();
        if (utilisateurs.length === 0) {
            listeDiv.innerHTML = "<p>Aucun utilisateur trouvé.</p>";
        } else {
            const htmlListe = utilisateurs.map(u => {
                return `
                <div style="border-bottom: 1px solid #ccc; padding: 10px; display: flex; justify-content: space-between; align-items:center;">
                    <div><strong>👤 ${u.nom}</strong> <small>(${u.role})</small></div>
                    <button class="btn-delete" data-id="${u.id}" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">X</button>
                </div>`;
            }).join('');
            listeDiv.innerHTML = htmlListe;
        }
    } catch (erreur) {
        listeDiv.innerHTML = "<p style='color:red'>Erreur technique.</p>";
    }
}

function configurerInterfaceSelonRole() {
    const btnParams = document.getElementById('btn-params');
    if (roleActuel === 'admin') {
        if(btnParams) btnParams.style.display = 'inline-block';
    } else {
        if(btnParams) btnParams.style.display = 'none';
    }
}

// --- 3. GESTIONNAIRES D'ÉVÉNEMENTS ---
document.getElementById('btn-accueil').addEventListener('click', () => chargerVue('accueil.html'));
document.getElementById('btn-params').addEventListener('click', () => chargerVue('parametres.html'));
document.getElementById('btn-bancaire').addEventListener('click', () => chargerVue('banque.html'));

zoneContenu.addEventListener('click', async (event) => {
    if (event.target.dataset.target) {
        chargerVue(event.target.dataset.target);
    }
});

document.body.addEventListener('click', async (event) => {
    if (event.target.classList.contains('btn-delete')) {
        const idASupprimer = event.target.getAttribute('data-id');
        if(!confirm("Confirmer la suppression ?")) return;
        const resultat = await window.monSysteme.supprimerUtilisateur(idASupprimer);
        if (resultat.success) afficherUtilisateurs();
    }
});

// --- 4. DÉMARRAGE ---
// On lance l'application sur la page de login
chargerVue('login.html');