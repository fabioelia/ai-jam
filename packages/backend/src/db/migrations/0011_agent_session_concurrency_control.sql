-- AIJ-002 Batch 1: Agent Concurrency Control - Database Schema Changes
-- This migration adds support for queueing and tracking agent sessions with concurrency limits.

-- Create new enum for agent session status
CREATE TYPE "public"."agent_session_status" AS ENUM('pending', 'queued', 'spawning', 'running', 'paused', 'completed', 'failed');--> statement-breakpoint

-- Add maxConcurrentAgents to projects table (global limit per project)
ALTER TABLE "projects" ADD COLUMN "max_concurrent_agents" integer DEFAULT 3 NOT NULL;--> statement-breakpoint

-- Add maxConcurrentAgents to features table (per-feature override, nullable)
ALTER TABLE "features" ADD COLUMN "max_concurrent_agents" integer;--> statement-breakpoint

-- Add queue tracking to agent_sessions table
ALTER TABLE "agent_sessions" ADD COLUMN "queue_position" integer;--> statement-breakpoint

ALTER TABLE "agent_sessions" ADD COLUMN "queued_at" timestamp with time zone;
