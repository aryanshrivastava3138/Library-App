import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Admission } from '@/types/database';
import { addMonthsToDate } from '@/utils/dateUtils';
import QRCode from 'react-native-qrcode-svg';
import { CreditCard, CircleCheck as CheckCircle, ArrowLeft } from 'lucide-react-native';

export default function PaymentScreen() {
  const { user } = useAuth();
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetchAdmission();
  }, [user]);

  const fetchAdmission = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First, try to get the most recent admission
      const { data, error } = await supabase
        .from('admissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching admission:', error);
        Alert.alert('Error', 'Failed to load admission details');
        return;
      }

      if (data && data.length > 0) {
        setAdmission(data[0]);
      } else {
        // No admission found
        setAdmission(null);
      }
    } catch (error) {
      console.error('Error fetching admission:', error);
      Alert.alert('Error', 'Failed to load admission details');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmation = async () => {
    if (!admission) return;

    Alert.alert(
      'Confirm Payment',
      'Have you completed the payment using the QR code above?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, I have paid', onPress: confirmPayment },
      ]
    );
  };

  const confirmPayment = async () => {
    if (!admission || !user) return;

    setConfirming(true);

    try {
      const startDate = new Date().toISOString();
      const endDate = addMonthsToDate(new Date(), admission.duration).toISOString();

      const { error } = await supabase
        .from('admissions')
        .update({
          payment_status: 'paid',
          payment_date: startDate,
          start_date: startDate,
          end_date: endDate,
        })
        .eq('id', admission.id);

      if (error) throw error;

      // Create payment history record
      await supabase
        .from('payment_history')
        .insert({
          user_id: user.id,
          amount: admission.total_amount,
          payment_mode: 'upi',
          duration_months: admission.duration,
          payment_date: startDate,
          receipt_number: `LCL${Date.now()}`,
        });

      Alert.alert(
        'Payment Confirmed!',
        'Your admission has been confirmed. Welcome to Life Changer Library!',
        [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error) {
      console.error('Error confirming payment:', error);
      Alert.alert('Error', 'Failed to confirm payment. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!admission) {
    return (
      <View style={styles.container}>
        <Card style={styles.messageCard}>
          <Text style={styles.messageTitle}>No Admission Found</Text>
          <Text style={styles.messageText}>
            Please complete the admission form first.
          </Text>
          <Button
            title="Start Admission"
            onPress={() => router.push('/admission')}
          />
        </Card>
      </View>
    );
  }

  if (admission.payment_status === 'paid') {
    return (
      <View style={styles.container}>
        <Card style={styles.messageCard}>
          <CheckCircle size={64} color="#10B981" style={styles.successIcon} />
          <Text style={styles.messageTitle}>Payment Completed!</Text>
          <Text style={styles.messageText}>
            Your admission has been confirmed. Welcome to Life Changer Library!
          </Text>
          <Button
            title="Go to Dashboard"
            onPress={() => router.replace('/(tabs)')}
          />
        </Card>
      </View>
    );
  }

  // UPI payment string (example - replace with actual bank details)
  const upiString = `upi://pay?pa=libraryowner@paytm&pn=Life Changer Library&am=${admission.total_amount}&cu=INR&tn=Library Admission Fee`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Button
          onPress={() => router.back()}
          variant="outline"
          style={styles.backButton}
        >
          <ArrowLeft size={20} color="#2563EB" />
        </Button>
        <Text style={styles.title}>Payment</Text>
        <Text style={styles.subtitle}>Complete your admission payment</Text>
      </View>

      {/* Fee Breakdown */}
      <Card style={styles.feeCard}>
        <Text style={styles.sectionTitle}>Fee Breakdown</Text>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Registration Fee</Text>
          <Text style={styles.feeValue}>₹{admission.registration_fee}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Shift Fee ({admission.selected_shifts.join(', ')})</Text>
          <Text style={styles.feeValue}>₹{admission.shift_fee}</Text>
        </View>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Duration</Text>
          <Text style={styles.feeValue}>{admission.duration} month{admission.duration > 1 ? 's' : ''}</Text>
        </View>
        <View style={[styles.feeRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{admission.total_amount}</Text>
        </View>
      </Card>

      {/* QR Code Payment */}
      <Card style={styles.qrCard}>
        <Text style={styles.sectionTitle}>Scan to Pay</Text>
        <Text style={styles.qrSubtitle}>Use PhonePe app to scan and pay</Text>
        
        <View style={styles.qrContainer}>
          <Image
            source={{
              uri: 'https://images.pexels.com/photos/8919564/pexels-photo-8919564.jpeg?auto=compress&cs=tinysrgb&w=400&h=400&fit=crop'
            }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.paymentInfo}>
          <Text style={styles.paymentAmount}>₹{admission.total_amount}</Text>
          <Text style={styles.paymentNote}>
            Scan the QR code with PhonePe app or any UPI app like GPay, Paytm, or your banking app
          </Text>
        </View>

        <Button
          title={confirming ? 'Confirming...' : 'I Have Completed Payment'}
          onPress={handlePaymentConfirmation}
          disabled={confirming}
          style={styles.confirmButton}
        >
          <View style={styles.buttonContent}>
            <CreditCard size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {confirming ? 'Confirming...' : 'I Have Completed Payment'}
            </Text>
          </View>
        </Button>
      </Card>

      {/* Payment Instructions */}
      <Card style={styles.instructionsCard}>
        <Text style={styles.sectionTitle}>Payment Instructions</Text>
        <View style={styles.instructionsList}>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>1</Text>
            <Text style={styles.instructionText}>
              Open PhonePe app or any UPI app (GPay, Paytm, Banking app)
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>2</Text>
            <Text style={styles.instructionText}>
              Scan the QR code shown above
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>3</Text>
            <Text style={styles.instructionText}>
              Verify the amount (₹{admission.total_amount}) and complete payment
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>4</Text>
            <Text style={styles.instructionText}>
              Click "I Have Completed Payment" button after successful payment
            </Text>
          </View>
        </View>
      </Card>
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
  messageCard: {
    margin: 16,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  feeCard: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  feeValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  qrCard: {
    margin: 16,
    alignItems: 'center',
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
  },
  qrContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  paymentInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  paymentAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 8,
  },
  paymentNote: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmButton: {
    width: '100%',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructionsCard: {
    margin: 16,
    marginBottom: 32,
  },
  instructionsList: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
});