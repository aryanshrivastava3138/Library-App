/*
# Enhanced Features Migration

1. New Tables
  - `cash_payments` - Track cash payment requests and approvals
  - `notifications` - System notifications for students
  - `admin_logs` - Track admin actions for audit trail

2. Functions
  - Dashboard statistics function
  - Notification management functions

3. Security
  - RLS policies for all new tables
  - Admin-only access where appropriate
*/

-- Create cash_payments table
CREATE TABLE IF NOT EXISTS cash_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES seat_bookings(id) ON DELETE CASCADE,
  admission_id uuid REFERENCES admissions(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Create admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid REFERENCES users(id),
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cash_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Cash payments policies
CREATE POLICY "Users can read own cash payments"
  ON cash_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash payments"
  ON cash_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all cash payments"
  ON cash_payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Notifications policies
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Admin logs policies
CREATE POLICY "Admins can read all admin logs"
  ON admin_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert admin logs"
  ON admin_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Dashboard statistics function
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  total_students int;
  active_students int;
  total_bookings_today int;
  pending_cash_payments int;
  expiring_soon int;
  shift_occupancy jsonb;
BEGIN
  -- Total students
  SELECT COUNT(*) INTO total_students
  FROM users WHERE role = 'student';
  
  -- Active students (with paid admissions)
  SELECT COUNT(DISTINCT a.user_id) INTO active_students
  FROM admissions a
  WHERE a.payment_status = 'paid'
    AND a.end_date > NOW();
  
  -- Today's bookings
  SELECT COUNT(*) INTO total_bookings_today
  FROM seat_bookings
  WHERE booking_date = CURRENT_DATE;
  
  -- Pending cash payments
  SELECT COUNT(*) INTO pending_cash_payments
  FROM cash_payments
  WHERE status = 'pending';
  
  -- Expiring soon (within 7 days)
  SELECT COUNT(*) INTO expiring_soon
  FROM admissions
  WHERE payment_status = 'paid'
    AND end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days';
  
  -- Shift occupancy for today
  SELECT jsonb_object_agg(
    shift,
    jsonb_build_object(
      'booked', booked_count,
      'total', 50,
      'percentage', ROUND((booked_count::numeric / 50) * 100, 1)
    )
  ) INTO shift_occupancy
  FROM (
    SELECT 
      shift,
      COUNT(*) as booked_count
    FROM seat_bookings
    WHERE booking_date = CURRENT_DATE
      AND booking_status = 'booked'
    GROUP BY shift
    
    UNION ALL
    
    SELECT unnest(ARRAY['morning', 'noon', 'evening', 'night']) as shift, 0 as booked_count
  ) shift_data
  GROUP BY shift;
  
  -- Build result
  result := jsonb_build_object(
    'total_students', total_students,
    'active_students', active_students,
    'total_bookings_today', total_bookings_today,
    'pending_cash_payments', pending_cash_payments,
    'expiring_soon', expiring_soon,
    'shift_occupancy', COALESCE(shift_occupancy, '{}'::jsonb),
    'created_at', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cash_payments_status ON cash_payments(status);
CREATE INDEX IF NOT EXISTS idx_cash_payments_user_id ON cash_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);