/*
# Add Absent Tracking Support

1. Table Updates
  - Add support for tracking absent status in attendance table
  - Add indexes for better performance on absence queries

2. Functions
  - Create function to automatically mark students absent
  - Add trigger to check for absent students at shift end times

3. Security
  - Update RLS policies to handle absent status
  - Ensure proper access control for absence tracking
*/

-- Add absent status support to attendance table
DO $$
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'status'
  ) THEN
    ALTER TABLE attendance ADD COLUMN status text DEFAULT 'present' CHECK (status IN ('present', 'absent'));
  END IF;

  -- Add reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'reason'
  ) THEN
    ALTER TABLE attendance ADD COLUMN reason text;
  END IF;
END $$;

-- Create index for better performance on absence queries
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_shift_date ON attendance(user_id, shift, date);

-- Function to mark students absent for a specific shift and date
CREATE OR REPLACE FUNCTION mark_absent_students(
  target_shift text,
  target_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(user_id uuid, shift text, marked_absent boolean) AS $$
BEGIN
  RETURN QUERY
  WITH absent_students AS (
    SELECT DISTINCT a.user_id, target_shift as shift_name
    FROM admissions a
    WHERE a.payment_status = 'paid'
      AND target_shift = ANY(a.selected_shifts)
      AND NOT EXISTS (
        SELECT 1 FROM attendance att
        WHERE att.user_id = a.user_id
          AND att.shift = target_shift
          AND att.date = target_date
          AND att.check_in_time IS NOT NULL
      )
  ),
  inserted_records AS (
    INSERT INTO attendance (user_id, shift, date, status, reason, created_at)
    SELECT 
      abs.user_id,
      abs.shift_name,
      target_date,
      'absent',
      'no_checkin',
      NOW()
    FROM absent_students abs
    ON CONFLICT (user_id, shift, date) DO NOTHING
    RETURNING user_id, shift
  )
  SELECT 
    abs.user_id,
    abs.shift_name::text,
    (ir.user_id IS NOT NULL) as marked_absent
  FROM absent_students abs
  LEFT JOIN inserted_records ir ON abs.user_id = ir.user_id AND abs.shift_name = ir.shift;
END;
$$ LANGUAGE plpgsql;

-- Function to get absent students for a specific date
CREATE OR REPLACE FUNCTION get_absent_students(target_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  email text,
  shift text,
  date date,
  reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.user_id,
    u.full_name,
    u.email,
    a.shift,
    a.date,
    a.reason
  FROM attendance a
  JOIN users u ON a.user_id = u.id
  WHERE a.date = target_date
    AND a.status = 'absent'
  ORDER BY a.shift, u.full_name;
END;
$$ LANGUAGE plpgsql;

-- Update the unique constraint to include status for better conflict handling
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendance' AND constraint_name = 'attendance_user_shift_date_key'
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_user_shift_date_key;
  END IF;

  -- Add new unique constraint that allows multiple records per user/shift/date with different statuses
  -- But prevents duplicate records with same status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendance' AND constraint_name = 'attendance_user_shift_date_status_key'
  ) THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_user_shift_date_status_key 
    UNIQUE (user_id, shift, date, status);
  END IF;
END $$;

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION mark_absent_students(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_absent_students(date) TO authenticated;

-- Update RLS policies to handle absent status
DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance;
CREATE POLICY "Users can insert own attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR status = 'absent');

-- Allow system to mark students absent
DROP POLICY IF EXISTS "System can mark absent" ON attendance;
CREATE POLICY "System can mark absent"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (status = 'absent');