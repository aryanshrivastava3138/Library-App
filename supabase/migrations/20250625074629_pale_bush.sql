/*
# Create Seat Bookings Table

1. New Tables
  - `seat_bookings`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to users)
    - `shift` (text) - time shift (morning/noon/evening/night)
    - `seat_number` (text) - seat identifier
    - `booking_status` (text) - booking status
    - `booking_date` (date) - date of booking
    - `created_at` (timestamp) - when booking was created

2. Security
  - Enable RLS on `seat_bookings` table
  - Add policies for users to manage their own bookings
*/

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

-- Policies
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

-- Admins can manage all seat bookings
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