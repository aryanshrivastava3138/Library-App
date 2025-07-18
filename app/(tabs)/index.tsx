import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Admission, SeatBooking } from '@/types/database';
import { SHIFTS } from '@/types/shifts';
import { calculateRemainingDays, formatDate } from '@/utils/dateUtils';
import { 
  Clock, 
  TriangleAlert as AlertTriangle, 
  CircleCheck as CheckCircle, 
  Users, 
  Calendar,
  MapPin,
  CreditCard,
  ArrowRight,
  TrendingUp,
  Armchair
} from 'lucide-react-native';

interface ShiftAvailability {
  shift: string;
  shiftName: string;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  price: number;
}

interface PricingOption {
  shifts: string[];
  shiftNames: string[];
  price: number;
  popular?: boolean;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [shiftAvailability, setShiftAvailability] = useState<ShiftAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [remainingDays, setRemainingDays] = useState(0);

  const today = new Date().toISOString().split('T')[0];
  const totalSeats = 50;

  const pricingOptions: PricingOption[] = [
    { shifts: ['morning'], shiftNames: ['Morning'], price: 299 },
    { shifts: ['noon'], shiftNames: ['Noon'], price: 349, popular: true },
    { shifts: ['evening'], shiftNames: ['Evening'], price: 299 },
    { shifts: ['night'], shiftNames: ['Night'], price: 299 },
    { shifts: ['morning', 'noon'], shiftNames: ['Morning', 'Noon'], price: 549 },
    { shifts: ['noon', 'evening'], shiftNames: ['Noon', 'Evening'], price: 549 },
    { shifts: ['morning', 'noon', 'evening'], shiftNames: ['Morning', 'Noon', 'Evening'], price: 749 },
    { shifts: ['morning', 'noon', 'evening', 'night'], shiftNames: ['All Shifts'], price: 999 },
  ];

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch admission data
      const { data: admissionData } = await supabase
        .from('admissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (admissionData && admissionData.length > 0) {
        setAdmission(admissionData[0]);
        if (admissionData[0].end_date) {
          setRemainingDays(calculateRemainingDays(admissionData[0].end_date));
        }
      }

      // Fetch seat bookings for today
      const { data: bookingsData } = await supabase
        .from('seat_bookings')
        .select('shift')
        .eq('booking_date', today)
        .eq('booking_status', 'booked');

      // Calculate availability for each shift
      const availability: ShiftAvailability[] = SHIFTS.map(shift => {
        const bookedCount = bookingsData?.filter(booking => booking.shift === shift.id).length || 0;
        return {
          shift: shift.id,
          shiftName: shift.name,
          totalSeats,
          bookedSeats: bookedCount,
          availableSeats: totalSeats - bookedCount,
          price: shift.price
        };
      });

      setShiftAvailability(availability);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getAvailabilityColor = (availableSeats: number): string => {
    const percentage = (availableSeats / totalSeats) * 100;
    if (percentage > 50) return '#10B981'; // Green
    if (percentage > 20) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  };

  const getAvailabilityStatus = (availableSeats: number): string => {
    const percentage = (availableSeats / totalSeats) * 100;
    if (percentage > 50) return 'Good Availability';
    if (percentage > 20) return 'Limited Seats';
    return 'Almost Full';
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const hasAdmission = admission && admission.payment_status === 'paid';

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.subtitle}>Life Changer Library</Text>
      </View>

      {!hasAdmission ? (
        <>
          {/* Hero Section */}
          <Card style={styles.heroCard}>
            <View style={styles.heroContent}>
              <CheckCircle size={48} color="#10B981" style={styles.heroIcon} />
              <Text style={styles.heroTitle}>Start Your Learning Journey</Text>
              <Text style={styles.heroDescription}>
                Join thousands of students who have transformed their academic success with our premium library facilities
              </Text>
              <Button
                title="Complete Admission Process"
                onPress={() => router.push('/admission')}
                style={styles.heroButton}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.heroButtonText}>Complete Admission Process</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </View>
              </Button>
            </View>
          </Card>

          {/* Live Seat Availability */}
          <Card style={styles.availabilityCard}>
            <View style={styles.sectionHeader}>
              <Armchair size={24} color="#2563EB" />
              <Text style={styles.sectionTitle}>Live Seat Availability</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.sectionSubtitle}>Real-time seat status for today</Text>

            <View style={styles.shiftsGrid}>
              {shiftAvailability.map((shift) => (
                <View key={shift.shift} style={styles.shiftAvailabilityCard}>
                  <View style={styles.shiftHeader}>
                    <Text style={styles.shiftName}>{shift.shiftName}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getAvailabilityColor(shift.availableSeats) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getAvailabilityStatus(shift.availableSeats)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.seatStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{shift.availableSeats}</Text>
                      <Text style={styles.statLabel}>Available</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statNumber, { color: '#EF4444' }]}>{shift.bookedSeats}</Text>
                      <Text style={styles.statLabel}>Booked</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{shift.totalSeats}</Text>
                      <Text style={styles.statLabel}>Total</Text>
                    </View>
                  </View>

                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { 
                            width: `${(shift.bookedSeats / shift.totalSeats) * 100}%`,
                            backgroundColor: getAvailabilityColor(shift.availableSeats)
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round((shift.bookedSeats / shift.totalSeats) * 100)}% occupied
                    </Text>
                  </View>

                  <View style={styles.shiftTimePrice}>
                    <Text style={styles.shiftTime}>
                      {SHIFTS.find(s => s.id === shift.shift)?.timeRange}
                    </Text>
                    <Text style={styles.shiftPrice}>₹{shift.price}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {/* Pricing Information */}
          <Card style={styles.pricingCard}>
            <View style={styles.sectionHeader}>
              <CreditCard size={24} color="#2563EB" />
              <Text style={styles.sectionTitle}>Shift Pricing</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Choose the perfect plan for your study schedule</Text>

            <View style={styles.pricingGrid}>
              {pricingOptions.map((option, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.pricingOption,
                    option.popular && styles.popularOption
                  ]}
                >
                  {option.popular && (
                    <View style={styles.popularBadge}>
                      <TrendingUp size={12} color="#FFFFFF" />
                      <Text style={styles.popularText}>POPULAR</Text>
                    </View>
                  )}
                  
                  <View style={styles.pricingHeader}>
                    <Text style={styles.pricingShifts}>
                      {option.shiftNames.join(' + ')}
                    </Text>
                    <Text style={styles.pricingPrice}>₹{option.price}</Text>
                  </View>
                  
                  <View style={styles.pricingDetails}>
                    <Text style={styles.pricingPerMonth}>per month</Text>
                    {option.shifts.length > 1 && (
                      <Text style={styles.pricingSavings}>
                        Save ₹{(option.shifts.length * 299) - option.price}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.registrationFee}>
              <View style={styles.feeItem}>
                <Text style={styles.feeLabel}>One-time Registration Fee</Text>
                <Text style={styles.feeAmount}>₹50</Text>
              </View>
              <Text style={styles.feeNote}>
                * Registration fee is added to your first payment
              </Text>
            </View>
          </Card>

          {/* Call to Action */}
          <Card style={styles.ctaCard}>
            <View style={styles.ctaContent}>
              <Text style={styles.ctaTitle}>Ready to Begin?</Text>
              <Text style={styles.ctaDescription}>
                Complete your admission form and secure your preferred seats today
              </Text>
              <Button
                title="Continue to Booking"
                onPress={() => router.push('/admission')}
                style={styles.ctaButton}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.ctaButtonText}>Continue to Booking</Text>
                  <ArrowRight size={20} color="#FFFFFF" />
                </View>
              </Button>
            </View>
          </Card>
        </>
      ) : (
        <>
          {/* Subscription Status for Admitted Students */}
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Clock size={24} color={remainingDays <= 5 ? '#F59E0B' : '#10B981'} />
              <Text style={styles.statusTitle}>Subscription Status</Text>
            </View>
            <Text style={[
              styles.remainingDays,
              { color: remainingDays <= 5 ? '#F59E0B' : '#10B981' }
            ]}>
              {remainingDays} days remaining
            </Text>
            {remainingDays <= 5 && (
              <View style={styles.warningCard}>
                <AlertTriangle size={20} color="#F59E0B" />
                <Text style={styles.warningText}>
                  Your subscription expires soon. Please renew to continue.
                </Text>
              </View>
            )}
            {admission.end_date && (
              <Text style={styles.expiryDate}>
                Expires on: {formatDate(admission.end_date)}
              </Text>
            )}
          </Card>

          {/* Quick Actions for Admitted Students */}
          <Card style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tabs)/booking')}
              >
                <Calendar size={32} color="#2563EB" />
                <Text style={styles.actionTitle}>Book Seat</Text>
                <Text style={styles.actionDescription}>Reserve your study spot</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tabs)/attendance')}
              >
                <Users size={32} color="#10B981" />
                <Text style={styles.actionTitle}>Attendance</Text>
                <Text style={styles.actionDescription}>Check in/out</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Current Shift Information */}
          <Card style={styles.shiftCard}>
            <Text style={styles.sectionTitle}>Your Shifts</Text>
            <View style={styles.shiftsContainer}>
              {admission.selected_shifts.map((shift) => (
                <View key={shift} style={styles.shiftTag}>
                  <Text style={styles.shiftText}>{shift}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
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
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  greeting: {
    fontSize: 16,
    color: '#64748B',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#2563EB',
    marginTop: 4,
    fontWeight: '500',
  },
  heroCard: {
    margin: 16,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 16,
  },
  heroContent: {
    alignItems: 'center',
    padding: 8,
  },
  heroIcon: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  heroButton: {
    width: '100%',
    paddingVertical: 16,
  },
  heroButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  availabilityCard: {
    margin: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginLeft: 8,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  shiftsGrid: {
    gap: 16,
  },
  shiftAvailabilityCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shiftName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  seatStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  shiftTimePrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftTime: {
    fontSize: 12,
    color: '#64748B',
  },
  shiftPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  pricingCard: {
    margin: 16,
  },
  pricingGrid: {
    gap: 12,
  },
  pricingOption: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  popularOption: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pricingShifts: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  pricingPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  pricingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricingPerMonth: {
    fontSize: 12,
    color: '#64748B',
  },
  pricingSavings: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  registrationFee: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  feeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  feeLabel: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  feeAmount: {
    fontSize: 16,
    color: '#92400E',
    fontWeight: 'bold',
  },
  feeNote: {
    fontSize: 12,
    color: '#92400E',
    fontStyle: 'italic',
  },
  ctaCard: {
    margin: 16,
    marginBottom: 32,
    backgroundColor: '#1E293B',
  },
  ctaContent: {
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  ctaDescription: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
  },
  ctaButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Styles for admitted students
  statusCard: {
    margin: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginLeft: 8,
  },
  remainingDays: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  expiryDate: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  actionsCard: {
    margin: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  shiftCard: {
    margin: 16,
  },
  shiftsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shiftTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shiftText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});