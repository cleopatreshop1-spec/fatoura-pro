-- Add overdue_reminder_email preference to notification_preferences
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS overdue_reminder_email boolean NOT NULL DEFAULT true;
