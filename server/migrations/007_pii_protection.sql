-- P0.6: application-level PII protection and explicit legacy quarantine.
-- No legacy value is silently treated as ciphertext or destroyed by this migration.

ALTER TABLE customers RENAME COLUMN display_name TO display_name_legacy;
ALTER TABLE customers RENAME COLUMN phone_lookup_hash TO phone_legacy_hash;
ALTER TABLE customers ALTER COLUMN display_name_legacy DROP NOT NULL;
ALTER TABLE customers DROP CONSTRAINT customers_tenant_id_phone_lookup_hash_key;
ALTER TABLE customers
  ADD COLUMN display_name_ciphertext bytea,
  ADD COLUMN display_name_nonce bytea,
  ADD COLUMN display_name_auth_tag bytea,
  ADD COLUMN display_name_key_id text,
  ADD COLUMN phone_ciphertext bytea,
  ADD COLUMN phone_nonce bytea,
  ADD COLUMN phone_auth_tag bytea,
  ADD COLUMN phone_key_id text,
  ADD COLUMN phone_lookup_digest text,
  ADD COLUMN phone_lookup_key_id text,
  ADD COLUMN pii_migration_state text NOT NULL DEFAULT 'legacy_review_required'
    CHECK (pii_migration_state IN ('legacy_review_required','protected')),
  ADD CONSTRAINT customers_protected_name_complete CHECK (
    (pii_migration_state='legacy_review_required' AND display_name_legacy IS NOT NULL)
    OR
    (pii_migration_state='protected' AND display_name_legacy IS NULL
      AND display_name_ciphertext IS NOT NULL AND display_name_nonce IS NOT NULL
      AND display_name_auth_tag IS NOT NULL AND display_name_key_id IS NOT NULL)
  ),
  ADD CONSTRAINT customers_protected_phone_complete CHECK (
    pii_migration_state='legacy_review_required'
    OR (phone_legacy_hash IS NULL AND
      ((phone_ciphertext IS NULL AND phone_nonce IS NULL AND phone_auth_tag IS NULL AND phone_key_id IS NULL
        AND phone_lookup_digest IS NULL AND phone_lookup_key_id IS NULL)
       OR (phone_ciphertext IS NOT NULL AND phone_nonce IS NOT NULL AND phone_auth_tag IS NOT NULL
        AND phone_key_id IS NOT NULL AND phone_lookup_digest IS NOT NULL AND phone_lookup_key_id IS NOT NULL)))
  );
ALTER TABLE customers ALTER COLUMN pii_migration_state SET DEFAULT 'protected';
CREATE UNIQUE INDEX customers_tenant_phone_lookup_unique
  ON customers(tenant_id,phone_lookup_key_id,phone_lookup_digest)
  WHERE pii_migration_state='protected' AND phone_lookup_digest IS NOT NULL;

ALTER TABLE users RENAME COLUMN display_name TO display_name_legacy;
ALTER TABLE users ALTER COLUMN display_name_legacy DROP NOT NULL;
ALTER TABLE users
  ADD COLUMN display_name_ciphertext bytea,
  ADD COLUMN display_name_nonce bytea,
  ADD COLUMN display_name_auth_tag bytea,
  ADD COLUMN display_name_key_id text,
  ADD COLUMN pii_migration_state text NOT NULL DEFAULT 'legacy_review_required'
    CHECK (pii_migration_state IN ('legacy_review_required','protected')),
  ADD CONSTRAINT users_protected_name_complete CHECK (
    (pii_migration_state='legacy_review_required' AND display_name_legacy IS NOT NULL)
    OR
    (pii_migration_state='protected' AND display_name_legacy IS NULL
      AND ((display_name_ciphertext IS NULL AND display_name_nonce IS NULL AND display_name_auth_tag IS NULL AND display_name_key_id IS NULL)
        OR (display_name_ciphertext IS NOT NULL AND display_name_nonce IS NOT NULL
          AND display_name_auth_tag IS NOT NULL AND display_name_key_id IS NOT NULL)))
  );
ALTER TABLE users ALTER COLUMN pii_migration_state SET DEFAULT 'protected';

ALTER TABLE vehicles RENAME COLUMN plate_ciphertext TO plate_legacy_value;
ALTER TABLE vehicles RENAME COLUMN plate_hash TO plate_legacy_hash;
ALTER TABLE vehicles ALTER COLUMN plate_legacy_value DROP NOT NULL;
ALTER TABLE vehicles ALTER COLUMN plate_legacy_hash DROP NOT NULL;
ALTER TABLE vehicles DROP CONSTRAINT vehicles_tenant_id_plate_hash_key;
ALTER TABLE vehicles
  ADD COLUMN plate_ciphertext bytea,
  ADD COLUMN plate_nonce bytea,
  ADD COLUMN plate_auth_tag bytea,
  ADD COLUMN plate_key_id text,
  ADD COLUMN plate_lookup_digest text,
  ADD COLUMN plate_lookup_key_id text,
  ADD COLUMN pii_migration_state text NOT NULL DEFAULT 'legacy_review_required'
    CHECK (pii_migration_state IN ('legacy_review_required','protected')),
  ADD CONSTRAINT vehicles_protected_plate_complete CHECK (
    (pii_migration_state='legacy_review_required' AND plate_legacy_value IS NOT NULL)
    OR
    (pii_migration_state='protected' AND plate_legacy_value IS NULL AND plate_legacy_hash IS NULL
      AND plate_ciphertext IS NOT NULL AND plate_nonce IS NOT NULL AND plate_auth_tag IS NOT NULL
      AND plate_key_id IS NOT NULL AND plate_lookup_digest IS NOT NULL AND plate_lookup_key_id IS NOT NULL)
  );
ALTER TABLE vehicles ALTER COLUMN pii_migration_state SET DEFAULT 'protected';
CREATE UNIQUE INDEX vehicles_tenant_plate_lookup_unique
  ON vehicles(tenant_id,plate_lookup_key_id,plate_lookup_digest)
  WHERE pii_migration_state='protected';

ALTER TABLE appointments
  ADD COLUMN sensitive_details_ciphertext bytea,
  ADD COLUMN sensitive_details_nonce bytea,
  ADD COLUMN sensitive_details_auth_tag bytea,
  ADD COLUMN sensitive_details_key_id text,
  ADD COLUMN pii_migration_state text NOT NULL DEFAULT 'legacy_review_required'
    CHECK (pii_migration_state IN ('legacy_review_required','protected')),
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN purge_requested_at timestamptz,
  ADD CONSTRAINT appointments_sensitive_details_complete CHECK (
    pii_migration_state='legacy_review_required'
    OR
    (pii_migration_state='protected' AND sensitive_details_ciphertext IS NOT NULL
      AND sensitive_details_nonce IS NOT NULL AND sensitive_details_auth_tag IS NOT NULL
      AND sensitive_details_key_id IS NOT NULL AND notes IS NULL AND cardinality(symptoms)=0)
  );
ALTER TABLE appointments ALTER COLUMN pii_migration_state SET DEFAULT 'protected';

ALTER TABLE messages RENAME COLUMN content_jsonb TO content_legacy_jsonb;
ALTER TABLE messages ALTER COLUMN content_legacy_jsonb DROP NOT NULL;
ALTER TABLE messages
  ADD COLUMN content_metadata_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN content_ciphertext bytea,
  ADD COLUMN content_nonce bytea,
  ADD COLUMN content_auth_tag bytea,
  ADD COLUMN content_key_id text,
  ADD COLUMN pii_migration_state text NOT NULL DEFAULT 'legacy_review_required'
    CHECK (pii_migration_state IN ('legacy_review_required','protected')),
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN purge_requested_at timestamptz,
  ADD CONSTRAINT messages_protected_content_complete CHECK (
    (pii_migration_state='legacy_review_required' AND content_legacy_jsonb IS NOT NULL)
    OR
    (pii_migration_state='protected' AND content_legacy_jsonb IS NULL
      AND content_ciphertext IS NOT NULL AND content_nonce IS NOT NULL
      AND content_auth_tag IS NOT NULL AND content_key_id IS NOT NULL)
  );
ALTER TABLE messages ALTER COLUMN pii_migration_state SET DEFAULT 'protected';

ALTER TABLE calls RENAME COLUMN transcript_ref TO transcript_ref_legacy;
ALTER TABLE calls RENAME COLUMN recording_ref TO recording_ref_legacy;
ALTER TABLE calls
  ADD COLUMN media_refs_ciphertext bytea,
  ADD COLUMN media_refs_nonce bytea,
  ADD COLUMN media_refs_auth_tag bytea,
  ADD COLUMN media_refs_key_id text,
  ADD COLUMN pii_migration_state text NOT NULL DEFAULT 'protected'
    CHECK (pii_migration_state IN ('legacy_review_required','protected')),
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN purge_requested_at timestamptz;
UPDATE calls SET pii_migration_state='legacy_review_required'
  WHERE transcript_ref_legacy IS NOT NULL OR recording_ref_legacy IS NOT NULL;

ALTER TABLE inbox_events
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN purge_requested_at timestamptz;
ALTER TABLE outbox_events
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN purge_requested_at timestamptz;
ALTER TABLE audit_events
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN purge_requested_at timestamptz;

CREATE INDEX inbox_retention_candidates ON inbox_events(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND purge_requested_at IS NULL;
CREATE INDEX outbox_retention_candidates ON outbox_events(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND purge_requested_at IS NULL;
CREATE INDEX messages_retention_candidates ON messages(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND purge_requested_at IS NULL;
CREATE INDEX calls_retention_candidates ON calls(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND purge_requested_at IS NULL;
CREATE INDEX appointments_retention_candidates ON appointments(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND purge_requested_at IS NULL;
CREATE INDEX audit_retention_candidates ON audit_events(retention_expires_at)
  WHERE retention_expires_at IS NOT NULL AND purge_requested_at IS NULL;
