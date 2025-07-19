import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Admission, User } from '@/types/database';
import { formatDate, calculateRemainingDays } from '@/utils/dateUtils';
import { ArrowLeft, Search, Calendar, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';

interface StudentWithAdmission extends User {
  admission?: Admission;
}

export default function AdminStudentsScreen() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithAdmission[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

  // Redirect if not admin
  if (user?.role !== 'admin') {
    router.replace('/admin');
    return null;
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchQuery, filter]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          admission:admissions(*)
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process the data to get the latest admission for each student
      const processedStudents = data.map(student => ({
        ...student,
        admission: Array.isArray(student.admission) 
          ? student.admission.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : student.admission
      }));

      setStudents(processedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(student =>
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.mobile_number.includes(searchQuery)
      );
    }

    // Apply status filter
    switch (filter) {
      case 'active':
        filtered = filtered.filter(student => 
          student.admission?.payment_status === 'paid' && 
          student.admission?.end_date && 
          new Date(student.admission.end_date) > new Date()
        );
        break;
      case 'expiring':
        filtered = filtered.filter(student => {
          if (!student.admission?.end_date || student.admission.payment_status !== 'paid') return false;
          const remainingDays = calculateRemainingDays(student.admission.end_date);
          return remainingDays <= 7 && remainingDays > 0;
        });
        break;
      case 'expired':
        filtered = filtered.filter(student => 
          student.admission?.end_date && 
          new Date(student.admission.end_date) <= new Date()
        );
        break;
    }

    setFilteredStudents(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStudents();
    setRefreshing(false);
  };

  const extendSubscription = async (studentId: string, admissionId: string, months: number) => {
    try {
      // Get current admission
      const { data: admission, error: fetchError } = await supabase
        .from('admissions')
        .select('end_date')
        .eq('id', admissionId)
        .single();

      if (fetchError) throw fetchError;

      // Calculate new end date
      const currentEndDate = new Date(admission.end_date || new Date());
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + months);

      // Update admission
      const { error: updateError } = await supabase
        .from('admissions')
        .update({ end_date: newEndDate.toISOString() })
        .eq('id', admissionId);

      if (updateError) throw updateError;

      // Log admin action
      await supabase
        .from('admin_logs')
        .insert({
          admin_id: user?.id,
          action: 'extend_subscription',
          target_user_id: studentId,
          details: { months, new_end_date: newEndDate.toISOString() }
        });

      Alert.alert('Success', `Subscription extended by ${months} month${months > 1 ? 's' : ''}`);
      await fetchStudents();
    } catch (error) {
      console.error('Error extending subscription:', error);
      Alert.alert('Error', 'Failed to extend subscription');
    }
  };

  const confirmExtension = (student: StudentWithAdmission, months: number) => {
    Alert.alert(
      'Extend Subscription',
      `Extend ${student.full_name}'s subscription by ${months} month${months > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Extend',
          onPress: () => extendSubscription(student.id, student.admission!.id, months)
        }
      ]
    );
  };

  const getStatusColor = (student: StudentWithAdmission): string => {
    if (!student.admission || student.admission.payment_status !== 'paid') return '#64748B';
    if (!student.admission.end_date) return '#64748B';
    
    const remainingDays = calculateRemainingDays(student.admission.end_date);
    if (remainingDays <= 0) return '#EF4444';
    if (remainingDays <= 7) return '#F59E0B';
    return '#10B981';
  };

  const getStatusText = (student: StudentWithAdmission): string => {
    if (!student.admission) return 'No Admission';
    if (student.admission.payment_status !== 'paid') return 'Payment Pending';
    if (!student.admission.end_date) return 'No End Date';
    
    const remainingDays = calculateRemainingDays(student.admission.end_date);
    if (remainingDays <= 0) return 'Expired';
    if (remainingDays <= 7) return `Expires in ${remainingDays} days`;
    return `${remainingDays} days remaining`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

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
        <Text style={styles.title}>Student Management</Text>
        <Text style={styles.subtitle}>Manage student profiles and subscriptions</Text>
      </View>

      {/* Search and Filters */}
      <Card style={styles.filtersCard}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#64748B" />
          <Input
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search students..."
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterButtons}>
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'expiring', label: 'Expiring' },
            { key: 'expired', label: 'Expired' }
          ].map((filterOption) => (
            <TouchableOpacity
              key={filterOption.key}
              style={[
                styles.filterButton,
                filter === filterOption.key && styles.filterButtonActive
              ]}
              onPress={() => setFilter(filterOption.key as any)}
            >
              <Text style={[
                styles.filterButtonText,
                filter === filterOption.key && styles.filterButtonTextActive
              ]}>
                {filterOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Students List */}
      <Card style={styles.studentsCard}>
        <Text style={styles.sectionTitle}>
          Students ({filteredStudents.length})
        </Text>

        {filteredStudents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        ) : (
          <View style={styles.studentsList}>
            {filteredStudents.map((student) => (
              <View key={student.id} style={styles.studentItem}>
                <View style={styles.studentHeader}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.full_name}</Text>
                    <Text style={styles.studentEmail}>{student.email}</Text>
                    <Text style={styles.studentMobile}>{student.mobile_number}</Text>
                  </View>
                  <View style={styles.statusContainer}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(student) }
                    ]}>
                      <Text style={styles.statusText}>
                        {getStatusText(student)}
                      </Text>
                    </View>
                  </View>
                </View>

                {student.admission && (
                  <View style={styles.admissionDetails}>
                    <Text style={styles.detailText}>
                      Course: {student.admission.course_name}
                    </Text>
                    <Text style={styles.detailText}>
                      Shifts: {student.admission.selected_shifts.join(', ')}
                    </Text>
                    <Text style={styles.detailText}>
                      Duration: {student.admission.duration} months
                    </Text>
                    {student.admission.start_date && (
                      <Text style={styles.detailText}>
                        Started: {formatDate(student.admission.start_date)}
                      </Text>
                    )}
                    {student.admission.end_date && (
                      <Text style={styles.detailText}>
                        Ends: {formatDate(student.admission.end_date)}
                      </Text>
                    )}
                  </View>
                )}

                {student.admission?.payment_status === 'paid' && (
                  <View style={styles.actionButtons}>
                    <Button
                      title="Extend 1M"
                      onPress={() => confirmExtension(student, 1)}
                      size="small"
                      variant="outline"
                      style={styles.extendButton}
                    />
                    <Button
                      title="Extend 3M"
                      onPress={() => confirmExtension(student, 3)}
                      size="small"
                      variant="outline"
                      style={styles.extendButton}
                    />
                    <Button
                      title="Extend 6M"
                      onPress={() => confirmExtension(student, 6)}
                      size="small"
                      variant="outline"
                      style={styles.extendButton}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
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
  filtersCard: {
    margin: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  studentsCard: {
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
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  studentsList: {
    gap: 16,
  },
  studentItem: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  studentMobile: {
    fontSize: 14,
    color: '#64748B',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  admissionDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  extendButton: {
    flex: 1,
  },
});