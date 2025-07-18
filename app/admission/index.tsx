import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { SHIFTS } from '@/types/shifts';
import { calculateTotalAmount, calculateShiftFee } from '@/utils/shiftUtils';
import { ArrowLeft, CircleCheck as CheckCircle } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function AdmissionScreen() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.full_name || '',
    age: '',
    contactNumber: user?.mobile_number || '',
    fullAddress: '',
    email: user?.email || '',
    courseName: '',
    fatherName: '',
    fatherContact: '',
    duration: '1' as '1' | '3' | '6',
    selectedShifts: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    // Validation
    if (!formData.name || !formData.age || !formData.contactNumber || 
        !formData.fullAddress || !formData.email || !formData.courseName ||
        !formData.fatherName || !formData.fatherContact || 
        formData.selectedShifts.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.selectedShifts.length === 0) {
      setError('Please select at least one shift');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const shiftFee = calculateShiftFee(formData.selectedShifts);
      const totalAmount = shiftFee + 50; // 50 is registration fee

      const { error: admissionError } = await supabase
        .from('admissions')
        .insert({
          user_id: user?.id,
          name: formData.name,
          age: parseInt(formData.age),
          contact_number: formData.contactNumber,
          full_address: formData.fullAddress,
          email: formData.email,
          course_name: formData.courseName,
          father_name: formData.fatherName,
          father_contact: formData.fatherContact,
          duration: parseInt(formData.duration) as 1 | 3 | 6,
          selected_shifts: formData.selectedShifts,
          registration_fee: 50,
          shift_fee: shiftFee,
          total_amount: totalAmount,
          payment_status: 'pending',
        });

      if (admissionError) throw admissionError;

      router.push('/payment');
    } catch (error) {
      console.error('Error submitting admission:', error);
      setError('Failed to submit admission. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleShift = (shiftId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedShifts: prev.selectedShifts.includes(shiftId)
        ? prev.selectedShifts.filter(id => id !== shiftId)
        : [...prev.selectedShifts, shiftId]
    }));
  };

  const shiftFee = calculateShiftFee(formData.selectedShifts);
  const totalAmount = shiftFee + 50; // 50 is registration fee

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Button
            onPress={() => router.replace('/(tabs)')}
            variant="outline"
            style={styles.backButton}
          >
            <ArrowLeft size={20} color="#2563EB" />
          </Button>
          <Text style={styles.title}>Admission Form</Text>
          <Text style={styles.subtitle}>Fill in your details to complete admission</Text>
        </View>

        <Card style={styles.formCard}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Input
            label="Full Name"
            value={formData.name}
            onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            required
          />

          <Input
            label="Age"
            value={formData.age}
            onChangeText={(text) => setFormData(prev => ({ ...prev, age: text }))}
            keyboardType="numeric"
            required
          />

          <Input
            label="Contact Number"
            value={formData.contactNumber}
            onChangeText={(text) => setFormData(prev => ({ ...prev, contactNumber: text }))}
            keyboardType="phone-pad"
            required
          />

          <Input
            label="Full Address"
            value={formData.fullAddress}
            onChangeText={(text) => setFormData(prev => ({ ...prev, fullAddress: text }))}
            multiline
            numberOfLines={3}
            required
          />

          <Input
            label="Email"
            value={formData.email}
            onChangeText={(text) => setFormData(prev => ({ ...prev, email: text }))}
            keyboardType="email-address"
            autoCapitalize="none"
            required
          />

          <Input
            label="Course Name"
            value={formData.courseName}
            onChangeText={(text) => setFormData(prev => ({ ...prev, courseName: text }))}
            required
          />

          <Input
            label="Father's Name"
            value={formData.fatherName}
            onChangeText={(text) => setFormData(prev => ({ ...prev, fatherName: text }))}
            required
          />

          <Input
            label="Father's Contact Number"
            value={formData.fatherContact}
            onChangeText={(text) => setFormData(prev => ({ ...prev, fatherContact: text }))}
            keyboardType="phone-pad"
            required
          />

          {/* Duration Selection */}
          <Text style={styles.sectionTitle}>Duration *</Text>
          <View style={styles.durationContainer}>
            {[1, 3, 6].map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[
                  styles.durationOption,
                  formData.duration === duration.toString() && styles.durationSelected
                ]}
                onPress={() => setFormData(prev => ({ ...prev, duration: duration.toString() as '1' | '3' | '6' }))}
              >
                <Text style={[
                  styles.durationText,
                  formData.duration === duration.toString() && styles.durationTextSelected
                ]}>
                  {duration} Month{duration > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Shift Selection */}
          <Text style={styles.sectionTitle}>Select Shifts *</Text>
          <View style={styles.shiftsContainer}>
            {SHIFTS.map((shift) => (
              <TouchableOpacity
                key={shift.id}
                style={[
                  styles.shiftOption,
                  formData.selectedShifts.includes(shift.id) && styles.shiftSelected
                ]}
                onPress={() => toggleShift(shift.id)}
              >
                <View style={styles.shiftHeader}>
                  <Text style={[
                    styles.shiftName,
                    formData.selectedShifts.includes(shift.id) && styles.shiftNameSelected
                  ]}>
                    {shift.name}
                  </Text>
                  {formData.selectedShifts.includes(shift.id) && (
                    <CheckCircle size={20} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[
                  styles.shiftTime,
                  formData.selectedShifts.includes(shift.id) && styles.shiftTimeSelected
                ]}>
                  {shift.timeRange}
                </Text>
                <Text style={[
                  styles.shiftPrice,
                  formData.selectedShifts.includes(shift.id) && styles.shiftPriceSelected
                ]}>
                  ₹{shift.price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Total Amount Preview */}
          {formData.selectedShifts.length > 0 && (
            <Card style={styles.totalCard}>
              <Text style={styles.totalTitle}>Fee Summary</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Registration Fee</Text>
                <Text style={styles.totalValue}>₹50</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Shift Fee</Text>
                <Text style={styles.totalValue}>₹{shiftFee}</Text>
              </View>
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={styles.totalLabelFinal}>Total Amount</Text>
                <Text style={styles.totalValueFinal}>₹{totalAmount}</Text>
              </View>
            </Card>
          )}

          <Button
            title={loading ? 'Submitting...' : 'Submit Admission Form'}
            onPress={handleSubmit}
            disabled={loading || formData.selectedShifts.length === 0}
            style={styles.submitButton}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  formCard: {
    margin: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
    marginTop: 8,
  },
  durationContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  durationOption: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    alignItems: 'center',
  },
  durationSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  durationText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  durationTextSelected: {
    color: '#FFFFFF',
  },
  shiftsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  shiftOption: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  shiftSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shiftName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  shiftNameSelected: {
    color: '#FFFFFF',
  },
  shiftTime: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  shiftTimeSelected: {
    color: '#FFFFFF',
  },
  shiftPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  shiftPriceSelected: {
    color: '#FFFFFF',
  },
  totalCard: {
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  totalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalRowFinal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  totalValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalValueFinal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  submitButton: {
    marginTop: 16,
  },
});