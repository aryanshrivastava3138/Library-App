/*
# Create Payment History Table

1. New Tables
  - `payment_history`
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to users)
    - `amount` (numeric) - payment amount
    - `payment_mode` (text) - payment method
    - `duration_months` (integer) - duration paid for
    - `payment_date` (timestamp) - when payment was made
    - `receipt_number` (text) - receipt identifier
    - `created_at` (timestamp) - when record was created

2. Security
  - Enable RLS on `payment_history` table
  - Add policies for users to read their own payment history
*/

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

-- Policies
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

-- Admins can read all payment history
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