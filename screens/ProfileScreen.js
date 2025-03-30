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
import { useTheme } from '../context/ThemeContext';
import { ThemedView, ThemedText, ThemedCard } from '../components/ThemedView';
import { clearThemePreference } from '../utils/themeUtils';
import { clearProStatus, getProStatus } from '../utils/proStatusUtils';

const ProfileScreen = ({ navigation }) => {
    const { uid, loading } = useAuth();
    const coinCount = useCoinsSubscription(uid);
    const [isSeller, setIsSeller] = useState(false);
    const [isVerified, setIsVerified] = useState(false);
    const { isPro, checkProStatus } = useProStatus();
    const [localIsPro, setLocalIsPro] = useState(false);
    const { t } = useLanguage();
    const { getThemeColors } = useTheme();
    const colors = getThemeColors();
    
    // Check if user is pro when component mounts
    useEffect(() => {
        const checkProStatusFromStorage = async () => {
            try {
                // Get pro status from AsyncStorage
                const storedProStatus = await getProStatus();
                
                // Update local state with stored value
                setLocalIsPro(storedProStatus);
                
                // If the user is pro according to storage but not in context, update context
                if (storedProStatus && !isPro && uid) {
                    checkProStatus(uid);
                }
                
                console.log('ProfileScreen - Pro Status from storage:', storedProStatus);
                console.log('ProfileScreen - Pro Status from context:', isPro);
            } catch (error) {
                console.error('Error checking pro status from storage:', error);
            }
        };
        
        checkProStatusFromStorage();
    }, [isPro, uid]);
    
    // Check user status when uid changes
    useEffect(() => {
        if (uid) {
            checkUserStatus();
        }
    }, [uid]);

    const checkUserStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('seller, verified, subscription_active')
                .eq('uid', uid)
                .single();

            if (error) throw error;

            if (data) {
                setIsSeller(data.seller);
                setIsVerified(data.verified);
                
                // If the database shows the user is pro, update local state and context
                if (data.subscription_active && (!isPro || !localIsPro)) {
                    setLocalIsPro(true);
                    // Ensure the pro status context is updated
                    if (checkProStatus) {
                        checkProStatus(uid);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking user status:', error.message);
        }
    };

    // Determine if user should be treated as pro based on both context and local state
    const isUserPro = isPro || localIsPro;

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
                        
                        // Clear theme preference
                        await clearThemePreference();
                        
                        // Clear pro status
                        await clearProStatus();
                        
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
        <TouchableOpacity 
            style={[styles.menuItem, {backgroundColor: colors.background2, borderBottomColor: colors.border}]} 
            onPress={onPress}
        >
            <View style={[styles.iconContainer, {backgroundColor: colors.primary + '20'}]}>
                <Ionicons name={iconName} size={20} color={colors.primary} />
            </View>
            <ThemedText style={[styles.menuLabel, {color: colors.text}]}>{label}</ThemedText>
            <Ionicons name="chevron-forward" size={20} color={colors.text + '80'} />
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
        <SafeAreaView style={[styles.container2, {backgroundColor: colors.background}]}>
            <View style={[styles.header, {backgroundColor: colors.background2, borderBottomColor: colors.border}]}>
                <TouchableOpacity style={[styles.backButton, {borderColor: colors.text}]} onPress={() => navigation.goBack()}>
                    <Image source={require('../assets/back.png')} style={[styles.headerIcon, {tintColor: colors.text}]} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, {color: colors.text}]}>{t('profile')}</ThemedText>
            </View>
            
            <ScrollView 
                style={[styles.container, {backgroundColor: colors.background}]} 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false} 
                bounces={false}
            >
                <Header2 uid={uid} />
                
                {/* Conditional rendering based on Pro status */}
                {!isUserPro ? (
                    <FeatureCardWithDetails2 />
                ) : (
                    <>
                        <FeatureCardWithDetailsPro />
                        {(coinCount < 200) && <FeatureCardWithDetailsAddon />}
                    </>
                )}

                <ThemedText style={[styles.menuTitle, {color: colors.text}]}>Your Information</ThemedText>
                
                {/* Menu Items */}
                <ThemedCard style={[styles.menuContainer, {backgroundColor: colors.background2}]}>
                    <MenuItem 
                        iconName="person-outline" 
                        label="Profile" 
                        onPress={handleEditProfile} 
                    />
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
                </ThemedCard>

                <ThemedText style={[styles.menuTitle, {color: colors.text}]}>Support</ThemedText>
                
                <ThemedCard style={[styles.menuContainer, {backgroundColor: colors.background2}]}>
                    <MenuItem 
                        iconName="help-circle-outline" 
                        label="Help Center" 
                        onPress={() => navigation.navigate('FeedbackScreen')} 
                    />
                    <MenuItem 
                        iconName="headset-outline" 
                        label="Customer Support" 
                        onPress={() => navigation.navigate('CustomerSupportScreen')} 
                    />
                    <MenuItem 
                        iconName="star-outline" 
                        label="Rate Us" 
                        onPress={() => navigation.navigate('FeedbackScreen')} 
                    />
                </ThemedCard>

                <ThemedText style={[styles.menuTitle, {color: colors.text}]}>Preferences</ThemedText>
                
                <ThemedCard style={[styles.menuContainer, {backgroundColor: colors.background2}]}>
                    <MenuItem 
                        iconName="settings-outline" 
                        label="Settings" 
                        onPress={handleSettings} 
                    />
                    <MenuItem 
                        iconName="log-out-outline" 
                        label="Logout" 
                        onPress={handleLogout} 
                    />
                </ThemedCard>
                
                <View style={styles.footer}>
                    <ThemedText style={[styles.versionText, {color: colors.text}]}>Version 1.0.0</ThemedText>
                </View>
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
    footer:{
        marginTop:20,
        marginBottom:20,
        alignItems:'center',
        justifyContent:'center',
    },
    versionText:{
        fontSize:12,
        color:'#333',
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
