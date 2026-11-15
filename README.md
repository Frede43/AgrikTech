# AgriConnect Burundi

Marketplace agricole pour le Burundi : elle relie **fermiers**, **acheteurs**, **livreurs/logistique** et **administrateurs** autour d'un circuit de vente sécurisé par séquestre (escrow), avec traçabilité des produits par QR code, conformité fiscale OBR (TVA 18 %, factures) et interface bilingue **français / kirundi**.

## Fonctionnalités principales

- **Marketplace** : catalogue produits, panier validé côté serveur, commande multi-articles.
- **Paiement séquestré** : les fonds de l'acheteur sont bloqués à la commande et libérés au fermier après livraison confirmée (commission plateforme 5 %).
- **Logistique** : pool de missions pour les livreurs, collecte validée par QR code, livraison validée par OTP remis à l'acheteur.
- **Connexion sans mot de passe** : OTP SMS à 6 chiffres, session cookie HttpOnly de 7 jours.
- **Traçabilité** : chaque produit possède un token QR public (`/trace/[token]`) affichant origine, certification et fraîcheur.
- **Fiscalité OBR** : ventilation HT/TVA/TTC, numéros de facture, rapport TVA mensuel pour l'admin.
- **Inclusion rurale** : mode hors-ligne (file d'attente de création de produits rejouée au retour du réseau), PWA, prix du marché « Soko Live », météo agricole par province (Open-Meteo).
- **Écosystème** : coopératives, demandes de micro-crédit, messagerie, litiges, retraits mobile money avec KYC.

## Architecture

| Couche | Technologie | Emplacement |
|---|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · shadcn/Radix · PWA | `app/`, `components/`, `lib/` |
| Backend | FastAPI · SQLAlchemy · Alembic | `backend/` |
| Base de données | SQLite (dev) / PostgreSQL (production) | `DATABASE_URL` |
| Tests | unittest (backend) · Playwright (e2e) | `backend/tests/`, `e2e/` |

Le frontend parle au backend via `lib/api-config.ts` (fetch + cookies de session). Les espaces protégés (`/acheteur`, `/fermier`, `/logistique`, `/admin`) sont gardés côté client par `useRequiredSession` ; la sécurité réelle est appliquée par le backend sur chaque endpoint.

## Démarrage rapide (développement)

Prérequis : Node.js ≥ 20, Python ≥ 3.12.

```bash
# 1. Backend
python -m venv venv
venv/Scripts/pip install -r backend/requirements.txt      # Windows
# venv/bin/pip install -r backend/requirements.txt        # Linux/macOS
venv/Scripts/python -m uvicorn backend.main:app --reload --port 8000

# 2. Frontend (autre terminal)
npm install
npm run dev
```

L'application est sur http://localhost:3000, l'API sur http://localhost:8000.

En développement, aucun SMS réel n'est envoyé : le code OTP s'affiche dans la console du backend (et il est renvoyé dans la réponse de `/auth/request-otp` sous `mock_otp`, jamais en production).

Données de démonstration et compte admin :

```bash
venv/Scripts/python -m backend.seed
venv/Scripts/python -m backend.create_admin +25779000001 --name "Admin"
```

## Configuration

Copier les exemples et les adapter :

- `backend/.env.example` → `backend/.env` (ou variables d'environnement)
- `.env.local.example` → `.env.local`

Principales variables :

| Variable | Rôle |
|---|---|
| `ENVIRONMENT` | `development` (défaut) pour le local ; toute autre valeur, dont `staging`, active les règles de production |
| `SECRET_KEY` | **Obligatoire en production**, au moins 32 caractères aléatoires |
| `DATABASE_URL` | PostgreSQL obligatoire en production (`postgresql://...`); SQLite réservé au développement et test |
| `FRONTEND_URL` | Une ou plusieurs origines HTTPS autorisées par le CORS en production |
| `SESSION_HTTPS_ONLY` / `SESSION_SAMESITE` | `true` / `none` hors développement et test |
| `SMS_PROVIDER` | `twilio`, `africastalking` ou `infobip` hors développement et test ; `console` est réservé au local |
| `MOBILE_MONEY_PROVIDER` | `api` avec URL HTTPS, clé API et secret webhook hors développement et test ; `mock` est réservé au local |
| `USSD_WEBHOOK_SECRET` | Secret aléatoire de 32 caractères minimum partagé avec la passerelle USSD ; sans lui, l'API USSD refuse les appels |
| `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` | Stockage distant des pièces KYC privées et des images produit; requis pour les uploads hors développement et test |
| `NEXT_PUBLIC_API_URL` | URL publique du backend, côté frontend |

## Migrations de base de données

Alembic est configuré dans `backend/` :

```bash
cd backend
../venv/Scripts/python -m alembic upgrade head
```

(En développement, les tables sont aussi créées automatiquement au démarrage via `create_all`.)

## Tests

```bash
npm run test:backend     # ~72 tests unittest du backend
npm run typecheck        # vérification TypeScript
npm run test:e2e         # 9 specs Playwright (démarre les 2 serveurs automatiquement)
npm run test:validate    # tout enchaîner
```

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute tests backend, typecheck et build à chaque push/PR.

## Déploiement en production

1. **Backend** (Render, Railway, Fly.io, VPS…) : `uvicorn backend.main:app`, PostgreSQL managé, `ENVIRONMENT=production`, `SECRET_KEY` généré, `SESSION_HTTPS_ONLY=true`, `FRONTEND_URL` = domaine du frontend.
2. **Frontend** (Vercel…) : définir `NEXT_PUBLIC_API_URL` = URL publique du backend.
3. **SMS** : configurer `SMS_PROVIDER=twilio`, `africastalking` ou `infobip` avec les identifiants du compte. Pour Infobip, définir `INFOBIP_BASE_URL` (par ex. `https://xxxxx.api.infobip.com`), `INFOBIP_API_KEY` et `INFOBIP_SENDER`. Le backend refuse de démarrer sans fournisseur réel hors développement et test.
4. **Mobile money** : `MOBILE_MONEY_PROVIDER=api`, URL HTTPS, clé de l'agrégateur et `MOBILE_MONEY_WEBHOOK_SECRET` aléatoire d'au moins 32 caractères ; chaque réponse ou webhook `SUCCESS` doit inclure un `provider_ref` unique (3–120 caractères). Sans référence, la commande reste en attente pour rapprochement admin. L'agrégateur confirme les paiements sur `POST /payments/webhook`.
5. **USSD** : définir le secret aléatoire `USSD_WEBHOOK_SECRET` (32 caractères minimum) dans l'API et dans la configuration d'en-tête de la passerelle. Les appels USSD sont refusés tant que le secret n'est pas configuré.
6. **Fichiers** : configurer les trois variables `IMAGEKIT_*` avec un endpoint HTTPS. Les nouveaux documents KYC sont privés et accessibles via l'API authentifiée ; les photos produits restent publiques. Les téléversements KYC et produit sont refusés si ImageKit n'est pas configuré hors développement et test.
7. **Base de données** : appliquer les migrations Alembic avant de recevoir du trafic (`alembic -c backend/alembic.ini upgrade head`).

Si l'agrégateur ne répond pas ou ne renvoie aucun webhook, la commande reste en attente et son stock est réservé. Après vérification dans le tableau de l'agrégateur, un admin peut soit enregistrer un paiement reçu avec `POST /admin/orders/{id}/confirm-payment` (`provider_confirmed_paid: true`, référence fournisseur et note d'au moins 10 caractères), soit libérer le stock avec `POST /admin/orders/{id}/cancel-unpaid-payment` (`provider_confirmed_unpaid: true` et note d'au moins 10 caractères). Ces actions sont journalisées. Les livreurs ne voient ni ne traitent une commande sans écriture de paiement en séquestre.

## Structure du projet

```
app/                 Pages Next.js par espace (acheteur, fermier, logistique, admin, public)
components/          Layouts et composants par espace + primitives ui/ (shadcn)
lib/                 Client API, session, i18n fr/ki, offline, panier, Soko Live
backend/
  main.py            App FastAPI (+ façade utilisée par les tests unitaires)
  routers/           25 routers REST (auth, orders, wallet, payments, obr, …)
  services/          Métier : escrow, mobile money, SMS, météo, marché, alertes
  models.py          20 tables SQLAlchemy
  alembic/           Migrations
  tests/             Tests unitaires
e2e/                 Tests Playwright bout-en-bout
```
