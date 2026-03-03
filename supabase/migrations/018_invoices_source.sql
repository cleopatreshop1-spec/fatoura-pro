-- Migration 018: Add source column to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS
  source TEXT NOT NULL DEFAULT 'manual';
  -- 'manual' | 'ai' | 'scan' | 'recurring'
