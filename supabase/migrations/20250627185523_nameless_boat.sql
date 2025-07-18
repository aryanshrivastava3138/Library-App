/*
# Complete Database Setup Migration

This migration creates all tables and policies for the Life Changer Library system.
It handles existing objects gracefully to avoid conflicts.

1. Tables Created:
   - users (with auth integration)
   - admissions (student enrollment data)
   - seat_bookings (seat reservation system)
   - attendance (check-in/out tracking)
   - payment_history (payment records)

2. Security:
   - Row Level Security enabled on all tables
   - Policies for user data access
   - Admin access policies where appropriate
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

-- Create seat_bookings table
CREATE TABLE IF NOT EXISTS seat_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift text NOT NULL CHECK (shift IN ('morning', 'noon', 'evening', 'night')),
  seat_number text NOT NULL,
  booking_status text NOT NULL DEFAULT 'booked' CHECK (booking_status IN ('booked', 'available')),
  booking_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shift, seat_number, booking_date)
);

-- Enable RLS
ALTER TABLE seat_bookings ENABLE ROW LEVEL SECURITY;

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

-- Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  payment_mode text NOT NULL CHECK (payment_mode IN ('upi', 'cash', 'card')),
  duration_months integer NOT NULL CHECK (duration_months IN (1, 3, 6)),
  payment_date timestamptz NOT NULL DEFAULT now(),
  receipt_number text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  -- Users table policies
  DROP POLICY IF EXISTS "Users can read own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  DROP POLICY IF EXISTS "Users can insert own data" ON users;
  
  -- Admissions table policies
  DROP POLICY IF EXISTS "Users can read own admissions" ON admissions;
  DROP POLICY IF EXISTS "Users can insert own admissions" ON admissions;
  DROP POLICY IF EXISTS "Users can update own admissions" ON admissions;
  DROP POLICY IF EXISTS "Admins can read all admissions" ON admissions;
  
  -- Seat bookings table policies
  DROP POLICY IF EXISTS "Users can read all seat bookings" ON seat_bookings;
  DROP POLICY IF EXISTS "Users can insert own seat bookings" ON seat_bookings;
  DROP POLICY IF EXISTS "Users can update own seat bookings" ON seat_bookings;
  DROP POLICY IF EXISTS "Admins can manage all seat bookings" ON seat_bookings;
  
  -- Attendance table policies
  DROP POLICY IF EXISTS "Users can read own attendance" ON attendance;
  DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;
  DROP POLICY IF EXISTS "Users can update own attendance" ON attendance;
  DROP POLICY IF EXISTS "Admins can read all attendance" ON attendance;
  
  -- Payment history table policies
  DROP POLICY IF EXISTS "Users can read own payment history" ON payment_history;
  DROP POLICY IF EXISTS "Users can insert own payment history" ON payment_history;
  DROP POLICY IF EXISTS "Admins can read all payment history" ON payment_history;
END $$;

-- Create all policies fresh
-- Users table policies
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

-- Admissions table policies
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

-- Seat bookings table policies
CREATE POLICY "Users can read all seat bookings"
  ON seat_bookings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own seat bookings"
  ON seat_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seat bookings"
  ON seat_bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all seat bookings"
  ON seat_bookings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Attendance table policies
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

-- Payment history table policies
CREATE POLICY "Users can read own payment history"
  ON payment_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment history"
  ON payment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all payment history"
  ON payment_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );