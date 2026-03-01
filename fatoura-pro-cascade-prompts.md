# FATOURA PRO — MASTER BUILD GUIDE FOR CASCADE PRO
# Guide complet et exhaustif — À donner section par section

---

## ═══════════════════════════════════════════════════
## PROMPT 0 — CONTEXTE GLOBAL (Donner en PREMIER, toujours garder dans le contexte)
## ═══════════════════════════════════════════════════

```
Je construis Fatoura Pro — un SaaS B2B de facturation électronique 
conforme à la plateforme TTN/ElFatoora du gouvernement tunisien.

═══ STACK TECHNIQUE ═══
- Next.js 14 App Router + TypeScript (strict mode)
- Supabase (auth + PostgreSQL + RLS + Realtime + Storage)
- Tailwind CSS + shadcn/ui components
- react-hook-form + zod pour tous les formulaires
- Recharts pour les graphiques
- @react-pdf/renderer pour génération PDF
- Déploiement sur Vercel avec cron jobs

═══ DESIGN SYSTEM — RESPECTER PARTOUT ═══
Couleurs :
  --bg: #080a0f           (fond principal)
  --surface: #0f1118      (cartes, panels)
  --surface2: #161b27     (inputs, secondary cards)
  --border: rgba(255,255,255,0.07)
  --gold: #d4a843         (couleur principale, CTAs)
  --gold-dim: rgba(212,168,67,0.15)
  --green: #2dd4a0        (succès, TTN validé)
  --red: #e05a5a          (erreur, rejeté)
  --blue: #4a9eff         (info, en attente)
  --purple: #7c5cbf       (secondaire)
  --text: #e8eaf0         (texte principal)
  --muted: #6b7280        (texte secondaire)

Typographie : Geist Sans (body) + Geist Mono (codes, badges, chiffres)
Border-radius cartes : 16px
Border-radius boutons : 10px
Border-radius inputs : 8px
Transitions : 0.2s ease

Bouton primaire : bg #d4a843, text #000, font-weight 700
Bouton secondaire : bg surface2, border border, text white
Bouton danger : bg transparent, border red, text red → hover bg red/10

Inputs : bg surface2, border border, focus border gold, text text

Status badges (pill, monospace 10px) :
  draft    → bg gray/15   text #9ca3af  "BROUILLON"
  pending  → bg yellow/15 text #fbbf24  "EN ATTENTE TTN"
  valid    → bg green/15  text #2dd4a0  "VALIDÉE ✓"
  rejected → bg red/15    text #e05a5a  "REJETÉE"
  queued   → bg blue/15   text #4a9eff  "FILE D'ATTENTE"

═══ SCHÉMA BASE DE DONNÉES SUPABASE ═══

-- COMPANIES (une par compte)
companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  matricule_fiscal TEXT,       -- Format: 1234567A/A/M/000
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,               -- Supabase Storage
  tva_regime TEXT DEFAULT 'reel',  -- reel | forfait | exonere
  bank_name TEXT,
  bank_rib TEXT,
  own_cert_pem TEXT,           -- Certificat ANCE propre (chiffré)
  own_key_pem TEXT,            -- Clé privée (chiffré)
  ttn_username TEXT,           -- Credentials TTN propres (optionnel)
  ttn_password TEXT,
  invoice_prefix TEXT DEFAULT 'FP',
  invoice_counter INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- CLIENTS
clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  matricule_fiscal TEXT,       -- Vide pour B2C
  address TEXT,
  phone TEXT,
  email TEXT,
  type TEXT DEFAULT 'B2B',     -- B2B | B2C
  notes TEXT,
  total_invoiced NUMERIC DEFAULT 0,  -- Calculé
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- INVOICES
invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id),
  invoice_number TEXT NOT NULL UNIQUE,  -- FP-2025-0001
  invoice_date DATE NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'draft',  -- draft|pending|valid|rejected|queued
  
  -- Montants (en dinars tunisiens, 3 décimales)
  total_ht NUMERIC(12,3) DEFAULT 0,
  total_tva NUMERIC(12,3) DEFAULT 0,
  stamp_duty NUMERIC(12,3) DEFAULT 0.600,
  total_ttc NUMERIC(12,3) DEFAULT 0,
  total_in_words TEXT,         -- Montant en toutes lettres
  
  -- TTN
  ttn_id TEXT,                 -- ID retourné par TTN après validation
  ttn_xml TEXT,                -- XML TEIF généré et signé
  ttn_response JSONB,          -- Réponse complète TTN
  ttn_rejection_reason TEXT,   -- Si rejected
  submitted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  
  -- Meta
  notes TEXT,
  payment_status TEXT DEFAULT 'unpaid',  -- unpaid | partial | paid
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- INVOICE_LINES
invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(10,3) DEFAULT 1,
  unit_price NUMERIC(12,3) NOT NULL,
  tva_rate NUMERIC(4,1) NOT NULL,   -- 19.0 | 13.0 | 7.0 | 0.0
  line_ht NUMERIC(12,3) NOT NULL,   -- qty × unit_price
  line_tva NUMERIC(12,3) NOT NULL,  -- line_ht × tva_rate/100
  line_ttc NUMERIC(12,3) NOT NULL   -- line_ht + line_tva
)

-- MANDATES (système de signature mandataire)
mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  seal_identifier TEXT NOT NULL,   -- N° série cert ANCE de Fatoura Pro
  seal_valid_until DATE NOT NULL,
  scope TEXT DEFAULT 'all_invoices',
  max_amount_ttc NUMERIC(12,3),    -- NULL = illimité
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id)
)

-- TTN_QUEUE (retry queue pour factures échouées)
ttn_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- API_KEYS (pour intégrations ERP futures)
api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,        -- "fp_live_abc..." affiché à l'user
  permissions TEXT[] DEFAULT '{invoices:write,tva:read}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- NOTIFICATIONS
notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,      -- invoice_validated|invoice_rejected|mandate_expiring|cert_expiring
  title TEXT NOT NULL,
  message TEXT,
  invoice_id UUID REFERENCES invoices(id),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- ACTIVITY_LOG
activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,    -- invoice.created|invoice.submitted|mandate.accepted|etc
  entity_type TEXT,        -- invoice|client|mandate|settings
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

RLS activé sur toutes les tables.
Politique universelle : l'user ne voit que les données de sa company.

═══ CONTEXTE MÉTIER TTN — NE JAMAIS MODIFIER ═══
- Format XML : TEIF v1.8.8 (propriétaire TTN, PAS UBL)
- Signature : XAdES-B avec RSA-SHA256
- TVA Tunisie : 4 taux → 19%, 13%, 7%, 0%
- Droit de timbre : 0,600 TND fixe sur chaque facture
- Matricule fiscal format : 1234567A/A/M/000
- Montant en toutes lettres obligatoire (français)
- Date format TEIF : ddMMyy (ex: 270226 pour 27/02/2026)
- Montants TEIF : virgule comme séparateur décimal

Les fichiers src/lib/ttn/ sont SACRÉS — ne jamais les réécrire.
Seulement les importer dans les routes API.
```

---

## ═══════════════════════════════════════════════════
## PROMPT 1 — STRUCTURE DU PROJET ET CONFIGURATION
## ═══════════════════════════════════════════════════

```
Configure la structure complète du projet Next.js 14.

STRUCTURE DES DOSSIERS :
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/
│   │   │   ├── page.tsx           ← Étape 1: compte
│   │   │   └── company/page.tsx   ← Étape 2: entreprise
│   │   └── layout.tsx             ← Layout centré, fond sombre
│   ├── (dashboard)/
│   │   ├── layout.tsx             ← Sidebar + Header + main
│   │   ├── dashboard/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── clients/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── tva/page.tsx
│   │   ├── financing/page.tsx     ← Flash Financing (futur)
│   │   └── settings/
│   │       ├── page.tsx           ← Infos entreprise
│   │       ├── mandate/page.tsx   ← Gestion signature
│   │       ├── api-keys/page.tsx  ← API Keys ERP
│   │       └── notifications/page.tsx
│   ├── api/
│   │   ├── invoices/
│   │   │   ├── route.ts           ← GET list, POST create
│   │   │   ├── [id]/route.ts      ← GET, PUT, DELETE
│   │   │   └── submit/route.ts    ← POST submit to TTN
│   │   ├── clients/route.ts
│   │   ├── mandate/
│   │   │   ├── accept/route.ts
│   │   │   ├── status/route.ts
│   │   │   └── revoke/route.ts
│   │   ├── tva/route.ts           ← GET TVA aggregated
│   │   ├── api-keys/route.ts      ← CRUD API keys
│   │   └── ttn-queue/
│   │       └── process/route.ts   ← Cron retry
│   └── layout.tsx                 ← Root layout + Toaster
├── components/
│   ├── ui/                        ← shadcn components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── MobileNav.tsx
│   ├── invoice/
│   │   ├── InvoiceForm.tsx        ← Formulaire création
│   │   ├── InvoiceTable.tsx       ← Liste avec filtres
│   │   ├── InvoiceDetail.tsx      ← Vue détail
│   │   ├── InvoicePreview.tsx     ← Aperçu PDF dans la page
│   │   ├── InvoiceStatusBadge.tsx
│   │   ├── InvoiceLineItem.tsx    ← Une ligne du tableau
│   │   └── InvoicePDFTemplate.tsx ← Template PDF react-pdf
│   ├── client/
│   │   ├── ClientTable.tsx
│   │   ├── ClientForm.tsx         ← Modal add/edit
│   │   └── ClientCard.tsx
│   ├── mandate/
│   │   ├── MandateOnboarding.tsx
│   │   ├── MandateStatus.tsx
│   │   └── MandateRevoke.tsx
│   ├── dashboard/
│   │   ├── StatsCards.tsx
│   │   ├── InvoiceChart.tsx
│   │   ├── RecentInvoices.tsx
│   │   └── AlertBanner.tsx
│   ├── tva/
│   │   ├── TVABreakdown.tsx
│   │   └── TVAChart.tsx
│   └── shared/
│       ├── LoadingSkeleton.tsx
│       ├── EmptyState.tsx
│       ├── ConfirmDialog.tsx
│       └── NumberInput.tsx        ← Input avec 3 décimales TND
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── ttn/                       ← NE PAS TOUCHER
│   │   ├── ttn-types.ts
│   │   ├── teif-builder.ts
│   │   ├── xml-signer.ts
│   │   ├── mandate-signer.ts
│   │   └── ttn-gateway.ts
│   ├── utils/
│   │   ├── amount-to-words.ts     ← Montant en toutes lettres FR
│   │   ├── invoice-number.ts      ← Génération numéro facture
│   │   ├── tva-calculator.ts      ← Calculs TVA
│   │   └── cn.ts                  ← clsx + tailwind-merge
│   └── validations/
│       ├── invoice.schema.ts
│       ├── client.schema.ts
│       └── company.schema.ts
├── hooks/
│   ├── useInvoices.ts             ← SWR ou react-query
│   ├── useClients.ts
│   ├── useCompany.ts
│   └── useRealtime.ts             ← Supabase realtime subscription
├── types/
│   ├── database.ts                ← Types générés Supabase
│   └── app.ts                     ← Types applicatifs
└── middleware.ts                  ← Auth protection

FICHIERS DE CONFIG :
- tailwind.config.ts (avec les custom colors du design system)
- .env.local (toutes les variables d'env)
- vercel.json (avec cron job pour ttn-queue)

Crée aussi src/lib/utils/amount-to-words.ts avec une fonction
complète qui convertit un montant numérique en texte français.
Exemple: 1200.500 → "Mille deux cents dinars et cinq cents millimes"
Gère les centaines, milliers, virgule en "et", "dinars", "millimes".
```

---

## ═══════════════════════════════════════════════════
## PROMPT 2 — AUTH : LOGIN + INSCRIPTION EN 2 ÉTAPES
## ═══════════════════════════════════════════════════

```
Construis les pages d'authentification complètes.

PAGE /login :
- Layout : fond #080a0f, carte centrée 400px, padding 40px
- En haut : Logo Fatoura Pro (texte stylisé, or) + tagline
- Titre : "Connexion à votre espace"
- Form avec react-hook-form + zod :
  * Email (type email, placeholder "votre@email.com")
  * Mot de passe (type password, bouton show/hide)
  * Bouton "Se connecter" (gold, full width, loading state)
- Message d'erreur inline si identifiants incorrects
- Lien "Pas encore de compte ? Créer un espace gratuit"
- Supabase : auth.signInWithPassword()
- Redirect vers /dashboard après succès
- Si déjà connecté : redirect direct vers /dashboard

PAGE /register — ÉTAPE 1 (Compte) :
- Stepper visuel en haut : [1. Compte] → [2. Entreprise] → [3. Signature]
- Fields : Prénom, Nom, Email, Mot de passe, Confirmer MDP
- Validation : email unique, MDP min 8 chars, correspondance
- Bouton "Créer mon compte" → Supabase auth.signUp()
- Redirect vers /register/company avec l'user_id en session

PAGE /register/company — ÉTAPE 2 (Entreprise) :
- Stepper : étape 2 active
- Fields obligatoires :
  * Nom de la société/personne (TEXT)
  * Matricule fiscal (TEXT, validation pattern ou "PARTICULIER" pour B2C)
  * Adresse complète (TEXTAREA)
  * Gouvernorat (SELECT : Tunis, Ariana, Ben Arous, ..., 24 gouvernorats)
  * Téléphone (TEXT, format tunisien +216 XX XXX XXX)
  * Email professionnel
  * Régime TVA (SELECT : Régime réel / Forfait / Exonéré)
- Champs optionnels :
  * Nom banque
  * RIB bancaire
- Bouton "Créer mon espace Fatoura Pro"
- Insert dans table companies + redirect vers /settings/mandate

PAGE /settings/mandate (Étape 3 post-inscription) :
- Stepper : étape 3 active
- Expliquer les 2 options de signature :
  Option A (RECOMMANDÉE, badge "Économisez 300-400 TND/an") :
    → Activer le mandat Fatoura Pro (affiche MandateOnboarding)
  Option B (Avancé) :
    → "J'ai mon propre certificat ANCE" → upload formulaire
- Bouton "Configurer plus tard" (lien /dashboard, texte muted)

Middleware src/middleware.ts :
- Routes (dashboard)/* : si pas de session → redirect /login
- Routes (auth)/* : si session → redirect /dashboard
- Route / : redirect /dashboard ou /login selon session
```

---

## ═══════════════════════════════════════════════════
## PROMPT 3 — LAYOUT PRINCIPAL (Sidebar + Header)
## ═══════════════════════════════════════════════════

```
Construis le layout principal de l'application.

SIDEBAR (fixe, 240px, bg surface #0f1118, border-right border) :

En-tête sidebar :
- Logo "Fatoura Pro" avec icône stylisée
- Sous le logo : nom de l'entreprise (depuis Supabase, tronqué 20 chars)
- Matricule fiscal en monospace muted petit

Navigation principale (avec icônes lucide-react) :
- /dashboard        → LayoutDashboard    "Tableau de bord"
- /invoices         → FileText          "Factures"
                      + badge COUNT en or si factures pending/rejected
- /clients          → Users             "Clients"
- /tva              → Calculator        "TVA & Déclarations"
- /financing        → Zap               "Flash Financing" 
                      + badge "BIENTÔT" en purple si pas encore actif

Séparateur

Navigation secondaire :
- /settings         → Settings          "Paramètres"
- Lien docs TTN     → ExternalLink      "Guide TTN" (ouvre onglet)

En bas sidebar (collé au bas) :
- Avatar initiales + Nom utilisateur + Email (tronqué)
- Bouton déconnexion (LogOut icon, hover red)

États actifs : 
- Item actif : bg surface2, text gold, bar or à gauche 3px
- Item hover : bg surface2/50, transition smooth

HEADER (fixe en haut, height 64px, bg surface, border-bottom) :

Gauche :
- Bouton hamburger (mobile uniquement)
- Breadcrumb dynamique selon la route
  Ex: "Factures / Nouvelle facture" ou "Paramètres / Signature"

Droite (flex gap-3) :
- Bouton "Nouvelle Facture" (or, icône Plus) → /invoices/new
- Cloche notifications (icône Bell)
  * Badge rouge avec count si notifications non lues
  * Dropdown panel (max 5 notifs, lien "Voir toutes")
  * Notif types : ✅ Facture validée | ❌ Facture rejetée | ⚠️ Mandat expirant
- Avatar utilisateur (dropdown : Profil / Paramètres / Déconnexion)

NOTIFICATION DROPDOWN :
Fetch depuis table notifications WHERE is_read = FALSE
Chaque item : icône type + titre + message tronqué + "il y a Xmin"
Marquer comme lu au clic
Bouton "Tout marquer comme lu"

MOBILE (< 768px) :
- Sidebar cachée, hamburger ouvre drawer Radix Dialog
- Header adapté, breadcrumb simplifié

LAYOUT CONTAINER :
- flex h-screen
- Sidebar fixe à gauche
- Droite : flex-col, header fixe + main scrollable overflow-y-auto
- Main : padding 32px, max-width 1400px, margin auto
```

---

## ═══════════════════════════════════════════════════
## PROMPT 4 — PAGE DASHBOARD
## ═══════════════════════════════════════════════════

```
Construis la page /dashboard complète.

SECTION 1 — Alertes prioritaires (si applicable, en haut) :
Afficher seulement si la condition est vraie :
- 🔴 Alerte rouge : "X factures rejetées par TTN nécessitent votre attention"
  → bouton "Voir les factures rejetées" → /invoices?status=rejected
- 🟡 Alerte orange : "Aucune signature configurée — vos factures ne peuvent 
  pas être soumises à TTN" → bouton "Configurer maintenant" → /settings/mandate
- 🟡 Alerte orange : "Votre mandat de signature expire dans X jours"
  → bouton "Renouveler"
- 🔵 Alerte bleue : "X factures en file d'attente TTN (soumission automatique)"

SECTION 2 — 4 Cartes statistiques (grid 4 cols) :
Data : ce mois calendaire (1er du mois → aujourd'hui)

Carte 1 : "Factures ce mois"
- Grand chiffre : nombre total de factures (tous statuts)
- Sous-chiffre : montant TTC total en dinars
- Icône FileText or
- Tendance vs mois précédent (+12% ↑ en vert ou -5% ↓ en rouge)

Carte 2 : "En attente TTN"
- Grand chiffre : count(pending) + count(queued)
- Sous-texte : "X en cours, Y en file d'attente"
- Icône Clock, couleur bleue si > 0

Carte 3 : "TVA à déclarer"
- Grand chiffre : somme TVA de toutes les factures valid ce trimestre
- Sous-texte : "Trimestre Q{N} {ANNÉE}"
- Icône Receipt, couleur or
- Si trimestre déjà déclaré (futur feature) : badge "Déclaré ✓"

Carte 4 : "Chiffre d'affaires HT"
- Grand chiffre : somme total_ht des factures valid ce mois
- Sous-texte : "X factures validées TTN"
- Icône TrendingUp, couleur green

SECTION 3 — Graphique (Recharts BarChart) :
- Titre : "Évolution sur 6 mois"
- Axe X : mois (Sep, Oct, Nov, Déc, Jan, Fév)
- Deux séries en barres groupées :
  * CA HT (couleur or #d4a843)
  * TVA collectée (couleur green #2dd4a0)
- Tooltip custom avec format TND
- ResponsiveContainer 100% × 300px
- Pas de gridlines agressives (couleur border subtile)

SECTION 4 — Deux colonnes en bas :

Colonne gauche (60%) : "Dernières factures"
- Tableau des 8 dernières factures (toutes dates)
- Colonnes : N° Facture | Client | Date | Montant TTC | Statut
- Statut : badge coloré selon design system
- Clic sur ligne → /invoices/[id]
- Lien "Voir toutes les factures →" en bas à droite

Colonne droite (40%) : "Activité récente"
- Feed chronologique des dernières actions (depuis activity_log)
- Items avec icône + texte + heure relative
  * 📄 "Facture FP-2025-0023 créée" - il y a 5min
  * ✅ "FP-2025-0022 validée par TTN" - il y a 1h
  * 👤 "Client Société XYZ ajouté" - il y a 2h
  * ❌ "FP-2025-0020 rejetée : matricule invalide" - hier

Toutes les données sont fetched côté serveur avec Supabase.
Utilisez Supabase Realtime pour mettre à jour les statuts factures 
en direct (subscription sur table invoices WHERE company_id = ...).
```

---

## ═══════════════════════════════════════════════════
## PROMPT 5 — GESTION CLIENTS (CRUD COMPLET)
## ═══════════════════════════════════════════════════

```
Construis la page /clients et la page /clients/[id].

PAGE /clients — Liste :

Header de page :
- Titre "Clients" + compteur total entre parenthèses
- Barre de recherche (filtre temps réel : nom, matricule, email)
- Filtre type : Tous | B2B | B2C (tabs ou select)
- Bouton "Ajouter un client" (or)

Tableau des clients :
Colonnes :
  Nom | Type (badge B2B/B2C) | Matricule Fiscal | Téléphone | 
  Email | Factures (count) | CA Total (TTC) | Actions

Actions par ligne (dropdown menu) :
- Voir le détail → /clients/[id]
- Modifier (ouvre modal edit)
- Voir ses factures → /invoices?client_id={id}
- Supprimer (avec confirmation si factures existantes)

Empty state : illustration + "Ajoutez votre premier client" + bouton

Pagination : 25 par page, info "X à Y sur Z clients"

MODAL AJOUTER/MODIFIER CLIENT :
(Radix Dialog, 520px)

Section "Identification" :
- Type de client (toggle B2B / B2C — change les champs requis)
  → B2B : Matricule fiscal requis
  → B2C : Matricule fiscal optionnel, "Particulier" par défaut
- Raison sociale / Nom complet
- Matricule fiscal (validation si B2B) :
  Format tunisien : /^\d{7}[A-Z]\/[A-Z]\/[A-Z]{1,3}\/\d{3}$/
  Afficher message d'aide sous l'input : "Format: 1234567A/A/M/000"

Section "Coordonnées" :
- Adresse (textarea)
- Gouvernorat (select 24 gouvernorats tunisiens)
- Code postal
- Téléphone (format +216 XX XXX XXX)
- Email

Section "Banque" (optionnel, accordéon collapsible) :
- Nom de la banque
- RIB

Boutons : "Annuler" | "Enregistrer"
Validation react-hook-form + zod, erreurs inline.
Après save : toast succès + fermer modal + refresh liste.

PAGE /clients/[id] — Détail client :

Layout 2 colonnes :

Colonne gauche (35%) : Fiche client
- Nom + type badge
- Matricule fiscal
- Adresse, téléphone, email
- Gouvernorat
- RIB si renseigné
- Bouton "Modifier"
- Bouton "Voir toutes ses factures"

Stats de la relation :
- Total facturé (TTC)
- Nombre de factures
- Dernière facture (date)
- Délai moyen de paiement (calculé si dates paiement renseignées)

Colonne droite (65%) : Historique factures du client
- Mêmes colonnes que la liste principale
- Filtres statut
- Bouton "Créer une facture pour ce client" (pré-remplit le client)
```

---

## ═══════════════════════════════════════════════════
## PROMPT 6 — FORMULAIRE DE CRÉATION DE FACTURE
## ═══════════════════════════════════════════════════

```
Construis la page /invoices/new — c'est la page LA PLUS IMPORTANTE.

Layout : deux colonnes
- Gauche (65%) : Formulaire
- Droite (35%) : Panneau de totaux (sticky, suit le scroll)

═══ COLONNE GAUCHE : FORMULAIRE ═══

SECTION 1 — En-tête facture :
Grid 2 colonnes :
- Numéro de facture : auto-généré en lecture seule
  Format : {PREFIX}-{ANNÉE}-{COUNTER:04}  ex: "FP-2025-0042"
  Le counter est incrementé depuis companies.invoice_counter
  Petit bouton refresh (pour regénérer si conflit)
- Date de facture : DatePicker, défaut aujourd'hui
- Date d'échéance : DatePicker, optionnel, hint "J+30 recommandé"
- Référence client (optionnel, texte libre)

SECTION 2 — Client :
- Label "Facturer à"
- Combobox searchable parmi clients existants
  (filtre par nom ou matricule fiscal en temps réel)
- Après sélection : affiche carte récap client 
  (nom, matricule, adresse, type B2B/B2C)
- Lien "Ajouter un nouveau client" → ouvre modal inline
- Si client B2C : afficher note "Facture grand public — TVA simplifiée"

SECTION 3 — Lignes de facture :
Header du tableau : Description | Quantité | Prix unitaire HT | TVA | Total HT | Total TTC | ×

Bouton "Ajouter une ligne" en haut à droite (+ icon)

Chaque ligne (InvoiceLineItem component) :
- Description : input texte (placeholder "Prestation de service...")
- Quantité : number input, min 0.001, 3 décimales
- Prix unitaire HT : number input, 3 décimales, suffix "TND"
- Taux TVA : select stylisé :
  * 19% — Taux normal
  * 13% — Taux réduit (services)
  * 7% — Taux réduit spécial
  * 0% — Exonéré
- Montant HT : calculé automatiquement (grisé)
- Montant TTC : calculé automatiquement (grisé)  
- Bouton × supprimer la ligne

Calculs automatiques en temps réel à chaque changement.
Lignes réorganisables par drag (optionnel avec @dnd-kit/sortable).

Sous le tableau :
- Petit lien "Ajouter une remise globale" (ajoute une ligne négative)

SECTION 4 — Notes :
- Textarea "Notes / Conditions de paiement" (optionnel)
- Placeholder : "Ex: Paiement à 30 jours. RIB : ..."

═══ COLONNE DROITE : PANNEAU TOTAUX (sticky top-4) ═══

Carte récap totaux :
- Total HT : {montant} TND
- TVA 19% (base: X TND) : Y TND  [si lignes avec 19%]
- TVA 13% (base: X TND) : Y TND  [si lignes avec 13%]
- TVA 7%  (base: X TND) : Y TND  [si lignes avec 7%]
- Exonéré 0% (base: X TND) : — TND [informatif]
- Droit de timbre : 0,600 TND [fixe, toujours]
- Séparateur épais
- TOTAL TTC : {grand montant en or}
- Montant en toutes lettres : [texte généré automatiquement]
  Ex: "Mille deux cent trente dinars et zéro millimes"

Carte statut signature :
- Si mandat actif → badge vert "Signature Fatoura Pro ✓"
- Si cert propre → badge bleu "Votre certificat ANCE ✓"  
- Si rien → badge rouge "⚠ Signature non configurée"
  + lien "Configurer → /settings/mandate"

Boutons d'action (en bas, full width) :
1. "Enregistrer en brouillon" (gris secondaire)
   → POST /api/invoices (status: draft)
   → Toast "Brouillon sauvegardé" + redirect /invoices/[id]

2. "Soumettre à TTN →" (or, prominent, avec icône Send)
   → Si pas de signature : modal warning
   → Sinon : POST /api/invoices (status: pending) 
             + POST /api/invoices/submit
   → Loading state sur le bouton (spinner + "Soumission en cours...")
   → Succès : confetti animation subtile + toast vert + 
              afficher TTN_ID + bouton "Télécharger PDF"
   → Erreur : toast rouge + garder formulaire ouvert
   → Rejeté TTN : toast rouge avec raison détaillée

═══ LOGIQUE DE VALIDATION PRÉ-SOUMISSION ═══
Vérifications avant soumettre :
✓ Au moins une ligne de facture
✓ Toutes les descriptions remplies
✓ Tous les prix > 0
✓ Client sélectionné
✓ Date de facture remplie
✓ Si client B2B : matricule fiscal client renseigné
✓ Signature configurée (mandat ou cert propre)
Si validation échoue : afficher liste des erreurs en rouge

═══ AUTO-SAVE ═══
Auto-save en brouillon toutes les 30 secondes si des lignes existent.
Indicateur "Sauvegardé il y a 30s" dans le header.
```

---

## ═══════════════════════════════════════════════════
## PROMPT 7 — LISTE FACTURES ET PAGE DÉTAIL
## ═══════════════════════════════════════════════════

```
Construis /invoices (liste) et /invoices/[id] (détail).

PAGE /invoices — Liste complète :

Header :
- Titre "Factures" + total count
- Bouton "Nouvelle facture" (or)

Barre de filtres (row avec tous les filtres) :
- Recherche texte : numéro facture, nom client (debounced 300ms)
- Filtre Statut : select "Tous les statuts" | Draft | En attente | 
                  Validées | Rejetées | File d'attente
- Filtre Période : select "Ce mois" | "Ce trimestre" | "Cette année" | 
                   "Personnalisé" (affiche 2 date pickers)
- Filtre Client : select liste clients
- Bouton "Réinitialiser filtres" (apparaît si filtres actifs)

Résumé filtré (sous la barre) :
"X factures • Total HT: Y TND • TVA: Z TND • TTC: W TND"

TABLEAU :
Colonnes (toutes sortables par clic header) :
  ☐ | N° Facture | Client | Date | Échéance | HT | TVA | TTC | Statut | TTN_ID | Actions

- Checkbox par ligne pour sélection multiple
- N° Facture : monospace, lien clickable → /invoices/[id]
- Client : nom (+ badge B2B/B2C petit)
- Date : format DD/MM/YYYY
- Échéance : date + badge rouge "En retard" si dépassée + pas payée
- Montants : format X XXX,XXX TND (espace comme séparateur milliers, virgule décimale)
- Statut : badge coloré
- TTN_ID : si valid → afficher (cliquable → copy clipboard avec toast "Copié!")
           sinon — (tiret grisé)
- Actions : dropdown menu
  * 👁 Voir le détail
  * 📄 Télécharger PDF (si valid ou draft)
  * 📋 Dupliquer (crée un brouillon identique)
  * 🔄 Resoumette à TTN (si rejected ou draft)
  * ❌ Annuler/Supprimer (si draft uniquement)

SÉLECTION MULTIPLE (apparaît quand ≥ 1 sélectionnée) :
Barre d'action en haut : "X sélectionnées" + actions :
- Télécharger PDFs (zip)
- Resoumette TTN
- Exporter CSV

Pagination : 25 par page
"Affichage 1-25 sur 143 factures" + Previous/Next

Empty state selon filtre :
- Aucune facture : illustration facture + "Créez votre première facture"
- Aucun résultat : "Aucune facture ne correspond à vos filtres"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PAGE /invoices/[id] — Détail complet :

Layout 3 colonnes :

COLONNE PRINCIPALE (60%) : Aperçu facture (style papier blanc sur fond sombre)
La carte ressemble à une vraie facture professionnelle :

Header facture :
- Logo entreprise (si uploadé) + nom entreprise à gauche
- "FACTURE" en grand + numéro à droite
- Matricule fiscal émetteur
- Adresse + téléphone émetteur

Bloc client :
- "Facturer à :" + coordonnées client complètes
- Matricule fiscal client (si B2B)

Tableau infos :
- Date | Échéance | Référence | Mode paiement

Tableau des lignes :
- Header : Description | Qté | Prix HT | TVA | Total HT | Total TTC
- Lignes avec alternance subtile de fond
- Subtotaux par taux de TVA

Totaux (alignés à droite) :
- Total HT
- TVA 19% / 13% / 7% (seulement les taux utilisés)
- Droit de timbre : 0,600 TND
- ═══════════════
- TOTAL TTC (grand, gras)
- Montant en toutes lettres (italique, muted)

Pied de facture :
- Si valid : QR code TTN + "Facture validée TTN — ID: XXXXXX"
- RIB entreprise si renseigné
- Notes de paiement

COLONNE DROITE (40%) : Panneau de statut et actions

Carte statut TTN :
- Statut actuel (grand badge)
- Si valid : TTN_ID en monospace or + bouton copier
- Si rejected : raison du rejet en rouge (depuis ttn_rejection_reason)
- Si pending : animation pulsing "Soumission en cours..."
- Si queued : "Nouvelle tentative dans X minutes"

Timeline des événements :
- ⬤ Facture créée — DD/MM/YYYY HH:mm
- ⬤ Soumise à TTN — DD/MM/YYYY HH:mm  
- ⬤ Validée par TTN — DD/MM/YYYY HH:mm [si valid]
  ou ⬤ Rejetée — DD/MM/YYYY HH:mm [si rejected]

Statut paiement :
- Toggle : Non payée / Partiellement payée / Payée
- Si payée : date de paiement
- Bouton "Marquer comme payée" → update payment_status

Actions contextuelles (selon statut) :
- Tous statuts : "Télécharger PDF" | "Dupliquer"
- draft : "Modifier" | "Soumettre à TTN" | "Supprimer"
- rejected : "Resoumette à TTN" | "Voir l'erreur TTN"
- valid : "Envoyer par email au client" (futur)

Realtime : Si statut change (pending → valid/rejected),
mettre à jour automatiquement sans refresh (Supabase subscription).
```

---

## ═══════════════════════════════════════════════════
## PROMPT 8 — TVA ET DÉCLARATIONS FISCALES
## ═══════════════════════════════════════════════════

```
Construis la page /tva complète.

C'est la page qui aidera les clients à faire leur déclaration TVA 
mensuelle/trimestrielle à la DGI tunisienne.

SECTION 1 — Sélecteur de période :
Tabs stylisés :
- Trimestre actuel (ex: "T1 2026 — Jan-Fév-Mar") ACTIF PAR DÉFAUT
- T4 2025 | T3 2025 | T2 2025 | T1 2025
- Tab "Personnalisé" → ouvre date range picker (mois par mois)

Sous les tabs : "Données basées sur les factures validées TTN uniquement"

SECTION 2 — 4 Cartes KPIs :
Carte 1 : "CA HT Total" — somme total_ht des valid du trimestre
Carte 2 : "TVA Collectée" — somme total_tva des valid du trimestre
Carte 3 : "Factures Validées" — count des valid du trimestre
Carte 4 : "Droit de timbre total" — count × 0,600 TND

SECTION 3 — Tableau de ventilation par taux :
(C'est LE tableau pour la déclaration DGI)

Titre : "Ventilation TVA — À reporter sur votre déclaration"

Tableau :
Taux TVA | Base HT | Montant TVA | Nb Factures | % du CA

Ligne 19% : [base] | [tva] | [count] | [%]
Ligne 13% : [base] | [tva] | [count] | [%]
Ligne 7%  : [base] | [tva] | [count] | [%]
Ligne 0%  : [base] | — | [count] | [%]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL     : [total HT] | [total TVA] | [total count]

Chaque ligne a une barre de progression visuelle (% du CA)

SECTION 4 — Graphique mensuel :
BarChart Recharts pour les 3 mois du trimestre sélectionné
- Groupe de barres par mois
- Série 1 : CA HT (or)
- Série 2 : TVA collectée (vert)
- Axe Y en TND
- Tooltip avec détail HT + TVA + TTC

SECTION 5 — Liste des factures du trimestre :
Mini-tableau (collapsible) :
N° Facture | Client | Date | HT | TVA | TTC
Avec filtre par taux TVA
Compteur "Voir les 47 factures ▾"

SECTION 6 — Export et Actions :
Row de boutons :
- "Copier totaux" → copie dans clipboard le texte formaté :
  "TVA à déclarer T1 2026:
   Base 19%: X TND → TVA: Y TND
   Base 13%: X TND → TVA: Y TND
   Base 7%:  X TND → TVA: Z TND
   TOTAL TVA: W TND"

- "Exporter CSV" → download factures_tva_T1_2026.csv
  Colonnes: N° Facture, Client, Matricule, Date, Base HT, Taux TVA, 
  Montant TVA, Total TTC, TTN_ID

- "Télécharger récapitulatif PDF" → PDF formaté avec entête entreprise,
  tableau de ventilation, et mention "Pour déclaration DGI"

Note légale en bas : 
"Ces données sont basées sur les factures validées par la plateforme 
TTN/ElFatoora. Consultez votre expert-comptable pour votre déclaration."
```

---

## ═══════════════════════════════════════════════════
## PROMPT 9 — PARAMÈTRES COMPLETS (3 ONGLETS)
## ═══════════════════════════════════════════════════

```
Construis la page /settings avec navigation par onglets latéraux.

Layout : sidebar d'onglets à gauche (200px) + contenu à droite

ONGLETS :
- Entreprise
- Signature électronique ← le plus important
- Clés API
- Notifications
- Sécurité

━━━ ONGLET 1 : Informations Entreprise ━━━

Formulaire avec react-hook-form + zod :

Section "Identité" :
- Logo : upload zone (drag & drop ou clic)
  * Stocké dans Supabase Storage bucket "logos"
  * Préview circular avatar 80px
  * Formats: JPG, PNG, SVG max 2MB
- Raison sociale
- Matricule fiscal (avec validation format)
- Régime TVA (select : Réel | Forfait | Exonéré)
  Tooltip info : "Définit les taux TVA applicables"

Section "Adresse" :
- Adresse (textarea)
- Gouvernorat (select)
- Code postal
- Ville

Section "Contact" :
- Téléphone principal
- Téléphone secondaire (optionnel)
- Email professionnel
- Site web (optionnel)

Section "Banque" :
- Nom de la banque
- RIB complet
- IBAN (optionnel)
Note: "Apparaîtra sur vos factures PDF"

Section "Préférences de facturation" :
- Préfixe numéro facture (défaut "FP", max 5 chars)
- Numéro de départ (pour reprendre une séquence existante)
  Warning: "Attention à ne pas créer de doublons avec vos factures existantes"
- Conditions de paiement par défaut (texte, ex: "Paiement à 30 jours")

Bouton "Enregistrer les modifications" en bas (gold)

━━━ ONGLET 2 : Signature Électronique ━━━

C'est la page la plus stratégique.
Afficher l'état actuel avec 3 cas :

CAS A — Mandat actif (fond vert subtil) :
╔═══════════════════════════════════════╗
║ ✅ Mandat de signature actif          ║
║                                       ║
║ Cachet : Fatoura Pro SARL             ║
║ N° Certificat ANCE : FP-2025-XXXX    ║
║ Valide jusqu'au : 31/12/2026          ║
║                                       ║
║ Vos factures sont signées             ║
║ automatiquement par Fatoura Pro       ║
║ en votre nom.                         ║
║                                       ║
║ Accepté le : DD/MM/YYYY par [vous]   ║
║ Adresse IP : XX.XX.XX.XX             ║
╚═══════════════════════════════════════╝

Bouton "Révoquer le mandat" (rouge, avec modal confirmation) :
"Êtes-vous sûr ? Vous devrez configurer votre propre certificat ANCE 
pour continuer à soumettre des factures à TTN."
Boutons : "Annuler" | "Oui, révoquer"

CAS B — Certificat propre actif (fond bleu subtil) :
- Badge bleu "Votre certificat ANCE actif"
- Émetteur, N° série, Valide jusqu'au
- Alerte si expire dans < 60 jours
- Bouton "Remplacer le certificat" → ouvre formulaire upload

CAS C — Aucune signature (fond rouge subtil) :
- Badge rouge "⚠ Signature non configurée"
- Texte : "Sans signature, vos factures ne peuvent pas être soumises 
  à TTN/ElFatoora. Choisissez une option ci-dessous."

Option A (Card recommandée, border or) :
Titre : "🔏 Déléguer à Fatoura Pro"
Badge : "RECOMMANDÉ — Économisez 300-400 TND/an"
- Explication : "Nous signons vos factures avec notre cachet entreprise 
  ANCE. Aucun achat de token. Aucune configuration."
- Avantages : liste checkmarks verts
  ✓ Opérationnel immédiatement
  ✓ Cachet renouvelé automatiquement
  ✓ Inclus dans votre abonnement
  ✓ Légalement conforme (art. 4 politique TTN)
→ Affiche le composant MandateOnboarding (checkbox + bouton)

Option B (Card secondaire) :
Titre : "📜 Votre propre certificat ANCE"
- Explication : "Uploadez votre propre certificat. Nécessite un achat 
  auprès de l'ANCE (~300-400 TND/an) + configuration technique."
→ Formulaire upload :
  * Input fichier .p12 ou .pem (drag & drop)
  * Input mot de passe du certificat
  * Bouton "Importer le certificat"
  * Info : "Le certificat est chiffré et stocké de façon sécurisée"

━━━ ONGLET 3 : Clés API ━━━

Pour les intégrations ERP (Phase 2 de la roadmap).

Header : "API Keys — Intégration ERP"
Texte : "Permettez à votre ERP ou à des outils externes de soumettre 
des factures via notre API REST."

Liste des clés existantes :
Tableau : Nom | Préfixe | Permissions | Dernière utilisation | Expiration | Actions
Actions : Copier préfixe | Révoquer

Bouton "Créer une nouvelle clé API" :
Modal création :
- Nom de la clé (ex: "ERP Sage Production")
- Permissions (checkboxes) :
  ☑ invoices:write — Créer et soumettre des factures
  ☑ invoices:read  — Lire les factures
  ☐ tva:read       — Accéder aux données TVA
  ☐ clients:write  — Gérer les clients
- Date d'expiration (optionnel)
- Bouton "Générer la clé"

Après génération : afficher LA CLÉ UNE SEULE FOIS en grand
Format : fp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Bouton copier + warning "Cette clé ne sera plus affichée"

Section documentation :
- Lien vers docs API (placeholder)
- Exemple curl :
  curl -X POST https://api.fatoura.pro/v1/invoices \
    -H "Authorization: Bearer fp_live_..." \
    -d '{"client_id": "...", "lines": [...]}'

━━━ ONGLET 4 : Notifications ━━━

Préférences de notification :

Toggle switches :
✓ Facture validée par TTN → Email + In-app
✓ Facture rejetée par TTN → Email + In-app (urgent)
✓ Mandat expirant (-60j) → Email
✓ Certificat expirant (-60j) → Email
✓ Résumé TVA mensuel → Email (1er du mois)
✓ Rapport hebdomadaire → Email (lundi matin)

Email de notification : [champ email]

━━━ ONGLET 5 : Sécurité ━━━

- Changer le mot de passe
  (old pwd + new pwd + confirm)
- Sessions actives (liste devices + bouton "Déconnecter partout")
- Télécharger mes données (RGPD)
- Supprimer mon compte (danger zone, confirmation double)
```

---

## ═══════════════════════════════════════════════════
## PROMPT 10 — FLASH FINANCING (PAGE FUTURE)
## ═══════════════════════════════════════════════════

```
Construis la page /financing — Flash Financing.

C'est une fonctionnalité future mais la page doit être présente 
avec un état "coming soon" intelligent qui collecte des leads.

HEADER DE PAGE :
- Badge "BIENTÔT DISPONIBLE" en purple
- Titre : "Flash Financing"
- Sous-titre : "Obtenez un financement express basé sur vos factures TTN validées"

SECTION HERO (grande, impactante) :
- Illustration ou icône animée (lightning bolt or)
- Accroche : "Transformez vos factures en cash en 24h"
- Description : "Fatoura Pro analyse vos 6 derniers mois de factures 
  validées TTN et vous connecte avec des partenaires financiers 
  pour un financement instantané."

SECTION "COMMENT ÇA MARCHE" :
3 steps horizontaux avec icônes :
1. 📊 "Analyse automatique" — Vos factures TTN servent de garant
2. 💡 "Score en temps réel" — Algorithme basé sur votre historique fiscal
3. 💰 "Financement en 24h" — Virement direct sur votre compte

SECTION "VOTRE ÉLIGIBILITÉ ESTIMÉE" :
(Calculée depuis les vraies données Supabase de l'utilisateur)

Widget interactif :
- Si l'user a > 3 mois d'historique TTN validé :
  Afficher : "Éligibilité estimée : XX XXX TND"
  (Calcul : 30% du CA des 3 derniers mois validé TTN)
  Barre de progression verte
  "Basé sur X factures validées TTN"
  
- Si < 3 mois ou pas de factures valid :
  "Continuez à soumettre des factures à TTN pour débloquer 
   votre accès au financement"
  Barre de progression partielle
  "X/10 factures validées — encore Y pour débloquer"

FORMULAIRE D'INTÉRÊT (Early Access) :
- Input : Montant souhaité (slider 1 000 → 100 000 TND)
- Input : Durée remboursement (select : 1 / 3 / 6 / 12 mois)
- Affichage dynamique : "Mensualité estimée : ~X TND" (approximatif)
- Bouton "M'inscrire en liste d'attente" (or)
  → Insert dans table waitlist avec company_id + montant + durée
  → Toast "Inscription confirmée ! Nous vous contacterons en priorité."

SECTION "PARTENAIRES" (future) :
- Placeholders de logos de banques/fintechs tunisiennes
- "En cours de négociation"

SECTION FAQ :
Accordéon avec questions :
- "Quels documents sont nécessaires ?" → Réponse
- "Quels taux d'intérêt ?" → "À partir de X% selon profil"
- "Mes factures sont-elles en garantie ?" → Réponse légale

La page doit donner envie, pas frustrer.
Collecter les intérêts utilisateurs est l'objectif principal.
```

---

## ═══════════════════════════════════════════════════
## PROMPT 11 — ROUTES API COMPLÈTES
## ═══════════════════════════════════════════════════

```
Crée toutes les routes API Next.js.

IMPORTANT : les fichiers src/lib/ttn/* sont intouchables.
Seulement les importer. Ne jamais les réécrire.

━━━ HELPERS PARTAGÉS ━━━

Créer src/lib/api-helpers.ts :
- getAuthenticatedCompany(request) : vérifie session Supabase, 
  retourne { user, company } ou throw 401
- successResponse(data, status=200) : retourne NextResponse.json
- errorResponse(message, status) : retourne NextResponse.json
- logActivity(supabase, action, entity_type, entity_id, details) :
  insert dans activity_log

━━━ ROUTES FACTURES ━━━

GET /api/invoices :
Query params : status, client_id, from, to, page, limit
- Authentifier + get company_id
- Query Supabase avec tous les filtres
- JOIN avec clients pour le nom client
- Retourner { invoices, total, page, limit }

POST /api/invoices :
Body : { client_id, invoice_date, due_date, notes, lines[], status }
- Valider avec zod
- Générer invoice_number (atomic increment sur companies.invoice_counter)
- Calculer totaux côté serveur (ne pas faire confiance au client)
- Calculer total_in_words depuis lib/utils/amount-to-words.ts
- Insert invoices + invoice_lines (transaction)
- Log activity
- Retourner { invoice }

GET /api/invoices/[id] :
- Authentifier + vérifier ownership (company_id)
- Fetch invoice + invoice_lines + client
- Retourner objet complet

PUT /api/invoices/[id] :
- Seulement si status = 'draft'
- Recalculer tous les totaux
- Update invoices + delete+reinsert invoice_lines

DELETE /api/invoices/[id] :
- Seulement si status = 'draft'
- Soft delete ou vraie suppression

POST /api/invoices/submit :
Body : { invoiceId }
- Authentifier + ownership check
- Fetch invoice complète avec lignes et client et company
- Vérifier status = 'draft' ou 'rejected' ou 'queued'
- Update status = 'pending'
- Importer getSigningStrategy depuis src/lib/ttn/mandate-signer.ts
- Importer buildTEIF depuis src/lib/ttn/teif-builder.ts
- Importer submitToTTN depuis src/lib/ttn/ttn-gateway.ts
- Construire le XML TEIF
- Signer avec la stratégie détectée
- Soumettre à TTN
- Si succès TTN : 
  update invoice: status=valid, ttn_id, validated_at, ttn_xml, ttn_response
  insert notification: type=invoice_validated
  log activity
- Si erreur réseau/timeout :
  update invoice: status=queued
  insert ou update ttn_queue
- Si rejet TTN :
  update invoice: status=rejected, ttn_rejection_reason
  insert notification: type=invoice_rejected
  log activity
- Retourner { success, ttnId?, status, error? }

━━━ ROUTES CLIENTS ━━━

GET /api/clients : liste filtrée
POST /api/clients : créer
PUT /api/clients/[id] : modifier
DELETE /api/clients/[id] : supprimer (check si factures existantes)

━━━ ROUTES MANDAT ━━━

GET /api/mandate/status :
- Retourner {
    hasMandate: bool,
    hasOwnCert: bool,
    mode: 'mandate' | 'own_certificate' | 'not_configured',
    mandateAcceptedAt?: date,
    sealValidUntil?: date,
    isExpiringSoon?: bool  (< 60 jours)
  }

POST /api/mandate/accept :
Body : { companyId }
- Vérifier ownership
- Créer record dans mandates avec :
  ip_address: request.headers.get('x-forwarded-for')
  user_agent: request.headers.get('user-agent')
  seal_identifier: process.env.FATOURA_SEAL_SERIAL
  seal_valid_until: process.env.FATOURA_SEAL_EXPIRY
- Log activity
- Insert notification: type=mandate_accepted

PATCH /api/mandate/revoke :
- Trouver mandat actif, set is_active=false, revoked_at=now
- Log activity

━━━ ROUTES TVA ━━━

GET /api/tva :
Query: from, to (dates ISO)
- Aggregate depuis invoices WHERE status='valid' AND invoice_date BETWEEN
- Retourner {
    totalHT, totalTVA, totalTTC, invoiceCount, stampDuty,
    byRate: [
      { rate: 19, baseHT, tvaAmount, count },
      { rate: 13, baseHT, tvaAmount, count },
      { rate: 7, baseHT, tvaAmount, count },
      { rate: 0, baseHT, tvaAmount, count },
    ],
    byMonth: [{ month, totalHT, totalTVA }]
  }

━━━ ROUTE CRON ━━━

POST /api/ttn-queue/process :
Header : Authorization: Bearer {CRON_SECRET}
- Vérifier le secret (constant-time comparison)
- Fetch ttn_queue WHERE next_retry_at <= NOW AND attempts < max_attempts
- Pour chaque item :
  * Fetch la facture complète
  * Reessayer la soumission TTN (même logique que submit)
  * Si succès : supprimer de la queue
  * Si échec : 
    - attempts += 1
    - next_retry_at = NOW + (2^attempts * 15 minutes) [backoff exponentiel]
    - Si attempts = max_attempts : status = 'rejected', reason = last_error
- Retourner { processed, succeeded, failed }

━━━ ROUTE API KEYS (pour ERP) ━━━

GET /api/api-keys : liste les clés (hash masqué)
POST /api/api-keys : créer clé
  - Générer clé : fp_live_ + 32 chars random hex
  - Stocker UNIQUEMENT le sha256 de la clé
  - Retourner la vraie clé UNE SEULE FOIS
DELETE /api/api-keys/[id] : révoquer

Middleware pour API externe (si Authorization: Bearer fp_live_...) :
- Hasher la clé reçue
- Chercher dans api_keys WHERE key_hash = hash AND is_active = true
- Mettre à jour last_used_at
- Injecter company_id dans le context
```

---

## ═══════════════════════════════════════════════════
## PROMPT 12 — GÉNÉRATION PDF
## ═══════════════════════════════════════════════════

```
Implémente la génération PDF des factures avec @react-pdf/renderer.

Le PDF doit ressembler à une vraie facture professionnelle tunisienne.

Créer src/components/invoice/InvoicePDFTemplate.tsx :

STRUCTURE DU PDF :
Format A4, marges 40px, police Helvetica

En-tête :
- Gauche : Logo entreprise (si uploadé) ou nom en texte
  Nom entreprise, Matricule fiscal, Adresse, Téléphone, Email
- Droite : Titre "FACTURE" en grand (#d4a843)
  N° : FP-2025-0042
  Date : 27/02/2026
  Échéance : 29/03/2026

Séparateur ligne or

Bloc "Facturer à" :
- Encadré avec fond gris léger
- Nom client, Matricule, Adresse

Tableau des lignes :
- Header : bg #d4a843 text blanc
- Colonnes : Description | Qté | PU HT | TVA | Total HT | Total TTC
- Lignes alternées (blanc / gris très léger)
- Chaque ligne est un View avec les bonnes proportions flex

Section totaux (alignée à droite) :
- Total HT : X XXX,XXX TND
- TVA 19% (base: X TND) : Y TND
- TVA 13% (base: X TND) : Y TND  
- TVA 7% (base: X TND) : Y TND
- Droit de timbre : 0,600 TND
- Ligne épaisse
- TOTAL TTC : X XXX,XXX TND (gras, or)

Montant en toutes lettres :
Italique, centré : "Arrêté à la somme de : {total_in_words}"

Pied de page :
- Si facture valid : 
  "Facture électronique validée par TTN/ElFatoora"
  "TTN-ID : XXXXXXXXX"
  QR Code (générer avec 'qrcode' npm package, données = ttn_id)
- RIB entreprise si renseigné
- Conditions de paiement si renseignées
- Pagination "Page 1/1"

Note bas de page :
"Document généré par Fatoura Pro — www.fatoura.pro"

Route de download : GET /api/invoices/[id]/pdf
- Générer avec renderToBuffer(@react-pdf)
- Retourner avec Content-Type: application/pdf
- Nom fichier : Facture-{invoice_number}.pdf

Dans l'UI : le bouton "Télécharger PDF" fait un fetch vers cette route 
et déclenche le download avec un lien <a> dynamique.
```

---

## ═══════════════════════════════════════════════════
## PROMPT 13 — POLISH, UX ET FINITIONS
## ═══════════════════════════════════════════════════

```
Applique toutes les finitions UX pour une app production-ready.

LOADING STATES :
- Skeleton loaders pour tous les tableaux (shimmer animation)
- Spinner sur TOUS les boutons pendant les actions async
- Loading overlay pendant navigation entre pages
- Composant Skeleton réutilisable dans shared/LoadingSkeleton.tsx

TOAST NOTIFICATIONS (Sonner ou shadcn Toaster) :
Positionné en bas à droite.
Tous les cas :
✅ Succès : "Facture FP-2025-0042 soumise à TTN avec succès"
✅ Succès : "Facture validée ! TTN-ID: XXXXXXXXXXXXX"
✅ Succès : "Client sauvegardé"
✅ Succès : "Mandat de signature activé"
❌ Erreur : "Erreur de soumission TTN : {raison}"
❌ Erreur : "Facture rejetée : Matricule fiscal invalide"
ℹ️ Info : "Brouillon sauvegardé automatiquement"
ℹ️ Info : "TTN-ID copié dans le presse-papier"
⚠️ Warning : "Cette action est irréversible"

EMPTY STATES (composant EmptyState réutilisable) :
Chaque page doit avoir un empty state complet :
- /invoices vide : grande icône FileText + "Créez votre première facture" + bouton
- /clients vide : icône Users + "Ajoutez votre premier client" + bouton
- /tva sans données : icône Calculator + "Aucune facture validée TTN pour cette période"
- /invoices?status=rejected : icône AlertTriangle + "Aucune facture rejetée ✓"

RESPONSIVE (mobile-first) :
- < 640px (mobile) : sidebar cachée, tout en colonne, tableaux horizontalement scrollables
- 640-1024px (tablet) : sidebar icônes seulement (64px), layouts adaptés
- > 1024px (desktop) : sidebar complète 240px

CONFIRM DIALOG réutilisable (ConfirmDialog.tsx) :
Props : title, description, confirmText, cancelText, onConfirm, variant (danger/default)
Utiliser pour : supprimer client, révoquer mandat, supprimer facture, déconnecter partout

KEYBOARD SHORTCUTS :
- Ctrl+N : nouvelle facture
- Ctrl+F : focus barre de recherche
- Escape : fermer les modals

FORMULAIRES :
- Auto-focus sur le premier champ des modals
- Tab navigation logique
- Enter sur les inputs soumet le formulaire (où approprié)
- Sauvegarde automatique dans localStorage pour le formulaire de facture 
  (récupération si fermeture accidentelle)

ACCESSIBILITÉ :
- Aria labels sur tous les boutons iconiques
- Focus visible (outline gold)
- Roles ARIA appropriés sur les tableaux

PERFORMANCE :
- Lazy loading des pages lourdes
- Debounce 300ms sur toutes les barres de recherche
- Pagination côté serveur (pas de chargement de toutes les données)
- Mise en cache des données stables (liste clients, infos company)

PAGES D'ERREUR :
- 404.tsx : "Page introuvable" + bouton retour dashboard
- error.tsx : "Une erreur est survenue" + bouton réessayer + lien support

MÉTADONNÉES :
Chaque page a son propre <title> :
- Dashboard : "Tableau de bord — Fatoura Pro"
- Factures : "Mes factures — Fatoura Pro"
- Nouvelle facture : "Nouvelle facture — Fatoura Pro"
- etc.

PWA (optionnel mais recommandé) :
- manifest.json avec icônes
- Service worker basique pour offline fallback

VARIABLE D'ENVIRONNEMENT — fichier .env.local complet :
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

TTN_USERNAME=
TTN_PASSWORD=
TTN_API_URL=https://www.elfatoora.tn/ws
TTN_ENV=test

FATOURA_SEAL_PRIVATE_KEY=
FATOURA_SEAL_CERTIFICATE=
FATOURA_SEAL_SERIAL=FP-2025-XXXX
FATOURA_SEAL_EXPIRY=2026-12-31

CRON_SECRET=

NEXT_PUBLIC_APP_URL=https://fatoura.pro

FICHIER vercel.json :
{
  "crons": [{
    "path": "/api/ttn-queue/process",
    "schedule": "*/15 * * * *"
  }]
}
```

---

## ═══════════════════════════════════════════════════
## PROMPT 14 — MODE FIDUCIAIRE (FEATURE CLÉE)
## ═══════════════════════════════════════════════════

```
Implémente le mode Fiduciaire — canal d'acquisition n°1.

UN FIDUCIAIRE = un cabinet comptable qui gère plusieurs PMEs.
Il peut gérer TOUTES ses PMEs clients depuis un seul compte Fatoura Pro.

MODÈLE DE DONNÉES ADDITIONNEL :

-- Table pour les relations fiduciaire-client
fiduciaire_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiduciaire_company_id UUID REFERENCES companies(id),  -- Le cabinet
  client_company_id UUID REFERENCES companies(id),      -- La PME
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',  -- pending | active | revoked
  permissions TEXT[] DEFAULT '{invoices:all,clients:all,tva:read}'
)

-- Champ à ajouter à companies :
-- is_fiduciaire BOOLEAN DEFAULT FALSE

NOUVELLES PAGES :

/fiduciaire/dashboard :
- Visible seulement si companies.is_fiduciaire = true
- Vue consolidée de TOUS les clients du fiduciaire :
  * Grid de cartes clients
  * Chaque carte : Nom PME, Matricule, Nb factures ce mois, 
    Statut TTN (tout vert ✓ ou alerte rouge !)
  * Bouton "Gérer" → switche le contexte vers cette PME
  * Bouton "Inviter un client" → modal invitation

/fiduciaire/clients :
- Liste de toutes les PMEs du portefeuille
- Pour chaque PME : KPIs clés, statut signature, accès rapide

SWITCHER DE CONTEXTE (dans le header) :
Quand mode fiduciaire activé :
- Selector dropdown à côté du logo
  "Compte actif : {nom PME}" avec chevron
  Dropdown : liste de toutes les PMEs + "Mon cabinet"
- Quand une PME est sélectionnée : 
  toutes les pages (factures, clients, TVA) montrent les données 
  DE CETTE PME
- Badge visuel dans la sidebar : "Mode: {nom PME}" en or

INVITATION D'UN CLIENT :
Modal "Inviter un client" :
- Email du responsable de la PME
- Nom de la société
- Message personnalisé (optionnel)
→ Envoie email avec lien d'inscription pré-rempli
→ Quand la PME s'inscrit via ce lien : liée automatiquement au fiduciaire
→ Le fiduciaire peut alors accéder à son compte

RLS UPDATE :
La politique RLS doit permettre au fiduciaire d'accéder aux données
des PMEs pour lesquelles il a une relation active dans fiduciaire_clients.
```

---

## ═══════════════════════════════════════════════════
## INSTRUCTIONS FINALES POUR CASCADE PRO
## ═══════════════════════════════════════════════════

```
ORDRE DE BUILD RECOMMANDÉ :

1. Prompt 0 → Toujours en contexte
2. Prompt 1 → Structure + fichiers de config
3. Prompt 2 → Auth pages (login/register)
4. Prompt 3 → Layout (sidebar/header) — bloque tout le reste
5. Prompt 11 (API routes structure) → helpers + structure vide
6. Prompt 4 → Dashboard
7. Prompt 5 → Clients
8. Prompt 6 → Formulaire facture (le plus long)
9. Prompt 7 → Liste + détail factures
10. Prompt 8 → TVA
11. Prompt 9 → Paramètres + mandat
12. Prompt 12 → Génération PDF
13. Prompt 11 → Compléter toutes les routes API
14. Prompt 10 → Flash Financing page
15. Prompt 14 → Mode Fiduciaire
16. Prompt 13 → Polish + finitions

RÈGLES ABSOLUES À RAPPELER À CASCADE PRO :

1. NE JAMAIS toucher les fichiers src/lib/ttn/*
   → Seulement les importer

2. TOUS les calculs monétaires sont en NUMERIC(12,3) — 3 décimales
   → Format d'affichage : 1 234,500 TND

3. TOUJOURS vérifier le company_id dans chaque route API
   → Un user ne peut jamais accéder aux données d'une autre company

4. RLS activé sur TOUTES les tables Supabase
   → La vérification est côté base de données, pas seulement l'API

5. Le design system est fixe — ne jamais utiliser des couleurs 
   hors du design system défini dans le Prompt 0

6. Chaque action async a un loading state visible

7. Chaque formulaire utilise react-hook-form + zod
   → Validation côté client ET côté serveur (API)
```
