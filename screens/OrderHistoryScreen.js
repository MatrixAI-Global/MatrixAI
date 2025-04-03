import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import moment from 'moment';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'react-native-linear-gradient';
import { useAuthUser } from '../hooks/useAuthUser';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
const OrderHistoryScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { uid } = useAuthUser();
  console.log(uid);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const fetchOrders = async () => {
    try {
      const response = await fetch('https://matrix-server.vercel.app/getUserOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
console.log(orders);
  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, []);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '#4CAF50';
      case 'expired':
        return '#F44336';
      default:
        return '#FFA000';
    }
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}] }>
      <View style={[styles.header, {backgroundColor: colors.background , borderBottomWidth: 0.8, borderColor: colors.border}]  }>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Order History</Text>
      </View>

      {loading ? (
        <View style={[styles.loadingContainer, {backgroundColor: colors.background}]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={[styles.scrollView, {backgroundColor: colors.background}]  }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {orders.map((order, index) => (
          <View key={order.id} style={[styles.orderCard, {backgroundColor: colors.background2 , borderColor: colors.border}]}>
              <View style={[styles.cardHeader, {backgroundColor: colors.background2}]}>
                <View style={[styles.planInfo, {backgroundColor: colors.background2}]}>
                  <Text style={[styles.planName, {color: colors.text}]}>{order.plan_name} Plan</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={[styles.statusText, {color: colors.text}]}>{order.status}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.helpButton, {backgroundColor: colors.background2}]}
                  onPress={() => navigation.navigate('HelpScreen', { orderId: order.id })}
                >
                  <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.orderDetails, {backgroundColor: colors.background2}]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>Order ID:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]}>#{order.id}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>Amount Paid:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]}>${order.total_price} HKD</Text>
                </View>
               
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>Valid Till:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}]}>
                    {moment(order.plan_valid_till).format('MMM DD, YYYY')}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, {color: colors.text}]}>Purchase Date:</Text>
                  <Text style={[styles.detailValue, {color: colors.text}] }>
                    {moment(order.created_at).format('MMM DD, YYYY')}
                  </Text>
                </View>
              </View>
             </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  helpButton: {
    padding: 8,
  },
  orderDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#666',
    fontSize: 14,
  },
  detailValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default OrderHistoryScreen; 