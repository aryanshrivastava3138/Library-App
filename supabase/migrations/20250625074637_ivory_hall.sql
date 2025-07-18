/*
# Create Attendance Table

1. New Tables
  - `attendance`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to users)
    - `shift` (text) - time shift
    - `check_in_time` (timestamp) - when user checked in
    - `check_out_time` (timestamp) - when user checked out
    - `date` (date) - attendance date
    - `created_at` (timestamp) - when record was created

2. Security
  - Enable RLS on `attendance` table
  - Add policies for users to manage their own attendance
*/

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift text NOT NULL CHECK (shift IN ('morning', 'noon', 'evening', 'night')),
  check_in_time timestamptz,
  check_out_time timestamptz,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
  ON attendance
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all attendance
CREATE POLICY "Admins can read all attendance"
  ON attendance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );