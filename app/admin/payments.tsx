import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CashPayment, User } from '@/types/database';
import { formatDate } from '@/utils/dateUtils';
import { ArrowLeft, CircleCheck as CheckCircle, Circle as XCircle, Clock, Banknote } from 'lucide-react-native';

interface CashPaymentWithUser extends CashPayment {
  user: User;
}

export default function AdminPaymentsScreen() {
  const { user } = useAuth();
  const [cashPayments, setCashPayments] = useState<CashPaymentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Redirect if not admin
  if (user?.role !== 'admin') {
    router.replace('/admin');
    return null;
  }

  useEffect(() => {
    fetchCashPayments();
  }, []);

  const fetchCashPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('cash_payments')
        .select(`
          *,
          user:users(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCashPayments(data || []);
    } catch (error) {
      console.error('Error fetching cash payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCashPayments();
    setRefreshing(false);
  };

  const handlePaymentAction = async (paymentId: string, action: 'approve' | 'reject', notes?: string) => {
    setProcessing(paymentId);

    try {
      const { error } = await supabase
        .from('cash_payments')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          admin_notes: notes,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Log admin action
      await supabase
        .from('admin_logs')
        .insert({
          admin_id: user?.id,
          action: `${action}_cash_payment`,
          details: { payment_id: paymentId, notes }
        });

      Alert.alert(
        'Success',
        `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully.`
      );

      await fetchCashPayments();
    } catch (error) {
      console.error(`Error ${action}ing payment:`, error);
      Alert.alert('Error', `Failed to ${action} payment. Please try again.`);
    } finally {
      setProcessing(null);
    }
  };

  const confirmAction = (payment: CashPaymentWithUser, action: 'approve' | 'reject') => {
    Alert.alert(
      `${action === 'approve' ? 'Approve' : 'Reject'} Payment`,
      `Are you sure you want to ${action} the cash payment of ₹${payment.amount} from ${payment.user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: () => handlePaymentAction(payment.id, action)
        }
      ]
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const pendingPayments = cashPayments.filter(p => p.status === 'pending');
  const processedPayments = cashPayments.filter(p => p.status !== 'pending');

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Button
          onPress={() => router.back()}
          variant="outline"
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#2563EB" />
        </Button>
        <Text style={styles.title}>Cash Payments</Text>
        <Text style={styles.subtitle}>Manage cash payment approvals</Text>
      </View>

      {/* Pending Payments */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          Pending Approvals ({pendingPayments.length})
        </Text>
        
        {pendingPayments.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>No pending cash payments to review</Text>
          </View>
        ) : (
          <View style={styles.paymentsList}>
            {pendingPayments.map((payment) => (
              <View key={payment.id} style={styles.paymentItem}>
                <View style={styles.paymentHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{payment.user.full_name}</Text>
                    <Text style={styles.userEmail}>{payment.user.email}</Text>
                  </View>
                  <View style={styles.amountContainer}>
                    <Text style={styles.amount}>₹{payment.amount}</Text>
                    <View style={styles.pendingBadge}>
                      <Clock size={12} color="#FFFFFF" />
                      <Text style={styles.pendingText}>PENDING</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.paymentDetails}>
                  <Text style={styles.detailText}>
                    Submitted: {formatDate(payment.created_at)}
                  </Text>
                  <Text style={styles.detailText}>
                    Mobile: {payment.user.mobile_number}
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <Button
                    title="Approve"
                    onPress={() => confirmAction(payment, 'approve')}
                    disabled={processing === payment.id}
                    size="small"
                    style={styles.approveButton}
                  >
                    <View style={styles.buttonContent}>
                      <CheckCircle size={16} color="#FFFFFF" />
                      <Text style={styles.buttonText}>Approve</Text>
                    </View>
                  </Button>

                  <Button
                    title="Reject"
                    onPress={() => confirmAction(payment, 'reject')}
                    disabled={processing === payment.id}
                    variant="danger"
                    size="small"
                    style={styles.rejectButton}
                  >
                    <View style={styles.buttonContent}>
                      <XCircle size={16} color="#FFFFFF" />
                      <Text style={styles.buttonText}>Reject</Text>
                    </View>
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Payment History */}
      {processedPayments.length > 0 && (
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <View style={styles.paymentsList}>
            {processedPayments.map((payment) => (
              <View key={payment.id} style={styles.historyItem}>
                <View style={styles.paymentHeader}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{payment.user.full_name}</Text>
                    <Text style={styles.userEmail}>{payment.user.email}</Text>
                  </View>
                  <View style={styles.amountContainer}>
                    <Text style={styles.amount}>₹{payment.amount}</Text>
                    <View style={[
                      styles.statusBadge,
                      payment.status === 'approved' ? styles.approvedBadge : styles.rejectedBadge
                    ]}>
                      {payment.status === 'approved' ? (
                        <CheckCircle size={12} color="#FFFFFF" />
                      ) : (
                        <XCircle size={12} color="#FFFFFF" />
                      )}
                      <Text style={styles.statusText}>
                        {payment.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.paymentDetails}>
                  <Text style={styles.detailText}>
                    Processed: {formatDate(payment.approved_at || payment.created_at)}
                  </Text>
                  {payment.admin_notes && (
                    <Text style={styles.notesText}>
                      Notes: {payment.admin_notes}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 24,
    paddingTop: 48,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  sectionCard: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  paymentsList: {
    gap: 16,
  },
  paymentItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.8,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748B',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 4,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pendingText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  approvedBadge: {
    backgroundColor: '#10B981',
  },
  rejectedBadge: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  paymentDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#10B981',
  },
  rejectButton: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});