/*
  # Fix Users Table RLS Policies

  1. Security Updates
    - Drop existing problematic INSERT policy
    - Create new INSERT policy with correct auth.uid() function
    - Ensure all policies use proper Supabase auth functions
  
  2. Policy Changes
    - Fix INSERT policy to use auth.uid() instead of uid()
    - Maintain existing SELECT and UPDATE policies
    - Ensure authenticated users can create their own profiles
*/

-- Drop the existing INSERT policy that might be using incorrect function
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Create a new INSERT policy with correct auth function
CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure SELECT policy uses correct auth function
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Ensure UPDATE policy uses correct auth function  
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);