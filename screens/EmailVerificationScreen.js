import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

const EmailVerificationScreen = ({ navigation, route }) => {
    const { email, message, isNewUser, isPasswordReset } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
    const [verificationChecked, setVerificationChecked] = useState(false);

    // Format time as MM:SS
    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };

    // Timer countdown effect
    useEffect(() => {
        if (timeLeft <= 0) {
            // Time expired
            Toast.show({
                type: 'error',
                text1: 'Verification Time Expired',
                text2: 'The verification time has expired. Please try again.',
                position: 'bottom'
            });
            
            navigation.navigate('EmailLogin');
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft(prevTime => prevTime - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, navigation]);

    // Check verification status periodically
    useEffect(() => {
        if (verificationChecked) return;

        const checkVerification = async () => {
            try {
                // Check if user exists and is verified
                const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
                
                if (userError) {
                    console.error('Error checking user:', userError);
                    return;
                }
                
                if (userData && userData.user && userData.user.email_confirmed_at) {
                    setVerificationChecked(true);
                    
                    // If this is a password reset, just show success message
                    if (isPasswordReset) {
                        Toast.show({
                            type: 'success',
                            text1: 'Password Reset Successful',
                            text2: 'Your password has been reset successfully. You can now login with your new password.',
                            position: 'bottom'
                        });
                        
                        navigation.navigate('EmailLogin');
                        return;
                    }
                    
                    // If user is verified, sign them in
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: email,
                        password: userData.user.password || '' // This might not work as expected
                    });
                    
                    if (error) {
                        // Just navigate to login if we can't auto-sign in
                        Toast.show({
                            type: 'success',
                            text1: 'Email Verified',
                            text2: 'Your email has been successfully verified! Please login to continue.',
                            position: 'bottom'
                        });
                        
                        navigation.navigate('EmailLogin');
                        return;
                    }
                    
                    // Store session data
                    await AsyncStorage.setItem('supabase-session', JSON.stringify(data.session));
                    
                    // Store user data
                    await AsyncStorage.setItem('uid', data.user.id);
                    await AsyncStorage.setItem('userLoggedIn', 'true');
                    
                    Toast.show({
                        type: 'success',
                        text1: 'Email Verified',
                        text2: 'Your email has been successfully verified!',
                        position: 'bottom'
                    });
                    
                    // Navigate to main screen
                    navigation.replace('Home');
                }
            } catch (error) {
                console.error('Error checking verification:', error);
            }
        };

        // Check immediately and then every 10 seconds
        checkVerification();
        const intervalId = setInterval(checkVerification, 10000);

        return () => clearInterval(intervalId);
    }, [email, navigation, verificationChecked, isPasswordReset]);

    const handleResendVerification = async () => {
        setLoading(true);
        try {
            // Use Supabase to resend verification email
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
            });

            if (error) throw error;
            
            Toast.show({
                type: 'success',
                text1: 'Verification Email Sent',
                text2: 'A new verification email has been sent to your email address.',
                position: 'bottom'
            });
            
            // Reset timer
            setTimeLeft(600);
        } catch (error) {
            console.error('Error resending verification:', error);
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Failed to resend verification email. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Email Icon */}
            <View style={styles.iconContainer}>
                <MaterialIcons name="mark-email-unread" size={80} color="#2274F0" />
            </View>

            {/* Title */}
            <Text style={styles.title}>Verify Your Email</Text>

            {/* Message */}
            <Text style={styles.message}>{message || 'Please check your email and click the verification link to continue.'}</Text>

            {/* Timer */}
            <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>Time remaining:</Text>
                <Text style={styles.timer}>{formatTime(timeLeft)}</Text>
            </View>

            {/* Resend Button */}
            <TouchableOpacity 
                style={styles.resendButton} 
                onPress={handleResendVerification}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <View style={styles.resendButtonContent}>
                        <Icon name="refresh" size={20} color="#fff" style={styles.resendIcon} />
                        <Text style={styles.resendButtonText}>Resend Verification Email</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.navigate('EmailLogin')}
            >
                <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        padding: 20,
    },
    iconContainer: {
        width: 150,
        height: 150,
        marginTop: 60,
        marginBottom: 30,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f7ff',
        borderRadius: 75,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: '#555',
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    timerContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 30,
    },
    timerLabel: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
    },
    timer: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2274F0',
    },
    resendButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 20,
        width: '80%',
        alignItems: 'center',
    },
    resendButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    resendIcon: {
        marginRight: 8,
    },
    resendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    backButton: {
        marginTop: 10,
    },
    backButtonText: {
        color: '#2274F0',
        fontSize: 16,
    },
});

export default EmailVerificationScreen; 