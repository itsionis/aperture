-- Permissions overhaul — instance access config + unified grant model.
--
-- Adds:
--   * Four new enums (`access_mode`, `access_principal`, `access_scope`,
--     `access_capability`).
--   * `ap_instance` — singleton (`id = 1`) deployment config row carrying
--     `access_mode` (open vs restricted login).
--   * `ap_instance_owner` — the corp(s)/alliance(s) that own this deployment
--     (implicit login + Director⇒global-admin derivation).
--   * `ap_access_grant` — the unified grant table: allowlist entries
--     (`login`), explicit super-admin / manager hand-grants (`admin`/`manage`),
--     and (reserved) map-scope shares (`view`/`edit`).
--
-- No behaviour change yet: the resolver, login gate, and `/setup` wiring that
-- read these tables land in later stages. Rollback:
-- src/db/migrations/0034_permissions_overhaul.rollback.sql.

CREATE TYPE "public"."access_mode" AS ENUM('open', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."access_principal" AS ENUM('character', 'corporation', 'alliance', 'role');--> statement-breakpoint
CREATE TYPE "public"."access_scope" AS ENUM('instance', 'map');--> statement-breakpoint
CREATE TYPE "public"."access_capability" AS ENUM('login', 'admin', 'manage', 'view', 'edit');--> statement-breakpoint

CREATE TABLE "ap_instance" (
    "id" smallint PRIMARY KEY NOT NULL,
    "access_mode" "access_mode" DEFAULT 'restricted' NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "ap_instance_singleton_chk" CHECK ("id" = 1)
);--> statement-breakpoint

CREATE TABLE "ap_instance_owner" (
    "principal_kind" "access_principal" NOT NULL,
    "principal_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "ap_instance_owner_pk" PRIMARY KEY("principal_kind","principal_id"),
    CONSTRAINT "ap_instance_owner_kind_chk" CHECK ("principal_kind" IN ('corporation', 'alliance'))
);--> statement-breakpoint

CREATE TABLE "ap_access_grant" (
    "id" bigserial PRIMARY KEY NOT NULL,
    "principal_kind" "access_principal" NOT NULL,
    "principal_id" bigint NOT NULL,
    "scope" "access_scope" NOT NULL,
    "map_id" bigint,
    "capability" "access_capability" NOT NULL,
    "expires_at" timestamp with time zone,
    "note" text,
    "granted_by_character_id" bigint,
    "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "ap_access_grant_principal_capability_uq" UNIQUE NULLS NOT DISTINCT("principal_kind","principal_id","scope","map_id","capability"),
    CONSTRAINT "ap_access_grant_scope_map_chk" CHECK (("scope" = 'instance') = ("map_id" IS NULL)),
    CONSTRAINT "ap_access_grant_capability_scope_chk" CHECK (
        ("scope" = 'instance' AND "capability" IN ('login', 'admin', 'manage'))
        OR ("scope" = 'map' AND "capability" IN ('view', 'edit'))
    )
);--> statement-breakpoint
ALTER TABLE "ap_access_grant" ADD CONSTRAINT "ap_access_grant_map_id_ap_map_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."ap_map"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ap_access_grant" ADD CONSTRAINT "ap_access_grant_granted_by_character_id_ap_character_id_fk" FOREIGN KEY ("granted_by_character_id") REFERENCES "public"."ap_character"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ap_access_grant_principal_idx" ON "ap_access_grant" USING btree ("principal_kind","principal_id");--> statement-breakpoint
CREATE INDEX "ap_access_grant_map_id_idx" ON "ap_access_grant" USING btree ("map_id");
