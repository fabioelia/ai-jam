-- AIJ-002 Batch 1: Agent Concurrency Control - Database Schema
-- Add support for agent session queuing and concurrent execution limits

-- Create enum for agent session status
CREATE TYPE "public"."agent_session_status" AS ENUM('pending', 'queued', 'spawning', 'running', 'paused', 'completed', 'failed');--> statement-breakpoint

-- Add max concurrent agents to projects (default 3, notNull)
ALTER TABLE "projects" ADD COLUMN "max_concurrent_agents" integer DEFAULT 3 NOT NULL;--> statement-breakpoint

-- Add max concurrent agents to features (nullable for feature-level overrides)
ALTER TABLE "features" ADD COLUMN "max_concurrent_agents" integer;--> statement-breakpoint

-- Update agent_sessions table for queuing support
-- Add queue position and queued timestamp
ALTER TABLE "agent_sessions" ADD COLUMN "queue_position" integer;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "queued_at" timestamp with time zone;--> statement-breakpoint

-- Convert status column from varchar to enum (data migration)
ALTER TABLE "agent_sessions" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent_sessions" ALTER COLUMN "status" SET DATA TYPE "public"."agent_session_status" USING "status"::text::"public"."agent_session_status";--> statement-breakpoint
ALTER TABLE "agent_sessions" ALTER COLUMN "status" SET DEFAULT 'pending';
