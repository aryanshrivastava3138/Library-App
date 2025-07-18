/*
# Create Admissions Table

1. New Tables
  - `admissions`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to users)
    - `name` (text) - student's full name
    - `age` (integer) - student's age
    - `contact_number` (text) - student's contact
    - `full_address` (text) - student's address
    - `email` (text) - student's email
    - `course_name` (text) - course they're enrolling in
    - `father_name` (text) - father's name
    - `father_contact` (text) - father's contact
    - `duration` (integer) - course duration in months
    - `selected_shifts` (text array) - selected time shifts
    - `registration_fee` (numeric) - registration fee amount
    - `shift_fee` (numeric) - shift fee amount
    - `total_amount` (numeric) - total fee amount
    - `payment_status` (text) - payment status
    - `payment_date` (timestamp) - when payment was made
    - `start_date` (timestamp) - course start date
    - `end_date` (timestamp) - course end date
    - `created_at` (timestamp) - when admission was created

2. Security
  - Enable RLS on `admissions` table
  - Add policies for users to manage their own admissions
*/

-- Create admissions table
CREATE TABLE IF NOT EXISTS admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  age integer NOT NULL CHECK (age > 0 AND age < 150),
  contact_number text NOT NULL,
  full_address text NOT NULL,
  email text NOT NULL,
  course_name text NOT NULL,
  father_name text NOT NULL,
  father_contact text NOT NULL,
  duration integer NOT NULL CHECK (duration IN (1, 3, 6)),
  selected_shifts text[] NOT NULL DEFAULT '{}',
  registration_fee numeric(10,2) NOT NULL DEFAULT 50.00,
  shift_fee numeric(10,2) NOT NULL DEFAULT 0.00,
  total_amount numeric(10,2) NOT NULL DEFAULT 50.00,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own admissions"
  ON admissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own admissions"
  ON admissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own admissions"
  ON admissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all admissions
CREATE POLICY "Admins can read all admissions"
  ON admissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );