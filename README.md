# PeerLearn

Campus peer-tutoring web app built from the PeerLearn SRS, SAD and Test Plan (v1.2).
Learners ask for help, get the top 5 ranked Tutors, and book a slot. Tutors accept or decline within 48 hours. Contact details stay hidden until a Tutor accepts.

**Stack (SAD 2.1):** React SPA, Node.js + Express REST API, PostgreSQL 16, nginx reverse proxy with TLS, SMTP email, and a Python FastAPI model service (scikit-learn, Keras 3, Qiskit) for Smart Match predictions.

```
peerlearn/
  backend/    Express API: routes (CMP-02), services (CMP-03 to CMP-10), dal (CMP-11), middleware, jobs
  frontend/   React SPA (CMP-01), Vite
  ml/         Smart Match model service (CMP-13, FR-16): 2 ML, 2 deep learning, 2 quantum models, FastAPI
  e2e/        Playwright end-to-end browser tests (TC-21 to TC-28, TC-30)
  db/         schema.sql (SAD 3.1)
  infra/      nginx.conf, certificate + TLS check scripts
  .github/    CI: tests, coverage gate, npm audit on every PR
  docker-compose.yml
```

## Submission: Software Engineering mini-project

**Team:** Amogh Shetty (PES1UG24AM034), Aarush Patil (PES1UG24AM005), Abheek Sen (PES1UG24AM009), Allen Anish (PES1UG24AM029)

### Team and contributions

| Member | GitHub | Role | Backlog stories owned |
|---|---|---|---|
| Amogh Shetty (PES1UG24AM034) | [@amoghshetty05](https://github.com/amoghshetty05) | Project lead and DevOps: repository owner, backlog and sprints, CI/CD, Docker, Docker Hub, Kubernetes, reviews and merges pull requests | FR-03, FR-04, FR-06, FR-10, FR-15, NFR-02, NFR-03 (tutor profiles, matching, study groups, performance) |
| Aarush Patil (PES1UG24AM005) | [@aarushpatil3101-tech](https://github.com/aarushpatil3101-tech) | Architecture, backend and database: wrote the application code (Express API, services, PostgreSQL schema) | FR-01, FR-02, FR-08, FR-11, FR-12a, FR-14, NFR-01, NFR-04 (accounts, booking, notifications, privacy, security) |
| Abheek Sen (PES1UG24AM009) | [@AbheekSen](https://github.com/AbheekSen) | Requirements and frontend: SRS, React screens, usability, live demo | FR-05, FR-07, FR-09, FR-12b, FR-13, NFR-05, S1-03 (help requests, matches view, ratings, admin UI, dashboard, responsive UI) |
| Allen Anish (PES1UG24AM029) | [@allen27anish-svg](https://github.com/allen27anish-svg) | Test lead: Test Plan, unit and system tests, coverage, CI test pipeline | NFR-06, NFR-07, NFR-08, S1-01, S1-02, S1-04, S1-05, S2-01, S2-02, S2-03 (setup, CI, tests, audit log, coverage, demo videos, documentation) |

The owner of each story is recorded on its [GitHub issue](https://github.com/amoghshetty05/peerlearn/issues?q=is%3Aissue).

| Deliverable | Where to find it |
|---|---|
| SRS | [docs/PeerLearn_Software_Requirements_Specification_SRS_v1.2.pdf](docs/PeerLearn_Software_Requirements_Specification_SRS_v1.2.pdf) |
| Software Test Plan (with test cases TC-01 to TC-20) | [docs/PeerLearn_Test_Plan_v1.2.pdf](docs/PeerLearn_Test_Plan_v1.2.pdf) |
| Software Architecture and Design Specification | [docs/PeerLearn_Software_Architecture_Design_Specification_SAD_v1.2.pdf](docs/PeerLearn_Software_Architecture_Design_Specification_SAD_v1.2.pdf) |
| Product backlog (story points, owners, Sprint 1 and Sprint 2) | [GitHub Project board](https://github.com/users/amoghshetty05/projects/1) and the [issues](https://github.com/amoghshetty05/peerlearn/issues?q=is%3Aissue) |
| Jira sprint reports (burnup, burndown, velocity) | Sprint 1: [burnup](docs/reports/jira/sprint1-burnup.jpg), [burndown](docs/reports/jira/sprint1-burndown.jpg); Sprint 2: [burnup](docs/reports/jira/sprint2-burnup.jpg), [burndown](docs/reports/jira/sprint2-burndown.jpg); [velocity](docs/reports/jira/velocity.jpg) |
| Sprint 1 demo video | [docs/videos/sprint1-demo.mp4](docs/videos/sprint1-demo.mp4) |
| Sprint 2 demo video | [docs/videos/sprint2-demo.mp4](docs/videos/sprint2-demo.mp4) |
| Unit test report | [docs/reports/PeerLearn_Unit_Test_Report.pdf](docs/reports/PeerLearn_Unit_Test_Report.pdf) |
| Code coverage report | [docs/reports/PeerLearn_Code_Coverage_Report.pdf](docs/reports/PeerLearn_Code_Coverage_Report.pdf), HTML in [docs/reports/coverage](docs/reports/coverage) |
| Branch coverage report | [docs/reports/PeerLearn_Branch_Coverage_Report.pdf](docs/reports/PeerLearn_Branch_Coverage_Report.pdf) |
| System test (system validation) report | [docs/reports/PeerLearn_System_Test_Report.pdf](docs/reports/PeerLearn_System_Test_Report.pdf), evidence in [docs/reports/system-test-evidence](docs/reports/system-test-evidence) |
| DevOps: Git, GitHub, GitHub Actions, Docker, Docker Hub, Kubernetes | [Actions runs](https://github.com/amoghshetty05/peerlearn/actions), [Docker Hub images](https://hub.docker.com/u/amoghshetty05), [k8s/](k8s) and the "DevOps pipeline" section below |
| Final version | Git tag [v1.0](https://github.com/amoghshetty05/peerlearn/releases/tag/v1.0) |

## Run it

### Option A: Docker (one command, full stack with TLS)
```bash
cp .env.example .env            # then change the secrets
./infra/gen-certs.sh            # self-signed cert for local use
docker compose up --build
```
Open **https://localhost** (accept the self-signed certificate). `http://localhost` redirects to HTTPS. Outgoing email is caught by MailHog at http://localhost:8025. The admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

### Option B: local development
```bash
# 1. PostgreSQL running locally, then:
export DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/peerlearn
export APP_DB_PASSWORD=app_pw ADMIN_EMAIL=admin@pes.edu ADMIN_PASSWORD='ChangeMe-Admin-1'
createdb -h localhost -U postgres peerlearn

cd backend && npm install
npm run migrate                 # schema + restricted app role (cannot edit or delete audit_log)
node scripts/seed-admin.js      # first Admin
npm run seed:demo               # optional demo users, password "Password123"

export DATABASE_URL=postgres://peerlearn_app:app_pw@localhost:5432/peerlearn
export JWT_SECRET=$(openssl rand -hex 32)
npm start                       # API on :4000

cd ../frontend && npm install && npm run dev    # http://localhost:5173 (proxies /api)
```
Demo accounts after `seed:demo`: learners `asha@pes.edu`, `vikram@pes.edu`; tutors `meera@`, `rohan@`, `nisha@`, `arjun@pes.edu`; all with password `Password123`.

## DevOps pipeline

Every tool the course requires is used, and each step leaves evidence in the repository or on Docker Hub.

| Tool | Where it is used | Evidence |
|---|---|---|
| Git | All source, documents and videos are version-controlled; one branch per change | Commit history |
| GitHub | Repository, pull requests reviewed and merged by the repo owner, Project board with the backlog, `main` protected by a ruleset | Pull requests, Projects tab, Settings > Rules |
| GitHub Actions | `.github/workflows/ci.yml`: `backend` (Jest tests, 70% coverage gate, `npm audit`), `frontend` (build, `npm audit`), `ml` (model service tests) and `e2e` (Playwright browser tests on the full Docker Compose stack) on every PR; `docker` and `kubernetes` on every push to `main` | Actions tab |
| Docker | `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` for the full local stack | `docker compose up --build` |
| Docker Hub | The `docker` job pushes `<user>/peerlearn-api`, `<user>/peerlearn-web` and `<user>/peerlearn-ml`, tagged with the commit SHA and `latest` | Docker Hub repositories |
| Kubernetes | `k8s/` manifests (namespace, PostgreSQL with a volume, migration Job, Smart Match model service, API, nginx web), applied by `k8s/deploy.sh`; the `kubernetes` job deploys the Docker Hub images to a kind cluster and logs in through nginx over HTTPS | `kubernetes` job log in the Actions tab |

Pipeline on every push to `main`: tests pass, then images are built and pushed to Docker Hub, then they are deployed to Kubernetes and smoke-tested.

### One-time setup for Docker Hub
1. Create a Docker Hub account and an access token (Account settings > Personal access tokens, Read & Write).
2. In GitHub: Settings > Secrets and variables > Actions > New repository secret. Add `DOCKERHUB_USERNAME` (lower case) and `DOCKERHUB_TOKEN`.
3. In `k8s/kustomization.yaml`, replace `DOCKERHUB_USERNAME` with the same username.

### Run on Kubernetes locally (Docker Desktop)
Turn on Kubernetes in Docker Desktop (Settings > Kubernetes > Enable Kubernetes), then from the repository root in Git Bash:
```bash
cp .env.example .env                       # then change the secrets
MSYS_NO_PATHCONV=1 ./infra/gen-certs.sh    # MSYS_NO_PATHCONV is needed only in Git Bash on Windows
sh k8s/deploy.sh
```
Open **https://localhost** (accept the self-signed certificate). Stop `docker compose` first if it is running, because both use ports 80 and 443. Remove everything with `kubectl delete namespace peerlearn`.

## Tests

```bash
cd backend
# needs a Postgres superuser; default is postgres://postgres:postgres@localhost:5432/postgres
export TEST_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
npm test            # creates a fresh peerlearn_test database, runs all suites, enforces >= 70% line coverage
npm run seed:perf   # 1,000 users / 200 tutors in the dev DB, then:
npm run load        # TC-18: 100 concurrent users for 60 s (SECONDS=20 for a short run)
```
Result on the last run here: **61 tests passing, 94.9% line coverage**, load test 100% of 2,926 requests under 1 s (p95 106 ms).
`npm audit --omit=dev --audit-level=high` (production packages) is clean for both `backend/` and `frontend/`; CI runs it on every PR.

### End-to-end browser tests (Playwright)

`e2e/` holds the automated browser tests (Test Plan TC-21 to TC-28 and TC-30). They open a real Chromium browser and drive the app through nginx over HTTPS, the way a student would: register, log in, search for tutors, book, accept, join a group, report and suspend, plus a 360-pixel phone layout check and security checks. Each test creates its own users, so the tests can run again and again on the same database.

```bash
docker compose up --build -d                       # full stack on https://localhost
cd e2e
npm ci && npx playwright install chromium          # first time only
npx playwright test                                # all tests, headless
npx playwright test --headed tests/booking.spec.js # watch one test run in a visible browser
npx playwright show-report                         # HTML report with screenshots and traces of failures
```
The `e2e` job in GitHub Actions runs the same tests on every pull request, and keeps the HTML report as the `playwright-report` artifact. Docker images are pushed only after these tests pass.

| File | Test case | Requirements |
|---|---|---|
| `tests/auth.spec.js` | TC-21 Registration and login | FR-01, FR-02 |
| `tests/access.spec.js` | TC-22 Access control | FR-02, SR-04, SR-05 |
| `tests/matching.spec.js` | TC-23 Ranked matches | FR-05, FR-06, FR-07 |
| `tests/booking.spec.js` | TC-24 Booking, acceptance, contact reveal | FR-08, FR-11, FR-13, FR-14 |
| `tests/groups.spec.js` | TC-25 Study groups | FR-10 |
| `tests/moderation.spec.js` | TC-26 Report and suspend | FR-12 |
| `tests/responsive.spec.js` | TC-27 Phone layout and 3-click booking | NFR-05, FR-13 |
| `tests/security.spec.js` | TC-28 HTTPS, headers, no hashes, input validation | SR-01, SR-02, SR-06 |
| `tests/smart-match.spec.js` | TC-30 Predicted success shown for every match | FR-16 |

## Smart Match: six prediction models (FR-16)

For every Tutor in the match list, Smart Match shows the predicted chance that the session succeeds (the Tutor accepts and the Learner rates it 4 or 5). The rule-based score still decides the order (FR-07); the prediction breaks ties and helps the Learner choose. If the model service is down, matching works as before without predictions.

| Family | Model | ROC-AUC | F1 |
|---|---|---|---|
| Baseline | Rule-based score (FR-06) | 0.749 | 0.805 |
| Machine learning | Logistic Regression (default) | 0.779 | 0.810 |
| Machine learning | Random Forest | 0.774 | 0.813 |
| Deep learning | Multilayer Perceptron (Keras) | 0.775 | 0.808 |
| Deep learning | Wide & Deep Network (Keras) | 0.775 | 0.811 |
| Quantum | Variational Quantum Classifier (Qiskit, 4 qubits) | 0.681 | 0.771 |
| Quantum | Quantum Kernel SVM (Qiskit, 4 qubits) | 0.680 | 0.768 |

Test set of 1,200 simulated sessions (seed 2026). The data is simulated because PeerLearn has no real usage history yet; see `ml/README.md` and the Model Comparison Report in `docs/reports`. All four classical models reach the best AUC possible on this data (0.78) and beat the rule-based score; the quantum models, limited to 4 qubits and 400 training rows on a simulator, do not yet.

## Requirement to code to test

| Requirement | Where it lives | Tests |
|---|---|---|
| FR-01 registration, @pes.edu only | `services/auth.js`, `schemas.js` | TC-01, TC-02 |
| FR-02 login, logout, 2 h token | `services/auth.js`, `middleware/authenticate.js` | TC-03, TC-19 |
| FR-03 tutor subjects (max 10) | `services/profile.js` | TC-05 |
| FR-04 availability, 30-120 min, no overlap | `services/profile.js`, `db/schema.sql` | TC-05 |
| FR-05 help request | `services/matching.js` | TC-06, TC-15 |
| FR-06, FR-15 score and rating bonus | `services/scoring.js` | TC-06, `unit/scoring.test.js` |
| FR-07 top 5 tutors with slots | `services/matching.js` | TC-06, TC-13 |
| FR-08 book, accept/decline, 48 h expiry | `services/session.js`, `jobs/scheduler.js` | TC-07, TC-08 |
| FR-09 ratings | `services/session.js` | TC-09 |
| FR-10 study groups (3-10) | `services/group.js` | TC-10 |
| FR-11 notifications and reminders | `services/notification.js`, `services/email.js` | TC-07, TC-08, `sessions.test.js` |
| FR-12 reports and moderation | `services/moderation.js` | TC-11 |
| FR-13 dashboard | `services/dashboard.js` | TC-07, TC-09 |
| FR-14 contact hidden until accepted | `serializers.js`, `services/profile.js` | TC-07 |
| NFR-01 bcrypt cost >= 10 | `services/auth.js`, `config.js` | TC-12 |
| NFR-03 matching under 2 s | `dal/tutors.js` (indexed query) | TC-13 |
| NFR-04 100 req/min/user | `middleware/rateLimiter.js` | TC-14 |
| NFR-05 three clicks and 360 px | `frontend/` | TC-17 (manual, see below) |
| NFR-06 audit log retained, append-only | `services/audit.js`, `db/schema.sql`, `scripts/migrate.js` | TC-16 |
| NFR-08 coverage >= 70% | `package.json` jest threshold, CI | CI |
| SR-01 HTTPS, TLS 1.2+ | `infra/nginx.conf`, `middleware/enforceHttps.js` | TC-19, `infra/verify-tls.sh` |
| SR-02 no hash or token leaks | `serializers.js` | TC-12 |
| SR-03 private data visibility | `services/profile.js` | TC-07 |
| SR-04 JWT, expiry | `middleware/authenticate.js` | TC-19 |
| SR-05 server-side role checks | `middleware/authorize.js`, `routes/index.js` | TC-04 |
| SR-06 validation, parameterised SQL | `schemas.js`, `middleware/validate.js`, `dal/` | TC-15 |
| SR-07 audit log | see NFR-06 | TC-16 |
| SR-08 lockout after 5 failures | `services/auth.js`, `dal/users.js` | TC-14 |
| SAD 3.4 error shape and codes | `errors.js`, `middleware/errorHandler.js` | all suites |

The request pipeline order is fixed as in SAD 2.4: rate limiter, token check, role check, validation, controller, error handler.

## Manual checks (TC-17 and TLS)

- **TC-17**: open the app in Chrome DevTools at 360 px width. No horizontal scroll; the navigation becomes a bottom tab bar. Booking from the Learner dashboard takes 3 clicks: Find a tutor, Show matching tutors, tap a time. Accepting a request takes 1 click from the Tutor dashboard.
- **TLS**: with the Docker stack running, `./infra/verify-tls.sh localhost` shows the HTTP redirect, TLS 1.2 accepted and TLS 1.1 refused.

## Decisions where the documents were silent or inconsistent

1. **One role per account.** SRS section 2.3 says a person may hold both roles, but FR-02 says exactly one role per account. I followed FR-02. A person who wants both registers two accounts.
2. **Extra endpoints** (needed by the UI or by a stated requirement): `POST /auth/logout` (FR-02, token revocation list), `GET/PUT /users/me`, `GET /users/{id}` (profile view in TC-07 and phone numbers), `GET /tutors/me`, `DELETE /tutors/me/availability/{id}`, `PUT/DELETE /tutors/me/subjects/{id}`, `GET /requests`, `GET /sessions`, `GET /groups`, `GET /groups/{id}`, `DELETE /groups/{id}/join` (leave), `PATCH /notifications/{id}`, `POST /notifications/read-all`, `GET /admin/reports`.
3. **Extra error code** `ACCOUNT_SUSPENDED` (403) so a suspended user sees why they cannot log in. All other codes are exactly those in SAD 3.4.
4. **Admins** cannot self-register; the first Admin comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
5. **Weekdays** are ISO numbers (1 = Monday ... 7 = Sunday) in campus time (IST, UTC+05:30). `PATCH /sessions/{id}` takes `{ "status": "accepted" | "declined" }`.
6. **Availability score**: 30 points if a slot covers the preferred time, 15 if the Tutor has any slot that weekday, else 0. **Proficiency score**: Beginner 7, Intermediate 13, Advanced 20 (of 20). Ties break on more ratings, then lower id.
7. **Completion**: an accepted session becomes `completed` automatically once its start time has passed (background job). Ratings are allowed only after that.
8. **Study groups**: members are the people who joined; the creator is not counted automatically (this is what TC-10 requires: a group of 3 takes 3 joiners). Both Learners and Tutors can create and join, as API-10 lists both roles. Subjects are stored lower-case so matching is an exact match.
9. **Rate limit**: 100 requests/minute per authenticated user, exactly as NFR-04. Anonymous requests (login, register) have no user, so they are limited per IP at 300/minute (`RATE_LIMIT_ANON_MAX`), because many students share one campus address. Brute force is stopped by the per-account lockout.
10. **Email retry** uses an `email_outbox` table: a failed SMTP send never cancels a booking and is retried with back-off.
11. **Audit log** is kept forever (never deleted), which satisfies the 90-day minimum in NFR-06. Both the database role and a trigger block UPDATE and DELETE.
12. **Dependencies**: bcrypt 6, zod 4, nodemailer 10, Vite 8 and React Router 7 were chosen so `npm audit` shows no high or critical issues (Test Plan section 5).
