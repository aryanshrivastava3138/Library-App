/*
# Create Users Table

1. New Tables
  - `users`
    - `id` (uuid, primary key) - matches auth.users.id
    - `email` (text, unique) - user's email address
    - `full_name` (text) - user's full name
    - `mobile_number` (text) - user's mobile number
    - `role` (text) - user role (student/admin)
    - `created_at` (timestamp) - when user was created

2. Security
  - Enable RLS on `users` table
  - Add policy for users to read their own data
  - Add policy for users to update their own data
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to insert their own data during registration
CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);