CREATE TABLE IF NOT EXISTS "ap_map_connection_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"connection_id" bigint NOT NULL,
	"character_id" bigint,
	"ship_type_id" integer,
	"mass" bigint NOT NULL,
	"jumped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ap_map_connection_log_connection_id_ap_map_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."ap_map_connection"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "ap_map_connection_log_character_id_ap_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."ap_character"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "ap_map_connection_log_ship_type_id_universe_type_id_fk" FOREIGN KEY ("ship_type_id") REFERENCES "public"."universe_type"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ap_map_connection_log_connection_id_idx" ON "ap_map_connection_log" USING btree ("connection_id");
