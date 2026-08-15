# AgriConnect Burundi

Marketplace agricole pour le Burundi : elle relie **fermiers**, **acheteurs**, **livreurs/logistique** et **administrateurs** autour d'un circuit de vente sécurisé par séquestre (escrow), avec traçabilité des produits par QR code, conformité fiscale OBR (TVA 18 %, factures) et interface bilingue **français / kirundi**.

## Fonctionnalités principales

- **Marketplace** : catalogue produits, panier validé côté serveur, commande multi-articles.
- **Paiement séquestré** : les fonds de l'acheteur sont bloqués à la commande et libérés au fermier après livraison confirmée (commission plateforme 5 %).
- **Logistique** : pool de missions pour les livreurs, collecte validée par QR code, livraison validée par OTP remis à l'acheteur.
- **Connexion sans mot de passe** : OTP SMS à 4 chiffres, session cookie HttpOnly de 7 jours.
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
| `ENVIRONMENT` | `development` (défaut) ou `production` |
| `SECRET_KEY` | **Obligatoire en production** |
| `DATABASE_URL` | `postgresql://...` en production (SQLite par défaut) |
| `FRONTEND_URL` | Origine autorisée par le CORS |
| `SESSION_HTTPS_ONLY` | `true` en production (cookies Secure) |
| `SMS_PROVIDER` | `console` (simulateur) / `twilio` / `africastalking` |
| `MOBILE_MONEY_PROVIDER` | `mock` (simulé) / `api` (agrégateur REST + webhook `/payments/webhook`) |
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
3. **SMS** : configurer `SMS_PROVIDER=twilio` ou `africastalking` avec les identifiants du compte.
4. **Mobile money** : `MOBILE_MONEY_PROVIDER=api` + URL/clé de l'agrégateur + `MOBILE_MONEY_WEBHOOK_SECRET` ; l'agrégateur confirme les paiements sur `POST /payments/webhook`.
5. **Uploads** : `static/uploads` (photos produits, documents KYC) doit vivre sur un volume persistant ou un stockage objet (S3, R2).

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
