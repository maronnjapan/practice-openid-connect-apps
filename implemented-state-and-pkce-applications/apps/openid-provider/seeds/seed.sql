PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

DELETE FROM "RedirectUri";
DELETE FROM "Scope";
DELETE FROM "Client";
DELETE FROM "User";

INSERT INTO "User" ("id", "email", "password")
VALUES ('usr_seed_1', 'test@example.com', 'password123');

INSERT INTO "Client" ("clientId", "clientSecret")
VALUES ('cli_seed_1', 'secret_12345');

INSERT INTO "RedirectUri" ("id", "uri", "clientId")
VALUES ('ruri_seed_1', 'http://localhost:8788/callback', 'cli_seed_1');

INSERT INTO "Scope" ("id", "name", "clientId") VALUES
	('scp_profile', 'profile', 'cli_seed_1'),
	('scp_email',   'email',   'cli_seed_1');

COMMIT;
