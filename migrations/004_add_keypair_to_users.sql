-- Paire de clés E2EE : publique en clair, privée chiffrée par le mot de passe.
ALTER TABLE users ADD COLUMN public_key TEXT;
ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
