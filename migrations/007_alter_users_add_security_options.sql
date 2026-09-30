-- Options de sécurité activables par l'utilisateur (désactivées par défaut).
ALTER TABLE users ADD COLUMN qr_login_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN biometric_enabled INTEGER DEFAULT 0;
