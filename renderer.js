// --- 1. VARIABLES GLOBALES ---
let roleActuel = null; 

// --- 2. FONCTION DE CHARGEMENT DES VUES ---
async function chargerVue(fichier) {
    const zoneContenu = document.getElementById('contenu-principal');
    const navMenu = document.querySelector('nav');
    
    try {
        const res = await fetch(fichier);
        if (!res.ok) throw new Error(`Impossible de charger ${fichier}`);
        const html = await res.text();
        zoneContenu.innerHTML = html;

        if(navMenu) navMenu.style.display = (fichier.includes('login.html')) ? 'none' : 'flex';

        // Re-déclenchement des scripts selon la page
        if (fichier.includes('accueil.html')) afficherUtilisateurs();
        if (fichier.includes('parametres.html')) setupParametres();
        if (fichier.includes('graphique.html')) setupGraphique();
        if (fichier.includes('login.html')) setupLogin();
        if (fichier.includes('aliments.html')) setupRechercheAliments();
        if (fichier.includes('planning.html')) setupPlanning();
        if (fichier.includes('dashboard.html')) setupDashboard();
        
        // CORRECTION 1 : On active l'atelier quand on est sur la page recettes
        if (fichier.includes('recettes.html')) setupAtelierRecettes();
        
        if (fichier.includes('profil_nutrition.html')) {
            const userId = localStorage.getItem('currentUserId');
            setupNutrition(userId);
        }
    } catch (err) {
        console.error("Erreur chargement vue:", err);
        zoneContenu.innerHTML = `<p style="color:red; text-align:center;">Erreur : ${err.message}</p>`;
    }
}

// --- 3. FONCTIONS METIER ---

// A. LOGIQUE NUTRITION (Avec Algorithme de Cuisine)
async function setupNutrition(userId) {
    if (!userId) return;

    // Données
    const user = await window.monSysteme.getUserById(userId);
    const config = await window.monSysteme.getNutrition(userId) || { deficit_cal: 0, ratio_proteine: 1.8, ratio_lipide: 1.0 };
    let listeRepas = await window.monSysteme.getRepasConfig(userId);

    // Elements DOM
    const el = {
        nom: document.getElementById('profil-nom'),
        selectSport: document.getElementById('select-sport'),
        valCalories: document.getElementById('val-calories'),
        valObjectif: document.getElementById('val-objectif'),
        valImc: document.getElementById('val-imc'),
        // Visuel IMC
        boxMaigreur: document.getElementById('box-maigreur'),
        boxNormal: document.getElementById('box-normal'),
        boxSurpoids: document.getElementById('box-surpoids'),
        boxObesite: document.getElementById('box-obesite'),
        // Macros
        rangeDeficit: document.getElementById('range-deficit'),
        lblDeficit: document.getElementById('lbl-deficit'),
        rangeProt: document.getElementById('range-prot'),
        lblProtG: document.getElementById('lbl-prot-g'),
        lblProtRatio: document.getElementById('lbl-prot-ratio'),
        rangeLip: document.getElementById('range-lip'),
        lblLipG: document.getElementById('lbl-lip-g'),
        lblLipRatio: document.getElementById('lbl-lip-ratio'),
        lblGluG: document.getElementById('lbl-glu-g'),
        alertGlu: document.getElementById('alert-glucides'),
        // Repas
        containerRepas: document.getElementById('container-repas-liste'),
        lblTotalPct: document.getElementById('total-pourcentage'),
        inputNewRepas: document.getElementById('new-repas-name'),
        btnAddRepas: document.getElementById('btn-add-repas'),
        btnSave: document.getElementById('btn-save-nutrition')
    };

    // Init
    if (el.nom) el.nom.innerText = `Profil de ${user.nom}`;
    if (el.selectSport) el.selectSport.value = user.niveausport;
    if (el.rangeDeficit) el.rangeDeficit.value = config.deficit_cal;
    if (el.rangeProt) el.rangeProt.value = config.ratio_proteine;
    if (el.rangeLip) el.rangeLip.value = config.ratio_lipide;

    // Variables globales de calcul
    let totalCaloriesGlobal = 0;
    let totalProtJour = 0;
    let totalLipJour = 0;
    let totalGluJour = 0;

    // --- MISE A JOUR DES CALCULS ---
    const updateVisualIMC = (imc) => {
        [el.boxMaigreur, el.boxNormal, el.boxSurpoids, el.boxObesite].forEach(box => {
            if(box) { box.style.opacity = '0.3'; box.style.transform = 'scale(1)'; box.style.boxShadow = 'none'; }
        });
        let activeBox = null;
        if (imc < 18.5) activeBox = el.boxMaigreur;
        else if (imc < 25) activeBox = el.boxNormal;
        else if (imc < 30) activeBox = el.boxSurpoids;
        else activeBox = el.boxObesite;
        if (activeBox) { activeBox.style.opacity = '1'; activeBox.style.transform = 'scale(1.1)'; activeBox.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)'; }
    };

    const mettreAJourCalculs = () => {
        const imc = (user.poids / ((user.taille / 100) * (user.taille / 100))).toFixed(1);
        if(el.valImc) el.valImc.innerText = imc;
        updateVisualIMC(imc);

        let mb = (10 * user.poids) + (6.25 * user.taille) - (5 * user.age);
        mb = (user.sexe === 'H') ? mb + 5 : mb - 161;
        const sportVal = el.selectSport ? parseFloat(el.selectSport.value) : 1.2;
        const tdee = Math.round(mb * (isNaN(sportVal) ? 1.2 : sportVal));
        if(el.valObjectif) el.valObjectif.innerText = `Maintenance (TDEE) : ${tdee} Kcal`;

        const deficit = parseInt(el.rangeDeficit.value);
        totalCaloriesGlobal = tdee + deficit;
        if(el.valCalories) el.valCalories.innerText = `${totalCaloriesGlobal} Kcal`;
        if(el.lblDeficit) el.lblDeficit.innerText = (deficit > 0 ? "+" : "") + deficit + " Kcal";

        // Macros Journée
        const ratioP = parseFloat(el.rangeProt.value);
        totalProtJour = Math.round(user.poids * ratioP);
        if(el.lblProtG) el.lblProtG.innerText = `${totalProtJour}g`;
        if(el.lblProtRatio) el.lblProtRatio.innerText = ratioP;

        const ratioL = parseFloat(el.rangeLip.value);
        totalLipJour = Math.round(user.poids * ratioL);
        if(el.lblLipG) el.lblLipG.innerText = `${totalLipJour}g`;
        if(el.lblLipRatio) el.lblLipRatio.innerText = ratioL;

        const calRestantes = totalCaloriesGlobal - ((totalProtJour * 4) + (totalLipJour * 9));
        totalGluJour = Math.round(calRestantes / 4);
        if (totalGluJour < 0) totalGluJour = 0;
        if(el.lblGluG) el.lblGluG.innerText = `${totalGluJour}g`;
        if(el.alertGlu) el.alertGlu.style.display = (totalGluJour < 50) ? 'block' : 'none';

        renderRepas();
    };

    // --- GESTION REPAS & BOUTON CUISINER ---
    const renderRepas = () => {
        if (!el.containerRepas) return;
        el.containerRepas.innerHTML = "";
        let totalPct = 0;

        listeRepas.forEach((repas, index) => {
            totalPct += repas.pourcentage;
            const calRepas = Math.round(totalCaloriesGlobal * (repas.pourcentage / 100));

            const div = document.createElement('div');
            div.style.cssText = "display: flex; align-items: center; margin-bottom: 10px; background: white; padding: 10px; border-radius: 5px; border: 1px solid #eee;";
            
            // Calculs pour les boutons
            const targetP = Math.round(totalProtJour * (repas.pourcentage / 100));
            const targetG = Math.round(totalGluJour * (repas.pourcentage / 100));
            const targetL = Math.round(totalLipJour * (repas.pourcentage / 100));

            // Boutons de déplacement (On cache le Haut pour le 1er, et le Bas pour le dernier)
            const btnUp = index > 0 ? `<button class="btn-move-up" data-index="${index}" style="cursor:pointer; border:none; background:transparent; font-size:1.2em;" title="Monter">⬆️</button>` : `<span style="width:25px; display:inline-block;"></span>`;
            const btnDown = index < listeRepas.length - 1 ? `<button class="btn-move-down" data-index="${index}" style="cursor:pointer; border:none; background:transparent; font-size:1.2em;" title="Descendre">⬇️</button>` : `<span style="width:25px; display:inline-block;"></span>`;

            div.innerHTML = `
                <div style="display:flex; flex-direction:column; margin-right:10px;">
                    ${btnUp}
                    ${btnDown}
                </div>

                <div style="flex: 1;">
                    <strong>${repas.nom}</strong><br>
                    <small style="color: #7f8c8d;">${calRepas} Kcal</small>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn-cook" 
                        data-kcal="${calRepas}" 
                        data-p="${targetP}" 
                        data-g="${targetG}" 
                        data-l="${targetL}"
                        style="background: #f1c40f; color: #2c3e50; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-weight: bold;">
                        👨‍🍳 Cuisiner
                    </button>
                    <input type="number" class="input-pct" data-index="${index}" value="${repas.pourcentage}" style="width: 50px; padding: 5px;" min="0" max="100">
                    <span>%</span>
                    <button class="btn-delete-repas" data-index="${index}" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">🗑️</button>
                </div>
            `;
            el.containerRepas.appendChild(div);
        });

        // Mise à jour du total pourcentage
        if (el.lblTotalPct) {
            el.lblTotalPct.innerText = totalPct + "%";
            el.lblTotalPct.style.color = (totalPct === 100) ? "#27ae60" : "#e74c3c";
        }

        // --- ECOUTEURS D'ÉVÉNEMENTS ---
        
        // 1. Changement pourcentage
        document.querySelectorAll('.input-pct').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = e.target.getAttribute('data-index');
                listeRepas[idx].pourcentage = parseInt(e.target.value) || 0;
                renderRepas(); 
            });
        });

        // 2. Suppression
        document.querySelectorAll('.btn-delete-repas').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                listeRepas.splice(idx, 1);
                renderRepas();
            });
        });

        // 3. Déplacement HAUT (Swap avec l'élément précédent)
        document.querySelectorAll('.btn-move-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                if (idx > 0) {
                    // On inverse [idx] et [idx-1]
                    [listeRepas[idx], listeRepas[idx - 1]] = [listeRepas[idx - 1], listeRepas[idx]];
                    renderRepas();
                }
            });
        });

        // 4. Déplacement BAS (Swap avec l'élément suivant)
        document.querySelectorAll('.btn-move-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                if (idx < listeRepas.length - 1) {
                    // On inverse [idx] et [idx+1]
                    [listeRepas[idx], listeRepas[idx + 1]] = [listeRepas[idx + 1], listeRepas[idx]];
                    renderRepas();
                }
            });
        });
    };

    // --- ALGORITHME DE RÉSOLUTION CULINAIRE CORRIGÉ ---
    const solveRecetteIntelligente = (ingredients, cible) => {
        // Copie profonde pour ne pas toucher aux originaux
        let resultats = ingredients.map(ing => ({ 
            ...ing, 
            quantite_finale: ing.quantite_base_g,
            isChampion: null 
        }));

        // 1. DÉTECTION DES CHAMPIONS (Qui est le plus dense ?)
        let championP = null, maxDensiteP = 0;
        let championG = null, maxDensiteG = 0;
        let championL = null, maxDensiteL = 0;

        resultats.forEach((ing, index) => {
            // On ignore les ingrédients "traces" (épices, etc < 5g) pour éviter les bugs de calcul
            if(ing.quantite_base_g < 5) return;

            if (ing.proteines > maxDensiteP) { maxDensiteP = ing.proteines; championP = index; }
            if (ing.glucides > maxDensiteG) { maxDensiteG = ing.glucides; championG = index; }
            if (ing.lipides > maxDensiteL) { maxDensiteL = ing.lipides; championL = index; }
        });

        // On marque les champions pour ne pas les traiter deux fois
        if (championP !== null && maxDensiteP > 5) resultats[championP].isChampion = "Protéines";
        if (championG !== null && maxDensiteG > 10) resultats[championG].isChampion = "Glucides";
        // Le champion Lipide ne doit pas écraser les autres si c'est le même aliment
        if (championL !== null && maxDensiteL > 20 && !resultats[championL].isChampion) {
            resultats[championL].isChampion = "Lipides";
        }

        // 2. CALCUL DES QUANTITÉS CIBLES (Théoriques)
        
        // A. Protéines
        if (championP !== null) {
            let qte = (cible.p * 100) / maxDensiteP;
            resultats[championP].quantite_finale = qte;
        }

        // B. Glucides
        if (championG !== null) {
            let qte = (cible.g * 100) / maxDensiteG;
            resultats[championG].quantite_finale = qte;
        }

        // C. Lipides (On prend le reste)
        if (championL !== null && resultats[championL].isChampion === "Lipides") {
            // Estimation rapide du gras apporté par les autres
            let grasActuel = 0;
            resultats.forEach(ing => {
                if (ing.isChampion !== "Lipides") {
                    grasActuel += (ing.lipides * ing.quantite_finale) / 100;
                }
            });
            let manque = cible.l - grasActuel;
            if (manque < 5) manque = 5; // Minimum technique
            let qte = (manque * 100) / maxDensiteL;
            resultats[championL].quantite_finale = qte;
        }

        // D. Ingrédients Neutres (Suivent la moyenne)
        // On calcule le "Ratio de croissance" moyen du plat
        let ratioGlobal = 0;
        let count = 0;
        
        // On regarde de combien on a grossi les champions par rapport à la base
        if (championP !== null) { ratioGlobal += resultats[championP].quantite_finale / ingredients[championP].quantite_base_g; count++; }
        if (championG !== null) { ratioGlobal += resultats[championG].quantite_finale / ingredients[championG].quantite_base_g; count++; }
        
        // Si aucun champion trouvé (plat bizarre), on se base sur les calories globales
        if (count === 0) {
            // Fallback : Ratio Calorie Cible / Calorie Base Recette
            let calBaseRecette = ingredients.reduce((acc, cur) => acc + (cur.calories * cur.quantite_base_g)/100, 0);
            ratioGlobal = cible.k / (calBaseRecette || 1);
        } else {
            ratioGlobal = ratioGlobal / count;
        }

        // Appliquer aux neutres
        resultats.forEach(ing => {
            if (!ing.isChampion) {
                ing.quantite_finale = ing.quantite_base_g * ratioGlobal;
            }
        });

        // 3. LA CORRECTION FINALE (NORMALISATION)
        // C'est l'étape qui manquait : on recalcule tout et on ajuste pour coller aux calories
        
        let totalCalorieCalcule = 0;
        resultats.forEach(ing => {
            totalCalorieCalcule += (ing.calories * ing.quantite_finale) / 100;
        });

        // Le Facteur de Correction (ex: On voulait 850, on a 1150 => facteur 0.73)
        let facteurCorrection = 1;
        if (totalCalorieCalcule > 0) {
            facteurCorrection = cible.k / totalCalorieCalcule;
        }

        // On applique ce facteur à TOUS les ingrédients pour garder l'équilibre mais réduire la taille
        resultats.forEach(ing => {
            ing.quantite_finale = Math.round(ing.quantite_finale * facteurCorrection);
        });

        return resultats;
    };

    // --- MODAL LOGIC ---
    const modal = document.getElementById('modal-cuisine');
    const closeModal = document.getElementById('close-modal');
    const selectRecette = document.getElementById('select-recette-modal');
    const zoneResultat = document.getElementById('zone-ingredients-calcules');
    const listeFinale = document.getElementById('liste-ingredients-finale');
    
    // Elements d'affichage cible
    const dispCibleKcal = document.getElementById('cible-kcal');
    const dispCibleP = document.getElementById('cible-prot');
    const dispCibleG = document.getElementById('cible-glu');
    const dispCibleL = document.getElementById('cible-lip');

    let ciblesRepas = { k: 0, p: 0, g: 0, l: 0 };

    if(closeModal) closeModal.addEventListener('click', () => { modal.style.display = 'none'; zoneResultat.style.display = 'none'; });

    // Ouverture du modal
    if(el.containerRepas) {
        el.containerRepas.addEventListener('click', async (e) => {
            if (e.target.classList.contains('btn-cook')) {
                ciblesRepas.k = parseInt(e.target.getAttribute('data-kcal'));
                ciblesRepas.p = parseInt(e.target.getAttribute('data-p'));
                ciblesRepas.g = parseInt(e.target.getAttribute('data-g'));
                ciblesRepas.l = parseInt(e.target.getAttribute('data-l'));

                if (ciblesRepas.k <= 0) return alert("Ce repas est vide (0%). Augmente le pourcentage !");

                // Affichage des objectifs
                dispCibleKcal.innerText = ciblesRepas.k;
                dispCibleP.innerText = ciblesRepas.p;
                dispCibleG.innerText = ciblesRepas.g;
                dispCibleL.innerText = ciblesRepas.l;
                
                // Charger les recettes
                const recettes = await window.monSysteme.getRecettes();
                selectRecette.innerHTML = '<option value="">-- Choisir un plat --</option>';
                recettes.forEach(r => {
                    selectRecette.innerHTML += `<option value="${r.id}">${r.nom}</option>`;
                });

                modal.style.display = 'flex';
            }
        });
    }

    // Calcul quand on change de recette
    if(selectRecette) {
        selectRecette.addEventListener('change', async (e) => {
            const recetteId = e.target.value;
            // On cache les résultats si aucune recette sélectionnée
            if (!recetteId) { zoneResultat.style.display = 'none'; return; }

            // 1. Récupérer ingrédients et infos nutritionnelles
            const ingredients = await window.monSysteme.getRecetteDetails(recetteId);
            
            // 2. LANCER L'ALGORITHME
            const ingredientsCalcules = solveRecetteIntelligente(ingredients, ciblesRepas);

            // 3. CALCULS ET AFFICHAGE
            listeFinale.innerHTML = "";
            
            // Variables pour le total RÉEL de la recette
            let totaux = { cal: 0, p: 0, g: 0, l: 0 };

            ingredientsCalcules.forEach(ing => {
                // Calculs par ingrédient pour la quantité finale
                const calIng = Math.round((ing.calories * ing.quantite_finale) / 100);
                const pIng = Math.round((ing.proteines * ing.quantite_finale) / 100);
                const gIng = Math.round((ing.glucides * ing.quantite_finale) / 100);
                const lIng = Math.round((ing.lipides * ing.quantite_finale) / 100);

                // Ajout aux totaux
                totaux.cal += calIng;
                totaux.p += pIng;
                totaux.g += gIng;
                totaux.l += lIng;

                // Icône Champion
                let icon = "⚪️"; 
                if (ing.isChampion === "Protéines") icon = "🍗";
                if (ing.isChampion === "Glucides") icon = "🍚";
                if (ing.isChampion === "Lipides") icon = "🥑";

                // --- NOUVEL AFFICHAGE LISTE ---
                listeFinale.innerHTML += `
                    <li style="border-bottom: 1px solid #eee; padding: 10px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span>${icon} <strong>${ing.nom}</strong></span>
                            <span style="font-size:1.1em; font-weight: bold; color:#2c3e50;">${ing.quantite_finale}g</span> 
                        </div>
                        <div style="font-size: 0.85em; color: #7f8c8d; display: flex; justify-content: space-between;">
                            <span>🔥 ${calIng} Kcal</span>
                            <span>
                                <span style="color: #3498db;">P: ${pIng}</span> • 
                                <span style="color: #e67e22;">G: ${gIng}</span> • 
                                <span style="color: #e74c3c;">L: ${lIng}</span>
                            </span>
                        </div>
                    </li>
                `;
            });

            // --- NOUVEL AFFICHAGE EN-TÊTE (Comparatif) ---
            const headerScore = document.getElementById('header-score-repas');
            if(headerScore) {
                headerScore.innerHTML = `
                    <div style="text-align: center; margin-bottom: 10px; color: #7f8c8d; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px;">Bilan Nutritionnel</div>
                    
                    <div style="display: flex; justify-content: space-between; text-align: center; margin-bottom: 10px;">
                        <div style="flex: 1; border-right: 1px solid #eee;">
                            <div style="font-size: 0.8em; color: #3498db;">PROTÉINES</div>
                            <div style="font-weight: bold; font-size: 1.1em;">${totaux.p}g</div>
                            <div style="font-size: 0.8em; color: #aaa;">/${ciblesRepas.p}g</div>
                        </div>
                        <div style="flex: 1; border-right: 1px solid #eee;">
                            <div style="font-size: 0.8em; color: #e67e22;">GLUCIDES</div>
                            <div style="font-weight: bold; font-size: 1.1em;">${totaux.g}g</div>
                            <div style="font-size: 0.8em; color: #aaa;">/${ciblesRepas.g}g</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 0.8em; color: #e74c3c;">LIPIDES</div>
                            <div style="font-weight: bold; font-size: 1.1em;">${totaux.l}g</div>
                            <div style="font-size: 0.8em; color: #aaa;">/${ciblesRepas.l}g</div>
                        </div>
                    </div>

                    <div style="background: #2c3e50; color: white; padding: 8px; border-radius: 6px; text-align: center; margin-top: 5px;">
                        <span style="font-weight: normal; margin-right: 10px;">Total Calorie :</span>
                        <strong style="font-size: 1.2em;">${totaux.cal} Kcal</strong> 
                        <small style="opacity: 0.7;">(Cible: ${ciblesRepas.k})</small>
                    </div>
                `;
            }

            // On nettoie le bas car tout est maintenant en haut
            document.getElementById('analyse-resultat').style.display = 'none'; // On cache l'ancien footer
            
            zoneResultat.style.display = 'block';
        });
    }

    // Listeners Save & Sliders
    if(el.btnSave) {
        el.btnSave.addEventListener('click', async () => {
            await window.monSysteme.updateUserSport({ id: userId, niveausport: parseFloat(el.selectSport.value) });
            await window.monSysteme.saveNutrition({
                user_id: userId,
                deficit_cal: parseInt(el.rangeDeficit.value),
                ratio_proteine: parseFloat(el.rangeProt.value),
                ratio_lipide: parseFloat(el.rangeLip.value)
            });
            await window.monSysteme.saveRepasConfig({ user_id: userId, listeRepas: listeRepas });
            alert("✅ Profil et Repas sauvegardés !");
        });
    }
    if(el.btnAddRepas) {
        el.btnAddRepas.addEventListener('click', () => {
            const nom = el.inputNewRepas.value.trim();
            if (nom) { listeRepas.push({ nom: nom, pourcentage: 0 }); el.inputNewRepas.value = ""; renderRepas(); }
        });
    }

    if(el.selectSport) el.selectSport.addEventListener('change', mettreAJourCalculs);
    if(el.rangeDeficit) el.rangeDeficit.addEventListener('input', mettreAJourCalculs);
    if(el.rangeProt) el.rangeProt.addEventListener('input', mettreAJourCalculs);
    if(el.rangeLip) el.rangeLip.addEventListener('input', mettreAJourCalculs);

    mettreAJourCalculs();
}

// B. LOGIQUE GRAPHIQUE (Standard)
async function setupGraphique() {
    const ctx = document.getElementById('monGraphique');
    const selectUser = document.getElementById('select-user-graph');
    const btnAjouter = document.getElementById('btn-ajouter-graph');
    const btnEffacer = document.getElementById('btn-effacer-graph');
    const champDate = document.getElementById('inputDate');
    const champValeur = document.getElementById('inputValue');

    if (!ctx) return; 
    if (typeof Chart === 'undefined') { ctx.parentNode.innerHTML = "<p style='color:red'>Erreur: Chart.js absent.</p>"; return; }

    champDate.valueAsDate = new Date();
    let monChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [{ label: 'Poids (kg)', data: [], borderColor: '#3498db', borderWidth: 3, fill: true }] }, options: { maintainAspectRatio: false } });

    const chargerDonnees = async (userId) => {
        const hist = await window.monSysteme.getHistoriquePoids(userId);
        monChart.data.labels = hist.map(h => new Date(h.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        monChart.data.datasets[0].data = hist.map(h => h.poids);
        monChart.update();
    };

    const users = await window.monSysteme.lireUtilisateurs();
    selectUser.innerHTML = "";
    if (users.length > 0) {
        users.forEach(u => { const opt = document.createElement('option'); opt.value = u.id; opt.textContent = u.nom; selectUser.appendChild(opt); });
        const last = localStorage.getItem('currentUserId');
        if (last) selectUser.value = last;
        chargerDonnees(selectUser.value);
    }

    selectUser.addEventListener('change', (e) => { chargerDonnees(e.target.value); localStorage.setItem('currentUserId', e.target.value); });
    if (btnAjouter) btnAjouter.addEventListener('click', async () => { await window.monSysteme.addPoids({ user_id: selectUser.value, date: champDate.value, poids: parseFloat(champValeur.value) }); chargerDonnees(selectUser.value); alert("Ajouté !"); });
    if (btnEffacer) btnEffacer.addEventListener('click', async () => { if(confirm("Effacer ?")) { await window.monSysteme.clearHistoriquePoids(selectUser.value); chargerDonnees(selectUser.value); }});
}

// C. LOGIQUE ALIMENTS (CORRIGÉ pour accepter les critères de recherche)
function setupRechercheAliments() {
    const searchInput = document.getElementById('search-input');
    const container = document.getElementById('resultats-container');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            const texte = e.target.value;
            if (texte.length < 2) return;
            // CORRECTION 2 : On passe un objet {text: ...} car main.js attend désormais des critères
            const resultats = await window.monSysteme.searchAliments({ text: texte });
            
            if (resultats.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #e74c3c;">Aucun aliment trouvé</p>';
            } else {
                container.innerHTML = resultats.map(alim => `
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 5px solid #3498db; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="background:#e74c3c; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.9em; margin-right:10px;">ID: ${alim.id}</span>
                            <strong>${alim.nom}</strong>
                            <br><small>${alim.categorie}</small>
                        </div>
                        <div style="text-align: right;"><span style="font-weight: bold; color: #27ae60;">${alim.calories} Kcal</span></div>
                    </div>
                `).join('');
            }
        });
    }
}


function setupLogin() {
    const btn = document.getElementById('btn-login-action');
    const select = document.getElementById('profile-select');
    if(select) window.monSysteme.recupererComptes().then(c => c.forEach(comp => select.innerHTML += `<option value="${comp.identifiant}">${comp.identifiant}</option>`));
    if(btn) btn.addEventListener('click', async () => {
        const res = await window.monSysteme.verifierConnexion(document.getElementById('login-id').value, document.getElementById('login-mdp').value);
        if(res.success) { document.querySelector('nav').style.display = 'flex'; chargerVue('pages/accueil.html'); }
        else alert(res.message);
    });
    if(select) select.addEventListener('change', (e) => document.getElementById('login-id').value = e.target.value);
}
function setupParametres() {
    const form = document.getElementById('form-add-user');
    if(form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await window.monSysteme.sauvegarderUtilisateur({ nom: document.getElementById('input-nom').value, poids: document.getElementById('input-poids').value, taille: document.getElementById('input-taille').value, age: document.getElementById('input-age').value, sexe: document.getElementById('input-sexe').value, niveausport: 1.2 });
        alert("Utilisateur créé !"); form.reset();
    });
}
async function afficherUtilisateurs() {
    const div = document.getElementById('liste-utilisateurs');
    if(!div) return;
    const users = await window.monSysteme.lireUtilisateurs();
    div.innerHTML = users.map(u => `
        <div style="border-bottom:1px solid #ddd; padding:10px; display:flex; justify-content:space-between;">
            <strong>${u.nom}</strong>
            <div>
                <button class="btn-profil" data-id="${u.id}">Profil</button>
                <button class="btn-delete" data-id="${u.id}">X</button>
            </div>
        </div>`).join('');
}

// --- H. LOGIQUE ATELIER RECETTES ---
let currentRecetteId = null; // null = Création, chiffre = Modification
let currentIngredients = []; // Liste temporaire des ingrédients ajoutés

async function setupAtelierRecettes() {
    // 1. Remplir le select des catégories
    const categories = await window.monSysteme.getCategories();
    const selectCat = document.getElementById('search-ing-cat');
    if (selectCat) {
        selectCat.innerHTML = '<option value="">Toutes catégories</option>';
        categories.forEach(c => selectCat.innerHTML += `<option value="${c}">${c}</option>`);
    }

    // 2. Charger la liste des recettes (Sidebar)
    chargerListeRecettesSidebar();

    // 3. Bouton "Nouvelle Recette"
    document.getElementById('btn-new-recette').addEventListener('click', () => resetEditeur());

    // 4. MOTEUR DE RECHERCHE INTELLIGENT
    const inputSearch = document.getElementById('search-ing-text');
    const selectSort = document.getElementById('search-ing-sort');
    const resultsDiv = document.getElementById('results-ingredients');

    const lancerRecherche = async () => {
        const text = inputSearch.value;
        const cat = selectCat.value;
        const sort = selectSort.value;

        if (text.length < 2 && cat === "") { 
            resultsDiv.style.display = 'none'; 
            return; 
        }

        const resultats = await window.monSysteme.searchAliments({ text, category: cat, sort });
        
        resultsDiv.innerHTML = "";
        resultsDiv.style.display = 'block';

        if (resultats.length === 0) {
            resultsDiv.innerHTML = '<div style="padding:10px; color:#999;">Aucun résultat</div>';
            return;
        }

        resultats.forEach(alim => {
            const div = document.createElement('div');
            div.style.cssText = "padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; hover:background:#f0f0f0;";
            div.innerHTML = `<strong>${alim.nom}</strong> <small style='color:#7f8c8d'>(${alim.calories} kcal/100g)</small>`;
            
            div.addEventListener('click', () => {
                ajouterIngredientALaRecette(alim);
                resultsDiv.style.display = 'none';
                inputSearch.value = "";
            });
            resultsDiv.appendChild(div);
        });
    };

    // On écoute tout ce qui bouge (Texte, Catégorie, Tri)
    inputSearch.addEventListener('input', lancerRecherche);
    selectCat.addEventListener('change', lancerRecherche);
    selectSort.addEventListener('change', lancerRecherche);

// 5. Sauvegarde (AVEC PROTECTION ANTI-DOUBLE CLIC)
    const btnSave = document.getElementById('btn-save-recette');
    
    // On utilise .onclick au lieu de addEventListener pour éviter les doublons accidentels
    btnSave.onclick = async () => {
        // Protection : Si le bouton est déjà désactivé, on ne fait rien
        if (btnSave.disabled) return;

        const nom = document.getElementById('edit-nom').value;
        const instructions = document.getElementById('edit-instructions').value;

        if (!nom || currentIngredients.length === 0) return alert("Il faut un nom et au moins un ingrédient !");

        // 1. On VERROUILLE le bouton et on change le texte
        btnSave.disabled = true;
        btnSave.innerText = "⏳ En cours...";
        btnSave.style.opacity = "0.7";

        try {
            const data = {
                id: currentRecetteId,
                nom: nom,
                instructions: instructions,
                ingredients: currentIngredients.map(ing => ({ id_aliment: ing.id, qte: ing.qte }))
            };

            const res = await window.monSysteme.saveFullRecette(data);
            
            if (res.success) {
                // Succès
                chargerListeRecettesSidebar();
                resetEditeur();
                // Petit effet visuel
                btnSave.innerText = "✅ Sauvegardé !";
                setTimeout(() => { 
                    btnSave.innerText = "💾 Sauver"; 
                    btnSave.disabled = false; 
                    btnSave.style.opacity = "1";
                }, 1500);
            } else {
                // Erreur (Doublon ou autre)
                alert("Erreur : " + res.message);
                btnSave.innerText = "💾 Sauver";
                btnSave.disabled = false;
                btnSave.style.opacity = "1";
            }
        } catch (err) {
            console.error(err);
            btnSave.disabled = false;
            btnSave.innerText = "💾 Sauver";
            btnSave.style.opacity = "1";
        }
    };
}

function ajouterIngredientALaRecette(alim) {
    // On ajoute par défaut 100g, l'utilisateur changera
    currentIngredients.push({ id: alim.id, nom: alim.nom, qte: 100 });
    renderIngredientsList();
}

function renderIngredientsList() {
    const container = document.getElementById('liste-ingredients-ajoutes');
    container.innerHTML = "";

    if (currentIngredients.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic;">Aucun ingrédient.</p>';
        return;
    }

    currentIngredients.forEach((ing, index) => {
        const div = document.createElement('div');
        div.style.cssText = "display: flex; align-items: center; justify-content: space-between; background: #fafafa; padding: 8px; margin-bottom: 5px; border-radius: 5px; border: 1px solid #eee;";
        
        div.innerHTML = `
            <span style="flex: 1; font-weight: 500;">${ing.nom}</span>
            <div style="display: flex; align-items: center; gap: 5px;">
                <input type="number" value="${ing.qte}" data-index="${index}" class="ing-qte-input" style="width: 60px; padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
                <span style="font-size: 0.9em; color: #666;">g</span>
                <button class="btn-remove-ing" data-index="${index}" style="background: #e74c3c; color: white; border: none; width: 25px; height: 25px; border-radius: 50%; cursor: pointer;">✕</button>
            </div>
        `;
        container.appendChild(div);
    });

    // Listeners pour changement qté et suppression
    document.querySelectorAll('.ing-qte-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = e.target.getAttribute('data-index');
            currentIngredients[idx].qte = parseFloat(e.target.value) || 0;
        });
    });
    document.querySelectorAll('.btn-remove-ing').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-index');
            currentIngredients.splice(idx, 1);
            renderIngredientsList();
        });
    });
}

async function chargerListeRecettesSidebar() {
    const div = document.getElementById('liste-recettes-sidebar');
    const recettes = await window.monSysteme.getRecettes();
    
    div.innerHTML = "";
    recettes.forEach(r => {
        // On crée l'élément HTML
        const item = document.createElement('div');
        item.style.cssText = "background: white; padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;";
        
        item.innerHTML = `
            <span class="nom-recette" style="font-weight: bold; cursor: pointer; flex: 1;">${r.nom}</span>
            <button class="btn-delete-recette" style="background: transparent; border: none; cursor: pointer; font-size: 1.1em;">🗑️</button>
        `;

        // CLIC SUR LE NOM (Charger)
        item.querySelector('.nom-recette').addEventListener('click', () => {
            chargerRecetteDansEditeur(r.id);
        });

        // CLIC SUR LA POUBELLE (Supprimer)
        item.querySelector('.btn-delete-recette').addEventListener('click', async (e) => {
            e.stopPropagation(); // Empêche de cliquer sur le nom en même temps
            if(confirm(`Supprimer la recette "${r.nom}" définitivement ?`)) {
                await window.monSysteme.deleteRecette(r.id);
                chargerListeRecettesSidebar(); // Rafraîchir la liste
                if(currentRecetteId === r.id) resetEditeur(); // Vider l'éditeur si c'était celle-ci
            }
        });

        div.appendChild(item);
    });
}

window.chargerRecetteDansEditeur = async (id) => {
    currentRecetteId = id;
    const recettes = await window.monSysteme.getRecettes();
    const recette = recettes.find(r => r.id === id);
    const details = await window.monSysteme.getRecetteDetails(id);

    document.getElementById('edit-nom').value = recette.nom;
    document.getElementById('edit-instructions').value = recette.instructions || "";
    
    // On mappe les données BDD vers notre format interne
    currentIngredients = details.map(d => ({
        id: d.id || d.aliment_id, // Dépend de ce que renvoie la requête SQL
        nom: d.nom,
        qte: d.quantite_base_g
    }));
    
    renderIngredientsList();
};

window.supprimerRecette = async (id) => {
    if(confirm("Supprimer cette recette ?")) {
        await window.monSysteme.deleteRecette(id);
        chargerListeRecettesSidebar();
        if(currentRecetteId === id) resetEditeur();
    }
};

function resetEditeur() {
    currentRecetteId = null;
    currentIngredients = [];
    document.getElementById('edit-nom').value = "";
    document.getElementById('edit-instructions').value = "";
    renderIngredientsList();
}

// ==========================================
// --- I. LOGIQUE PLANNING (CORRIGÉE) ---
// ==========================================

const joursSemaine = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
let currentSlotEdit = null; 

async function setupPlanning() {
    // 1. GESTION DU SÉLECTEUR D'UTILISATEUR
    const selectUser = document.getElementById('planning-select-user');
    const users = await window.monSysteme.lireUtilisateurs();
    
    // Remplir le select
    if (selectUser) {
        selectUser.innerHTML = "";
        users.forEach(u => {
            selectUser.innerHTML += `<option value="${u.id}">${u.nom}</option>`;
        });

        // Sélectionner l'utilisateur actuel par défaut
        const lastId = localStorage.getItem('currentUserId');
        if (lastId && users.find(u => u.id == lastId)) {
            selectUser.value = lastId;
        }

        // Quand on change d'utilisateur dans la liste
        selectUser.addEventListener('change', async (e) => {
            const newId = e.target.value;
            localStorage.setItem('currentUserId', newId); // On sauvegarde le choix
            await refreshPlanningGrid(newId);
        });
    }

    // On récupère l'ID actif (soit celui du select, soit le stockage)
    const userId = selectUser ? selectUser.value : localStorage.getItem('currentUserId');
    if (!userId) return; // Si vraiment aucun user, on arrête

    // 2. Initialiser les Checkboxes Jours
    const containerChecks = document.getElementById('check-jours');
    if (containerChecks) {
        containerChecks.innerHTML = joursSemaine.map(j => `
            <label style="display:flex; align-items:center; gap:5px; background:white; padding:5px 10px; border-radius:15px; border:1px solid #ddd; cursor:pointer;">
                <input type="checkbox" class="chk-jour" value="${j}" checked> ${j.substring(0,3)}
            </label>
        `).join('');
    }

    // 3. Charger la Grille
    await refreshPlanningGrid(userId);

    // 4. BOUTON GÉNÉRER (CORRECTION DOUBLE CLIC)
    const btnGen = document.getElementById('btn-generate-planning');
    if (btnGen) {
        // On supprime les anciens listeners pour éviter les accumulations (clone)
        const newBtn = btnGen.cloneNode(true);
        btnGen.parentNode.replaceChild(newBtn, btnGen);

        newBtn.addEventListener('click', async () => {
            const currentId = selectUser.value; // On prend l'ID du selecteur
            const joursSelectionnes = Array.from(document.querySelectorAll('.chk-jour:checked')).map(cb => cb.value);
            
            if (joursSelectionnes.length === 0) return alert("Sélectionne au moins un jour !");

            // PROTECTION DOUBLE CLIC
            newBtn.disabled = true;
            newBtn.innerText = "⏳ Calcul...";
            newBtn.style.opacity = "0.7";

            try {
                // On ne demande confirmation que si c'est rapide, sinon ça bloque l'UI
                if(!confirm(`Écraser le planning de ${joursSelectionnes.length} jours pour cet utilisateur ?`)) {
                    throw new Error("Annulé");
                }

                const configRepas = await window.monSysteme.getRepasConfig(currentId);
                
                // Mapping des types pour l'algo (Détection intelligente)
                const structure = configRepas.map(r => {
                    let type = 'plat';
                    const nomLower = r.nom.toLowerCase();
                    // On cherche des mots clés pour catégoriser
                    if (nomLower.includes('déj') || nomLower.includes('matin')) type = 'ptit_dej';
                    if (nomLower.includes('collation') || nomLower.includes('snack') || nomLower.includes('goûter')) type = 'collation';
                    return { nom: r.nom, type: type };
                });

                const res = await window.monSysteme.generateRandomPlanning({ userId: currentId, jours: joursSelectionnes, structure });
                
                if (res.success) {
                    await refreshPlanningGrid(currentId);
                } else {
                    alert("Erreur : " + res.message);
                }

            } catch (err) {
                if (err.message !== "Annulé") console.error(err);
            } finally {
                // RÉACTIVATION DU BOUTON
                newBtn.disabled = false;
                newBtn.innerText = "🎲 Générer Aléatoire";
                newBtn.style.opacity = "1";
            }
        });
    }

    // 5. Bouton Liste de Courses (ACTIF)
    const btnCourses = document.getElementById('btn-generate-courses');
    if (btnCourses) {
        // Clone pour nettoyer les listeners
        const newBtn = btnCourses.cloneNode(true);
        btnCourses.parentNode.replaceChild(newBtn, btnCourses);

        newBtn.addEventListener('click', async () => {
            const currentId = selectUser.value;
            
            // Petit effet de chargement
            newBtn.innerText = "⏳ Calcul...";
            newBtn.disabled = true;

            const res = await window.monSysteme.generateShoppingList(currentId);

            newBtn.innerText = "📝 Liste de Courses";
            newBtn.disabled = false;

            if (!res.success) return alert(res.message);

            // Affichage dans le Modal
            const container = document.getElementById('container-liste-courses');
            const modal = document.getElementById('modal-courses');
            container.innerHTML = "";

            // On parcourt les Rayons
            // res.liste est de la forme { 'Légumes': {'Courgette': 500, 'Tomate': 200}, 'Viande': ... }
            for (const [rayon, ingredients] of Object.entries(res.liste)) {
                // Titre Rayon
                const h3 = document.createElement('h3');
                h3.style.cssText = "color: #2980b9; border-bottom: 2px solid #3498db; margin-top: 20px; padding-bottom: 5px;";
                h3.innerText = rayon;
                container.appendChild(h3);

                // Liste Ingrédients
                const ul = document.createElement('ul');
                ul.style.listStyle = "none";
                ul.style.padding = "0";

                for (const [nom, qte] of Object.entries(ingredients)) {
                    const li = document.createElement('li');
                    li.style.cssText = "padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;";
                    
                    li.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
                            <input type="checkbox" style="transform: scale(1.3);">
                            <span style="font-size: 1.1em;">${nom}</span>
                        </label>
                        <strong style="color: #2c3e50;">${qte}g</strong>
                    `;
                    ul.appendChild(li);
                }
                container.appendChild(ul);
            }

            modal.style.display = 'flex';
        });
    }
    const zoneBoutons = document.getElementById('planning-actions'); // Assure-toi d'avoir une div pour ça, ou ajoute-le à côté des autres
    
    // Si tu n'as pas de conteneur, on l'injecte à la volée pour tester :
    const btnPrint = document.createElement('button');
    btnPrint.innerText = "🖨️ Imprimer";
    btnPrint.style.cssText = "background: #7f8c8d; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; margin-left: 10px;";
    
    // On l'ajoute à côté du bouton "Générer" s'il existe
    const refButton = document.getElementById('btn-generate-planning');
    if(refButton && !document.getElementById('btn-print-added')) {
        btnPrint.id = 'btn-print-added';
        refButton.parentNode.insertBefore(btnPrint, refButton.nextSibling);
        
        btnPrint.addEventListener('click', () => {
            window.print(); // C'est la commande magique qui ouvre la fenêtre d'impression système
        });
    }
}

async function refreshPlanningGrid(userId) {
    const container = document.getElementById('planning-container');
    if (!container) return;
    
    container.innerHTML = `<div style="padding:20px; text-align:center;">Chargement du planning de l'utilisateur ${userId}...</div>`;

    const configRepas = await window.monSysteme.getRepasConfig(userId);
    const planningData = await window.monSysteme.getPlanning(userId); 

    container.innerHTML = "";

    joursSemaine.forEach(jour => {
        const col = document.createElement('div');
        col.style.cssText = "min-width: 200px; flex: 1; display: flex; flex-direction: column; gap: 10px;";
        col.innerHTML = `<div style="text-align: center; font-weight: bold; background: #2c3e50; color: white; padding: 10px; border-radius: 8px;">${jour}</div>`;

        configRepas.forEach(repas => {
            const slotData = planningData.find(p => p.jour === jour && p.nom_repas === repas.nom);
            
            // Détection du type pour l'aléatoire (juste pour info)
            let typeRepas = 'plat';
            const n = repas.nom.toLowerCase();
            if (n.includes('déj') || n.includes('matin')) typeRepas = 'ptit_dej';
            if (n.includes('collation')) typeRepas = 'collation';

            const card = document.createElement('div');
            card.style.cssText = "background: white; border: 1px solid #ddd; border-radius: 8px; padding: 10px; position: relative; min-height: 80px; display: flex; flex-direction: column; justify-content: space-between;";
            
            if (slotData && slotData.recette_id) {
                card.innerHTML = `
                    <small style="color: #95a5a6; font-size: 0.8em;">${repas.nom}</small>
                    <div style="font-weight: bold; color: #34495e; margin: 5px 0;">${slotData.nom_recette || 'Recette inconnue'}</div>
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="btn-mini-action btn-refresh" title="Changer aléatoirement">🎲</button>
                        <button class="btn-mini-action btn-edit" title="Choisir manuellement">✏️</button>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <small style="color: #95a5a6;">${repas.nom}</small>
                    <div style="color: #bdc3c7; font-style: italic; margin: 5px 0;">Rien de prévu</div>
                    <div style="text-align: right;">
                        <button class="btn-mini-action btn-edit" title="Choisir manuellement">➕</button>
                    </div>
                `;
            }

            // Bouton Refresh (Aléatoire ciblé)
            const btnRefresh = card.querySelector('.btn-refresh');
            if (btnRefresh) {
                btnRefresh.addEventListener('click', async () => {
                    await window.monSysteme.generateRandomPlanning({ 
                        userId, 
                        jours: [jour], 
                        structure: [{ nom: repas.nom, type: typeRepas }] 
                    });
                    refreshPlanningGrid(userId);
                });
            }

            // Bouton Edit (Ouverture Modal)
            const btnEdit = card.querySelector('.btn-edit');
            if (btnEdit) {
                btnEdit.addEventListener('click', () => {
                    ouvrirModalSelection(userId, jour, repas.nom, typeRepas);
                });
            }

            col.appendChild(card);
        });

        container.appendChild(col);
    });
}

function ouvrirModalSelection(userId, jour, nomRepas, typeRepas) {
    currentSlotEdit = { userId, jour, nomRepas, type: typeRepas };
    
    const modal = document.getElementById('modal-select-planning');
    const resultsDiv = document.getElementById('results-planning-select');
    const input = document.getElementById('input-search-planning');
    
    if(input) input.value = "";
    if(resultsDiv) resultsDiv.innerHTML = "<p style='padding:10px; color:#999;'>Tapez le nom d'un ingrédient ou d'une recette...</p>";
    if(modal) {
        modal.style.display = 'flex';
        if(input) input.focus();
    }
}

function renderResultatsSelection(recettes) {
    const div = document.getElementById('results-planning-select');
    if(!div) return;
    div.innerHTML = "";
    
    if (recettes.length === 0) {
        div.innerHTML = "<p style='padding:10px; color:orange;'>Aucune recette trouvée avec ce nom.</p>";
        return;
    }

    recettes.forEach(r => {
        const item = document.createElement('div');
        item.style.cssText = "padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; hover:background: #f9f9f9;";
        // On affiche le type pour info
        item.innerHTML = `<strong>${r.nom}</strong> <small style="color:#aaa">(${r.type || 'plat'})</small>`;
        
        item.addEventListener('click', async () => {
            // Sauvegarder le choix
            await window.monSysteme.savePlanningSlot({
                userId: currentSlotEdit.userId,
                jour: currentSlotEdit.jour,
                nomRepas: currentSlotEdit.nomRepas,
                recetteId: r.id
            });
            
            // Fermer
            document.getElementById('modal-select-planning').style.display = 'none';
            // Rafraîchir
            refreshPlanningGrid(currentSlotEdit.userId);
        });

        div.appendChild(item);
    });
}

// ==========================================
// --- DASHBOARD (Tableau de Bord) ---
// ==========================================

async function setupDashboard() {
    const userId = localStorage.getItem('currentUserId');
    if (!userId) return;

    // 1. Infos Utilisateur & Poids
    const user = await window.monSysteme.getUserById(userId);
    const poidsHisto = await window.monSysteme.getHistoriquePoids(userId);
    
    document.getElementById('dash-nom').innerText = user.nom;
    if (poidsHisto.length > 0) {
        const dernier = poidsHisto[poidsHisto.length - 1];
        document.getElementById('dash-poids').innerText = dernier.poids;
    }

    // --- NOUVEAU : CALCUL OBJECTIF EAU (35ml par kg) ---
    const eauMl = Math.round(user.poids * 35);
    const eauLitres = (eauMl / 1000).toFixed(1); // Converti en Litres (ex: 2.8)
    
    const elEau = document.getElementById('dash-eau');
    if(elEau) elEau.innerText = `${eauLitres} L`;

    // 2. Récupérer le Planning d'AUJOURD'HUI
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const jourActuel = jours[new Date().getDay()]; // ex: "Mardi"
    
    // On réutilise ta fonction existante (getPlanning renvoie tout, on filtrera)
    const planningFull = await window.monSysteme.getPlanning(userId);
    const planningJour = planningFull.filter(p => p.jour === jourActuel);

    // 3. Calculer les Calories Totales Prévues
    // Pour faire ça bien, il faudrait recalculer chaque recette.
    // Pour l'instant, on va faire une estimation basée sur la config nutrition (Cible).
    const configNutri = await window.monSysteme.getNutrition(userId);
    
    // Recalcul TDEE (Copie de la logique main.js)
    let mb = (10 * user.poids) + (6.25 * user.taille) - (5 * user.age);
    mb = (user.sexe === 'H') ? mb + 5 : mb - 161;
    const tdee = Math.round(mb * (user.niveausport || 1.2));
    const cibleKcal = tdee + (configNutri.deficit_cal || 0);

    // Mise à jour Jauge (On simule que si le planning est rempli, on est à 100% de la cible prévue)
    const isPlanningRempli = planningJour.length > 0;
    const kcalAffiche = isPlanningRempli ? cibleKcal : 0;
    
    const barre = document.getElementById('barre-calories');
    const texte = document.getElementById('texte-calories');
    
    setTimeout(() => {
        barre.style.width = isPlanningRempli ? "100%" : "5%";
        barre.style.background = isPlanningRempli ? "linear-gradient(90deg, #2ecc71, #27ae60)" : "#bdc3c7";
    }, 100);

    texte.innerText = isPlanningRempli 
        ? `${cibleKcal} Kcal prévues` 
        : "Aucun repas prévu aujourd'hui";

    // Afficher Macros Cibles
    const p = Math.round(user.poids * (configNutri.ratio_proteine || 1.8));
    const l = Math.round(user.poids * (configNutri.ratio_lipide || 1.0));
    // Reste en Glucides
    const calRestantes = cibleKcal - ((p * 4) + (l * 9));
    const g = Math.max(0, Math.round(calRestantes / 4));

    document.getElementById('dash-prot').innerText = p + "g";
    document.getElementById('dash-glu').innerText = g + "g";
    document.getElementById('dash-lip').innerText = l + "g";

    // 4. Afficher les Cartes Repas
    const containerRepas = document.getElementById('dash-repas-container');
    containerRepas.innerHTML = "";

    // On récupère l'ordre des repas (Config)
    const configRepas = await window.monSysteme.getRepasConfig(userId);

    if (planningJour.length === 0) {
        containerRepas.innerHTML = `
            <div style="text-align:center; width:100%; padding:20px; background:#f9f9f9; border-radius:10px;">
                <p>Rien de prévu pour ce ${jourActuel}.</p>
                <button onclick="chargerVue('pages/planning.html')" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer;">Aller au Planning</button>
            </div>
        `;
    } else {
        configRepas.forEach(repasConf => {
            const slot = planningJour.find(p => p.nom_repas === repasConf.nom);
            
            const card = document.createElement('div');
            card.style.cssText = "min-width: 180px; flex: 1; background: #fff; padding: 15px; border-radius: 10px; border: 1px solid #eee; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: transform 0.2s;";
            
            // Icône selon le repas
            let icon = "🍽️";
            const n = repasConf.nom.toLowerCase();
            if (n.includes('dej') || n.includes('matin')) icon = "☕";
            if (n.includes('collation') || n.includes('snack')) icon = "🍎";
            if (n.includes('dîner') || n.includes('soir')) icon = "🌙";

            if (slot && slot.recette_id) {
                card.innerHTML = `
                    <div style="font-size: 0.8em; color: #95a5a6; margin-bottom: 5px;">${repasConf.nom}</div>
                    <div style="font-size: 1.5em; margin-bottom: 5px;">${icon}</div>
                    <div style="font-weight: bold; color: #2c3e50; height: 40px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                        ${slot.nom_recette}
                    </div>
                    <div style="margin-top: 10px; font-size: 0.85em; color: #27ae60;">
                        ~${Math.round(cibleKcal * (repasConf.pourcentage / 100))} Kcal
                    </div>
                `;
            } else {
                card.style.opacity = "0.6";
                card.style.background = "#f9f9f9";
                card.innerHTML = `
                    <div style="font-size: 0.8em; color: #95a5a6;">${repasConf.nom}</div>
                    <div style="margin-top: 10px; font-style: italic; color: #bdc3c7;">Rien</div>
                `;
            }
            containerRepas.appendChild(card);
        });
    }

    // 5. Graphique Poids (Chart.js)
    // On réutilise la logique existante du profil
    const ctx = document.getElementById('dash-chart');
    if (ctx && poidsHisto.length > 0) {
        // On prend les 7 derniers points max
        const dataRecent = poidsHisto.slice(-7);
        window.myDashChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataRecent.map(h => h.date),
                datasets: [{
                    label: 'Poids',
                    data: dataRecent.map(h => h.poids),
                    borderColor: '#007AFF', // Bleu iOS
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                        gradient.addColorStop(0, 'rgba(0, 122, 255, 0.4)'); // Bleu transparent haut
                        gradient.addColorStop(1, 'rgba(0, 122, 255, 0)');   // Transparent bas
                        return gradient;
                    },
                    borderWidth: 3,
                    pointRadius: 0, // Cache les points pour une ligne pure
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4 // Courbe très lisse
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }, // Cache la légende
                scales: {
                    x: { grid: { display: false }, ticks: { display: false } }, // Cache grille X
                    y: { 
                        grid: { color: '#f0f0f0', borderDash: [5, 5] }, // Grille Y discrète
                        border: { display: false } // Cache la ligne de l'axe
                    }
                }
            }
        });
    }
}



// --- DÉMARRAGE SÉCURISÉ ---
document.addEventListener('DOMContentLoaded', () => {
    const addSafe = (id, cb) => { const el = document.getElementById(id); if(el) el.addEventListener('click', cb); };
    addSafe('btn-accueil', () => chargerVue('pages/accueil.html'));
    addSafe('btn-params', () => chargerVue('pages/parametres.html'));
    addSafe('btn-graphique', () => chargerVue('pages/graphique.html'));
    addSafe('btn-aliments', () => chargerVue('pages/aliments.html'));
    addSafe('btn-planning', () => chargerVue('pages/planning.html'));
    addSafe('btn-dashboard', () => chargerVue('pages/dashboard.html'));
    
    // CORRECTION 3 : Ajout du listener pour le bouton RECETTES (Atelier)
    addSafe('btn-recettes', () => chargerVue('pages/recettes.html'));
    
    // Dark Mode
    const btnDark = document.getElementById('btn-dark-mode');
    if(localStorage.getItem('theme') === 'dark') { document.body.classList.add('dark-mode'); if(btnDark) btnDark.innerText = "☀️"; }
    if(btnDark) btnDark.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); btnDark.innerText = document.body.classList.contains('dark-mode') ? "☀️" : "🌙"; });

    document.body.addEventListener('click', async (e) => {
        if (e.target.dataset.target) chargerVue(e.target.dataset.target);
        if (e.target.classList.contains('btn-profil')) { localStorage.setItem('currentUserId', e.target.getAttribute('data-id')); chargerVue('pages/profil_nutrition.html'); }
        if (e.target.classList.contains('btn-delete')) { if(confirm("Supprimer ?")) { await window.monSysteme.supprimerUtilisateur(e.target.getAttribute('data-id')); afficherUtilisateurs(); } }
    });

    chargerVue('pages/login.html');
});