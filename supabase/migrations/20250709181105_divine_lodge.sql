/*
  # Create users table and authentication setup

  1. New Tables
    - `users`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, not null)
      - `full_name` (text, not null)
      - `mobile_number` (text, not null)
      - `role` (text, default 'student')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `users` table
    - Add policy for users to read their own data
    - Add policy for users to update their own data
    - Add policy for authenticated users to insert their own data

  3. Functions
    - Create function to automatically update `updated_at` timestamp
    - Create trigger to call the function on updates
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  mobile_number text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);