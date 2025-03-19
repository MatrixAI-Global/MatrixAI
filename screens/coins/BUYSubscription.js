import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { useAuth } from '../../hooks/useAuth';
import supabase from '../../supabaseClient';

const BUYSubscription = ({ navigation, route }) => {
  const { uid, plan, price } = route.params;
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [suggestedCoupons, setSuggestedCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [finalPrice, setFinalPrice] = useState(price);
  const [originalPrice, setOriginalPrice] = useState(price);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    // Set end date based on plan
    const start = new Date();
    setStartDate(start);
    
    const end = new Date(start);
    if (plan === 'Tester') {
      end.setDate(end.getDate() + 15); // 15 days
    } else if (plan === 'Monthly') {
      end.setMonth(end.getMonth() + 1); // 1 month
    } else if (plan === 'Yearly') {
      end.setFullYear(end.getFullYear() + 1); // 1 year
    }
    setEndDate(end);

    // Remove HKD from price string to get number
    const numericPrice = price.replace('HKD', '');
    setOriginalPrice(numericPrice);
    setFinalPrice(numericPrice);

    // Fetch suggested coupons
    fetchCoupons();
  }, []);

  const getPlanDetails = () => {
    if (plan === 'Tester') {
      return {
        title: 'Tester Plan',
        coins: '450 coins',
        duration: '15 Days',
        expiry: 'Coins will expire after 15 days',
        price: price
      };
    } else if (plan === 'Monthly') {
      return {
        title: 'Monthly Plan',
        coins: '1380 coins',
        duration: '1 Month',
        expiry: 'Coins will expire after 1 month',
        price: price
      };
    } else if (plan === 'Yearly') {
      return {
        title: 'Yearly Plan',
        coins: '1380 coins/month',
        duration: '12 Months',
        expiry: 'You will receive 1380 coins each month. These coins will expire at the end of each month.',
        price: price
      };
    }
  };

  const planDetails = getPlanDetails();

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://matrix-server.vercel.app/getCoupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: uid }),
      });

      const result = await response.json();
      if (result.success) {
        setSuggestedCoupons(result.data);
      } else {
        Alert.alert('Error', 'Failed to fetch coupons');
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = (coupon = null) => {
    const codeToApply = coupon ? coupon.coupon_name : couponCode;
    
    // Find the coupon in the suggested coupons
    const selectedCoupon = coupon || suggestedCoupons.find(c => c.coupon_name === codeToApply);
    
    if (!selectedCoupon) {
      Alert.alert('Invalid Coupon', 'Please enter a valid coupon code');
      return;
    }

    // Check if coupon is already applied
    if (appliedCoupon && appliedCoupon.coupon_name === selectedCoupon.coupon_name) {
      Alert.alert('Already Applied', 'This coupon is already applied');
      return;
    }

    // Apply discount
    const discountAmount = selectedCoupon.coupon_amount;
    setDiscount(discountAmount);
    
    // Calculate final price
    const discountedPrice = originalPrice * (1 - discountAmount / 100);
    setFinalPrice(discountedPrice.toFixed(0));
    
    // Set applied coupon
    setAppliedCoupon(selectedCoupon);
    
    // If coupon was manually entered, clear the input
    if (!coupon) setCouponCode('');
  };

  const removeCoupon = () => {
    setDiscount(0);
    setFinalPrice(originalPrice);
    setAppliedCoupon(null);
  };

  const handleConfirm = async () => {
    // Show confirmation alert
    Alert.alert(
      'Confirm Purchase',
      `You are about to purchase the ${planDetails.title} for ${finalPrice}HKD. Would you like to proceed?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              // Show loading indicator
              setProcessing(true);
              
              // Prepare request data
              const requestData = {
                uid: uid,
                plan: plan,
                totalPrice: parseInt(finalPrice),
                couponId: appliedCoupon ? appliedCoupon.id : ""
              };
              
              // Make API call
              const response = await fetch('https://matrix-server.vercel.app/BuySubscription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData),
              });
              
              const result = await response.json();
              
              // Handle API response
              if (result.success) {
                // Navigate to success screen
                navigation.replace('SuccessScreen', {
                  message: `Successfully purchased ${planDetails.title}!`,
                  planDetails: planDetails,
                  finalPrice: `${finalPrice}HKD`,
                  discount: discount > 0 ? `${discount}%` : null,
                  startDate: startDate.toLocaleDateString(),
                  endDate: endDate.toLocaleDateString(),
                });
              } else {
                // Show error message
                Alert.alert('Error', result.message || 'Failed to process payment');
              }
            } catch (error) {
              console.error('Payment error:', error);
              Alert.alert('Error', 'Something went wrong while processing your payment');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const renderSuggestedCoupon = ({ item }) => (
    <View style={styles.couponItem}>
      <View style={styles.couponInfo}>
        <Text style={styles.couponName}>{item.coupon_name}</Text>
        <Text style={styles.couponDescription}>{item.description}</Text>
      </View>
      <TouchableOpacity 
        style={[
          styles.applyButton, 
          appliedCoupon && appliedCoupon.coupon_name === item.coupon_name ? styles.appliedButton : {}
        ]}
        onPress={() => appliedCoupon && appliedCoupon.coupon_name === item.coupon_name ? removeCoupon() : applyCoupon(item)}
      >
        <Text style={styles.applyButtonText}>
          {appliedCoupon && appliedCoupon.coupon_name === item.coupon_name ? 'Applied' : 'Apply'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  return (
    <LinearGradient
      colors={['#2274F0', '#FF6600']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      locations={[0, 1]}
      style={styles.container}
    >
      <View style={styles.container2}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <View style={styles.backButtonCircle}>
          <Icon name="arrow-back" size={20} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Header */}
      <Text style={styles.title}>Complete Purchase</Text>

      {/* Plan Details Card */}
      <View style={styles.planCard}>
        <Text style={styles.planCardTitle}>{planDetails.title}</Text>
        
        <View style={styles.planDetailsRow}>
          <View style={styles.planDetailItem}>
            <Image source={require('../../assets/coin.png')} style={styles.coinIcon} />
            <Text style={styles.planDetailText}>{planDetails.coins}</Text>
          </View>
          
          <View style={styles.planDetailItem}>
            <Icon name="calendar-outline" size={20} color="#2274F0" />
            <Text style={styles.planDetailText}>{planDetails.duration}</Text>
          </View>
          
          <View style={styles.planDetailItem}>
            <Icon name="pricetag-outline" size={20} color="#FF6600" />
            <Text style={styles.planDetailText}>{planDetails.price}</Text>
          </View>
        </View>
        
        <View style={styles.dateContainer}>
          <Text style={styles.dateLabel}>Start Date:</Text>
          <Text style={styles.dateValue}>{formatDate(startDate)}</Text>
          
          <Text style={styles.dateLabel}>End Date:</Text>
          <Text style={styles.dateValue}>{formatDate(endDate)}</Text>
        </View>

        <Text style={styles.planExpiryNote}>{planDetails.expiry}</Text>
      </View>

      {/* Coupon Section */}
      <View style={styles.couponSection}>
        <Text style={styles.sectionTitle}>Apply Coupon</Text>
        
        <View style={styles.couponInputContainer}>
          <TextInput
            style={styles.couponInput}
            placeholder="Enter coupon code"
            placeholderTextColor="#999"
            value={couponCode}
            onChangeText={setCouponCode}
          />
          <TouchableOpacity 
            style={styles.applyCouponButton} 
            onPress={() => applyCoupon()}
            disabled={!couponCode}
          >
            <Text style={styles.applyCouponButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.suggestedCouponsTitle}>Suggested Coupons</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : suggestedCoupons.length > 0 ? (
          <FlatList
            data={suggestedCoupons}
            renderItem={renderSuggestedCoupon}
            keyExtractor={item => item.id}
            style={styles.couponsList}
          />
        ) : (
          <Text style={styles.noCouponsText}>No coupons available</Text>
        )}
      </View>

      {/* Price Summary */}
      <View style={styles.priceSummary}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Original Price:</Text>
          <Text style={styles.priceValue}>{originalPrice}HKD</Text>
        </View>
        
        {discount > 0 && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Discount ({discount}%):</Text>
            <Text style={styles.discountValue}>-{(originalPrice - finalPrice).toFixed(0)}HKD</Text>
          </View>
        )}
        
        <View style={styles.priceRow}>
          <Text style={styles.finalPriceLabel}>Final Price:</Text>
          <Text style={styles.finalPriceValue}>{finalPrice}HKD</Text>
        </View>
      </View>

      {/* Confirm Button */}
      <TouchableOpacity 
        style={[styles.confirmButton, processing && styles.disabledButton]} 
        onPress={handleConfirm}
        disabled={processing}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>Confirm Purchase</Text>
        )}
      </TouchableOpacity>
      </View>

      {/* Processing overlay */}
      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>Processing your purchase...</Text>
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  container2: {
    flex: 1,
    padding:20,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  backButtonCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  planCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2274F0',
    textAlign: 'center',
    marginBottom: 10,
  },
  planDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  planDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  planDetailText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    width: '30%',
  },
  dateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    width: '20%',
  },
  planExpiryNote: {
    fontSize: 12,
    color: '#FF6600',
    fontStyle: 'italic',
    marginTop: 5,
  },
  couponSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  couponInputContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 15,
    height: 45,
    color: '#333',
  },
  applyCouponButton: {
    backgroundColor: '#2274F0',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  applyCouponButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  suggestedCouponsTitle: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  couponsList: {
    maxHeight: 150,
  },
  couponItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponInfo: {
    flex: 1,
  },
  couponName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2274F0',
  },
  couponDescription: {
    fontSize: 12,
    color: '#666',
  },
  applyButton: {
    backgroundColor: '#FF6600',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  appliedButton: {
    backgroundColor: '#28a745',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  noCouponsText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 10,
  },
  priceSummary: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    color: '#333',
  },
  discountValue: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: 'bold',
  },
  finalPriceLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
  finalPriceValue: {
    fontSize: 16,
    color: '#FF6600',
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#FF8000',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
  },
});

export default BUYSubscription; 