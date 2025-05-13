import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { supabase } from '../supabaseClient';
import { saveProStatus, saveCoinsCount, getProStatus } from '../utils/proStatusUtils';
import { useProStatus } from '../hooks/useProStatus';
import { useTheme } from '../context/ThemeContext';
import { useProfileUpdate } from '../context/ProfileUpdateContext';

const Header = ({ navigation, uid, openDrawer }) => {
    console.log("Header rendering with UID:", uid);
    const coinCount = useCoinsSubscription(uid);
    const [userName, setUserName] = useState('');
    const [dpUrl, setDpUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isPro, checkProStatus } = useProStatus();
    const [localIsPro, setLocalIsPro] = useState(false);
    const { getThemeColors } = useTheme();
    const { lastUpdate } = useProfileUpdate();
    const colors = getThemeColors();
    
    // Initialize from stored value on mount
    useEffect(() => {
        const initializeFromStorage = async () => {
            try {
                const storedProStatus = await getProStatus();
                setLocalIsPro(storedProStatus);
                
                // If stored status says user is pro but context doesn't, update context
                if (storedProStatus && !isPro && uid) {
                    checkProStatus(uid);
                }
            } catch (error) {
                console.error('Error initializing pro status from storage:', error);
            }
        };
        
        initializeFromStorage();
    }, [isPro, uid]);
    
    // Save coins count whenever it changes
    useEffect(() => {
        if (coinCount !== undefined && coinCount !== null) {
            saveCoinsCount(coinCount);
        }
    }, [coinCount]);
    
    useEffect(() => {
        if (uid) {
            fetchUserData();
        }
    }, [uid, lastUpdate]);

    const fetchUserData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('name, dp_url, subscription_active')
                .eq('uid', uid)
                .single();

            if (error) {
                console.error('Error fetching user data:', error);
                return;
            }

            if (data) {
                // Get first name and limit to 10 characters
                const firstName = data.name?.split(' ')[0] || '';
                setUserName(firstName.substring(0, 10));
                
                // Set profile picture URL if it exists
                if (data.dp_url) {
                    setDpUrl(data.dp_url);
                }
                
                // Set pro status and save it to utils
                const isUserPro = data.subscription_active || false;
                saveProStatus(isUserPro);
                setLocalIsPro(isUserPro);
                
                // Update global pro status context
                if (checkProStatus) {
                    checkProStatus(uid);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Determine if user should be treated as pro based on both context and local state
    const isUserPro = isPro || localIsPro;

    if (!uid) {
        console.log("No UID in Header");
        return <Text>No UID found</Text>;
    }

    console.log("Current coin count:", coinCount);

    return (
        <View style={[styles.header, {backgroundColor: 'transparent'}]  }>
            {/* Menu Icon */}
         

            {/* Welcome Text with Profile Picture */}
            <View style={[styles.rowContainer]  }>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    <Image 
                        source={dpUrl ? { uri: dpUrl } : require('../assets/Avatar/Cat.png')} 
                        style={[styles.icon]} 
                    />
                </TouchableOpacity>
                
                {loading ? (
                    <ActivityIndicator size="small" color="#333" style={{ marginLeft: 10 }} />
                ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {isUserPro ? (
                            <View style={styles.proContainer}>
                                <Text style={[styles.welcomeText, {color: colors.text}]}>
                                    {userName} 
                                </Text>
                                <View style={[styles.proBadge , {backgroundColor: colors.primary}]}>
                                    <Text style={[styles.proText]}>PRO</Text>
                                </View>
                            </View>
                        ) : (
                            <Text style={[styles.welcomeText, {color: colors.text}]}>
                                Welcome{userName ? ` ${userName}!`: '!'}
                            </Text>
                        )}
                    </View>
                )}
            </View>

            {/* Coin Display with Coin Icon */}
            <TouchableOpacity
                style={[styles.coinContainer, {backgroundColor: colors.background2, borderWidth: 0.8, borderColor: colors.border}]}
                onPress={() =>
                    navigation.navigate('TransactionScreen', { coinCount })
                }
            >
                <Image source={require('../assets/coin.png')} style={[styles.coinIcon]} />
                <Text style={[styles.coinText]}>{coinCount?.toString()}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '95%',
        marginTop:-30,
  
marginBottom:50,
      
    },
    menuButton: {
        padding: 5,
    },
    menuIcon: {
        width: 24,
        height: 24,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        width: 40,
        height: 40,
        marginRight: 3,
       
        borderRadius: 17.5, // Make the image circular
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    coinContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderRadius: 15,
    },
    coinIcon: {
        width: 20,
        height: 20,
        marginRight: 5,
    },
    coinText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF6600',
    },
    proContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    proBadge: {
        backgroundColor: '#FF6600',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 6,
    },
    proText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
});

export default Header;
