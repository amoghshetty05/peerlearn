-- PeerLearn schema (SAD 3.1). Runs as the database owner/admin user.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(254)  NOT NULL UNIQUE CHECK (email ~ '^[^@[:space:]]+@pes\.edu$'),
  password_hash VARCHAR(100)  NOT NULL,
  role          VARCHAR(10)   NOT NULL CHECK (role IN ('learner','tutor','admin')),
  phone         VARCHAR(20),
  status        VARCHAR(12)   NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  warnings      INT           NOT NULL DEFAULT 0,
  failed_logins INT           NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tutor_subjects (
  id          SERIAL PRIMARY KEY,
  tutor_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     VARCHAR(60) NOT NULL,
  proficiency VARCHAR(12) NOT NULL CHECK (proficiency IN ('Beginner','Intermediate','Advanced')),
  UNIQUE (tutor_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_tutor_subjects_subject ON tutor_subjects(subject);

-- weekday: ISO, 1 = Monday ... 7 = Sunday. Times are local campus time (IST).
CREATE TABLE IF NOT EXISTS availability_slots (
  id         SERIAL PRIMARY KEY,
  tutor_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday    SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  CHECK (end_time > start_time),
  CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) / 60 BETWEEN 30 AND 120)
);
CREATE INDEX IF NOT EXISTS idx_slots_tutor ON availability_slots(tutor_id, weekday);

CREATE TABLE IF NOT EXISTS help_requests (
  id             SERIAL PRIMARY KEY,
  learner_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject        VARCHAR(60)  NOT NULL,
  topic          VARCHAR(200) NOT NULL,
  preferred_time TIMESTAMPTZ  NOT NULL,
  urgency        VARCHAR(8)   NOT NULL CHECK (urgency IN ('Low','Normal','High')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_requests_learner ON help_requests(learner_id);

CREATE TABLE IF NOT EXISTS sessions (
  id            SERIAL PRIMARY KEY,
  request_id    INT NOT NULL REFERENCES help_requests(id) ON DELETE CASCADE,
  learner_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tutor_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_time     TIMESTAMPTZ NOT NULL,
  status        VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','declined','expired','completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  responded_at  TIMESTAMPTZ,
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_tutor   ON sessions(tutor_id, status);

CREATE TABLE IF NOT EXISTS ratings (
  id         SERIAL PRIMARY KEY,
  session_id INT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  score      SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment    VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_groups (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100),
  subject    VARCHAR(60) NOT NULL,
  max_size   SMALLINT NOT NULL CHECK (max_size BETWEEN 3 AND 10),
  owner_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id  INT NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          SERIAL PRIMARY KEY,
  reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      VARCHAR(500) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','warned','suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by INT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  CHECK (reporter_id <> reported_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    VARCHAR(500) NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- No foreign key on purpose: audit records outlive the user they describe (SO-3).
CREATE TABLE IF NOT EXISTS audit_log (
  id        BIGSERIAL PRIMARY KEY,
  user_id   INT,
  action    VARCHAR(200) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, timestamp);

-- Append-only guard (SR-07): even the table owner cannot edit or delete rows.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log;
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- Supporting tables (not in SAD 3.1; needed by SAD 3.4 email retry and FR-02 logout)
CREATE TABLE IF NOT EXISTS email_outbox (
  id              SERIAL PRIMARY KEY,
  to_email        VARCHAR(254) NOT NULL,
  subject         VARCHAR(200) NOT NULL,
  body            TEXT NOT NULL,
  attempts        INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON email_outbox(next_attempt_at) WHERE sent_at IS NULL;

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti        UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
