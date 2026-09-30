-- Connexion par QR Code + OTP à 6 chiffres (durée de vie 3 minutes).
CREATE TABLE IF NOT EXISTS qr_sessions (
  session_token TEXT PRIMARY KEY,
  user_id       INTEGER,
  otp_hash      TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','scanned','validated','expired')),
  attempts      INTEGER DEFAULT 0,
  ip_desktop    TEXT,
  ip_mobile     TEXT,
  created_at    INTEGER NOT NULL,
  scanned_at    INTEGER,
  expires_at    INTEGER NOT NULL
);
