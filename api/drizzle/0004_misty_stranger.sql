CREATE TABLE "client_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid,
	"platform" text NOT NULL,
	"app_version" text NOT NULL,
	"message" text NOT NULL,
	"stack" text NOT NULL,
	"fatal" boolean NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "client_errors_created" ON "client_errors" USING btree ("created_at");