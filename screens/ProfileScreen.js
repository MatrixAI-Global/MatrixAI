import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,  Animated, Easing, Image } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Header from '../components/Header';
import Header2 from '../components/Header copy';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { useAuth } from '../hooks/useAuth';
import RNRestart from 'react-native-restart';
import { supabase } from '../supabaseClient';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeatureCardWithDetails2 from '../components/FeatureCardWithDetails copy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProStatus } from '../hooks/useProStatus';
import FeatureCardWithDetailsPro from '../components/FeatureCardWithDetailsPro';
import FeatureCardWithDetailsAddon from '../components/FeatureCardWithDetailsAddon';
import { useLanguage } from '../context/LanguageContext';
import { clearLanguagePreference } from '../utils/languageUtils';

const ProfileScreen = ({ navigation }) => {
    const { uid, loading } = useAuth();
    const coinCount = useCoinsSubscription(uid);
    const [isSeller, setIsSeller] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const { isPro } = useProStatus();
    const { t } = useLanguage();
    useEffect(() => {
        if (uid) {
            checkUserStatus();
        }
    }, [uid]);

    const checkUserStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('seller, verified')
                .eq('uid', uid)
                .single();

            if (error) throw error;

            if (data) {
                setIsSeller(data.seller);
                setIsVerified(data.verified);
            }
        } catch (error) {
            console.error('Error checking user status:', error.message);
        }
    };

    const handleUpgradePress = () => {
        navigation.navigate('TimeScreen'); 
    };

    const handleLogout = () => {
        Alert.alert(t('logout'), t('logoutConfirmation'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('logout'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        // Clear language preference
                        await clearLanguagePreference();
                        
                        // Remove user login status from AsyncStorage
                        await AsyncStorage.multiRemove([
                            'userLoggedIn',
                            'uid',
                            'referralCode',
                            'supabase-session',
                            // Add any other keys you want to clear
                        ]);
                        
                        // Sign out from Supabase
                        await supabase.auth.signOut();
                        
                        // Restart the app
                        RNRestart.Restart();
                        
                        console.log('User logged out successfully');
                    } catch (error) {
                        console.error('Error logging out:', error);
                        Alert.alert(
                            t('logoutError'),
                            t('logoutErrorMessage')
                        );
                    }
                },
            },
        ]);
    };

    const MenuItem = ({ iconName, label, onPress }) => (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={styles.iconContainer}>
                <Ionicons name={iconName} size={20} color="#000" />
            </View>
            <Text style={styles.menuLabel}>{label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
        </TouchableOpacity>
    );

    // Add navigation handlers
    const handleEditProfile = () => {
        navigation.navigate('EditProfile');
    };

    const handleBookmark = () => {
        navigation.navigate('WishlistScreen');
    };

    const handleVoiceNote = () => {
        navigation.navigate('VoiceNote');
    };

    const handleInside = () => {
        navigation.navigate('ReferralScreen');
    };

    const handleAIShop = () => {
        if (!isSeller) {
            navigation.navigate('FillInformationScreen');
        } else if (isSeller && !isVerified) {
            navigation.navigate('SuccessScreen');
        } else if (isSeller && isVerified) {
            navigation.navigate('ManageProductsScreen');
        }
    };

    const handleVoiceSettings = () => {
        navigation.navigate('VoiceSettings');
    };

    const handleTrash = () => {
        navigation.navigate('Trash');
    };

    const handleSettings = () => {
        navigation.navigate('SettingsScreen');
    };

    const storagePath = `users/${uid}/`;
  
    const fadeAnim = new Animated.Value(0);
    const scaleAnim = new Animated.Value(0);
    const sendRotation = new Animated.Value(0);
  
    React.useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.timing(sendRotation, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        )
      ]).start();
    }, []);
    return (
        <SafeAreaView style={styles.container2}>
            <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Image source={require('../assets/back.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
      </View>
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        
            <Header2 uid={uid} />
            
            {/* Header Section */}
             {/* Conditional rendering based on Pro status */}
             {!isPro ? (
                <FeatureCardWithDetails2 />
            ) : (
                <>
                    <FeatureCardWithDetailsPro />
                    {(coinCount < 200) && <FeatureCardWithDetailsAddon />}
                </>
            )}

            {/* <View style={styles.header}>
                <View style={styles.timeCreditsContainer}>
                    <View style={styles.timeIconContainer}>
                        <Ionicons name="time-outline" size={20} color="#fff" />
                    </View>
                    <View style={styles.timeIconContainer2}>
                        <Text style={styles.timeText}>Time Credits</Text>
                        <Text style={styles.timeValue}>14M 26S</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.buyTimeButton} onPress={handleUpgradePress}>
                    <Text style={styles.buyTimeText}>Buy time</Text>
                </TouchableOpacity>
            </View> */}
            <Text style={styles.menuTitle}>Your Information</Text>
            {/* Updated Menu Items with navigation */}
            <View style={styles.menuContainer}>
            <MenuItem 
                iconName="person-outline" 
                label="Profile" 
                onPress={handleEditProfile} 
            />
            {/* <MenuItem 
                iconName="bookmark-outline" 
                label="Wishlist" 
                onPress={handleBookmark} 
            /> */}
            <MenuItem 
                iconName="document-text-outline" 
                label="Order History" 
                onPress={() => navigation.navigate('OrderHistoryScreen')} 
            />
            <MenuItem 
                iconName="people-outline" 
                label="Refer & Earn" 
                onPress={handleInside} 
            />
            <MenuItem 
                iconName="cash-outline" 
                label="Rewards" 
                onPress={() => navigation.navigate('AddProductScreen')}
            />
            <MenuItem 
                iconName="card-outline" 
                label="Payment Management" 
                onPress={() => navigation.navigate('AddProductScreen')}
            />
            

            {/* {isSeller && isVerified && (
                <MenuItem 
                    iconName="add-circle-outline" 
                    label="Add Products" 
                    onPress={() => navigation.navigate('AddProductScreen')}
                />
            )}
            {isSeller && isVerified ? (
                <MenuItem 
                    iconName="cart-outline" 
                    label="Your AI Shop" 
                    onPress={handleAIShop} 
                />
            ) : (
                <MenuItem 
                    iconName="cart-outline" 
                    label="Open your AI Shop" 
                    onPress={handleAIShop} 
                />
            )} */}
                  </View>
            <Text style={styles.menuTitle}>Other Information</Text>
         <View style={styles.menuContainer}>   
         <MenuItem 
                iconName="chatbox-outline" 
                label="Customer Support & FAQ" 
                onPress={() => navigation.navigate('CustomerSupportScreen')}
            />
            <MenuItem 
                iconName="help-circle-outline" 
                label="Help" 
                onPress={() => navigation.navigate('CustomerSupportScreen')}
            />  

            <MenuItem 
                iconName="notifications-outline" 
                label="Notifications" 
                onPress={() => navigation.navigate('AddProductScreen')}
            />
             <MenuItem 
                iconName="cash-outline" 
                label="Charges" 
                onPress={() => navigation.navigate('AddProductScreen')}
            />
            </View>
        
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>{t('logout')}</Text>
                <Ionicons name="log-out-outline" size={20} marginLeft={10} color="#000" />
            </TouchableOpacity>
       <Text style={styles.logoutText2}>Version 1.0.0</Text>

      
        </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7F7F7FF',
        paddingHorizontal: 10,
        
    },
    menuContainer: {
        backgroundColor: '#ffff',
        padding: 10,
        borderRadius: 20,
        borderWidth: 1, // Gray border for the card
        borderColor: '#ccc',
      
        justifyContent: 'center', // Center content inside card
        alignItems: 'center',
    },
    container2: {
        flex: 1,

    
        
    },
    scrollContent: {
        paddingBottom: 10, // Adjust the value as needed
    },
    
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
      },
      backButton: {
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E0E0E0',
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
    timeCreditsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeIconContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 20,
        padding: 8,
        marginRight: 10,
    },
    timeIconContainer2: {
        flexDirection:'column',
        padding: 8,
        marginRight: 10,
    },
  
    timeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    timeValue: {
        color: '#fff',
        fontSize: 14,
        marginLeft: 8,
    },
    buyTimeButton: {
        backgroundColor: '#fff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 25,
    },
    buyTimeText: {
        color: '#007AFF',
        padding:10,
        fontWeight: 'bold',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    iconContainer: {
        marginRight: 15,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    header2: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
        width: '100%',
        padding: 10,
        backgroundColor: '#007AFF',
 
      },
      headerIcon3: {
     
        resizeMode: 'contain',
        backgroundColor: '#ffff',
        borderWidth: 1,
        borderColor: '#33333342',
        resizeMode: 'contain',
        borderRadius: 30,
        padding: 3,
        marginRight: 10,
      },
      headerTitle2: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
      },
      menuTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginVertical: 10,
        marginLeft: 10,
        },
   
      logoutButton: {
        backgroundColor: '#ffff',
     width: '100%',
     height: 50,
     flexDirection: 'row',
     marginTop: 20,
        borderRadius: 15,
        borderWidth: 1, // Gray border for the card
        borderColor: '#cccccc',
       
        justifyContent: 'center',
        alignItems: 'center',
      },
      logoutText: {
        color: '#000',
        fontWeight: '500',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 16,
        textAlign: 'center',
      },
      logoutText2: {
        color: '#000',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 15,
      },
});

export default ProfileScreen;
