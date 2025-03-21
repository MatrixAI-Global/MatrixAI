import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Dimensions, ActivityIndicator, Modal, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import Icon from 'react-native-vector-icons/Ionicons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { CheckBox } from '@react-native-community/checkbox';
const { width } = Dimensions.get('window');

const EmailLoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isChecked, setChecked] = useState(false);

    const handleLogin = async () => {
        // Validate email and password
        if (email.trim() === '' || !email.includes('@')) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid email address!',
                position: 'bottom'
            });
            return;
        }

        if (password.trim() === '' || password.length < 6) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid password (minimum 6 characters)!',
                position: 'bottom'
            });
            return;
        }
    
        setLoading(true);
    
        try {
            // Use Supabase directly for login
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim()
            });

            if (error) {
                // Check if the error is about user not registered
                if (error.message.includes('Invalid login credentials') || 
                    error.message.includes('Email not confirmed')) {
                    
                    // Check if the user exists but is not registered
                    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email.trim());
                    
                    if (userError || !userData) {
                        // User doesn't exist, navigate to signup
                        Toast.show({
                            type: 'info',
                            text1: 'User not found',
                            text2: 'Please sign up to create an account.',
                            position: 'bottom'
                        });
                        
                        navigation.navigate('SignUpDetails', {
                            email: email.trim(),
                            disableEmailInput: false,
                        });
                        return;
                    }
                    
                    // User exists but email not confirmed
                    if (error.message.includes('Email not confirmed')) {
                        Toast.show({
                            type: 'info',
                            text1: 'Email not verified',
                            text2: 'Please verify your email to continue.',
                            position: 'bottom'
                        });
                        
                        navigation.navigate('EmailVerification', { 
                            email: email.trim(),
                            message: 'Please verify your email to continue.'
                        });
                        return;
                    }
                }
                
                throw error;
            }
            
            // Check if email is verified
            if (data.user && !data.user.email_confirmed_at) {
                Toast.show({
                    type: 'info',
                    text1: 'Email not verified',
                    text2: 'Please verify your email to continue.',
                    position: 'bottom'
                });
                
                navigation.navigate('EmailVerification', { 
                    email: email.trim(),
                    message: 'Please verify your email to continue.'
                });
                return;
            }
    
            // If we have user data in the response
            if (data.user?.id) {
                // Store session data
                await AsyncStorage.setItem('supabase-session', JSON.stringify(data.session));
                
                // Store user data
                await AsyncStorage.setItem('uid', data.user.id);
                await AsyncStorage.setItem('userLoggedIn', 'true');
                
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Login successful!',
                    position: 'bottom'
                });
                
                // Navigate to main screen
                navigation.replace('Home');
            } else {
                throw new Error('No user data in response');
            }
        } catch (error) {
            console.error('Error during login:', error);
            
            Toast.show({
                type: 'error',
                text1: 'Login Failed',
                text2: error.message || 'Login failed. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = () => {
        navigation.navigate('SignUpDetails', {
            email: email.trim() || '', // Pass the entered email if available
            disableEmailInput: false, // Allow email input on SignUpDetails screen
        });
    };

    const handleForgotPassword = () => {
        navigation.navigate('ForgotPassword');
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonCircle}>
                    <Icon name="arrow-back" size={20} color="#fff" />
                </View>
            </TouchableOpacity>

            {/* Heading */}
            <Text style={styles.heading}>Log in and unlock{'\n'}the digital universe</Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
                <Icon name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#aaa"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
                <Icon name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#aaa"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                />
                <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
                    <Icon 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={20} 
                        color="#aaa" 
                    />
                </TouchableOpacity>
            </View>
            <View style={styles.TermsContainer}>
                <CheckBox
                    value={isChecked}
                    onValueChange={setChecked}
                />
                <Text style={styles.TermsText}>By logging in, you agree to our</Text>
                <TouchableOpacity style={styles.TermsLink} onPress={() => navigation.navigate('TermsOfService')}>
                    <Text style={styles.TermsLinkText}>Terms of Service</Text>
                </TouchableOpacity>
            </View>
            {/* Forgot Password Link */}
            <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.orText}>or continue with</Text>
                <View style={styles.divider} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialButtonsContainer}>
                <TouchableOpacity style={styles.socialButton}>
                    <FontAwesome name="google" size={24} color="#DB4437" />
                </TouchableOpacity>
               
                <TouchableOpacity style={styles.socialButton}>
                    <FontAwesome name="apple" size={24} color="#000" />
                </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <Text style={styles.signupText}>
                Don't have an account?
                <Text style={styles.signupLink} onPress={handleSignUp}> Sign up</Text>
            </Text>

            {/* Privacy Policy and Terms */}
            <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                    <Text style={styles.footerLink}>Privacy Policy</Text>
                </TouchableOpacity>
                <Text style={styles.separator}> | </Text>
                <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                    <Text style={styles.footerLink}>Terms of Service</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
    },
    backButtonCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2274F0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#aaa',
    },
    heading: {
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 80,
        marginBottom: 40,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    eyeIcon: {
        padding: 5,
    },
    forgotPasswordContainer: {
        alignSelf: 'flex-end',
        marginBottom: 20,
    },
    forgotPasswordText: {
        color: '#2274F0',
        fontSize: 14,
    },
    loginButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        borderRadius: 30,
        width: '90%',
        alignItems: 'center',
        marginBottom: 20,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'medium',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 10,
        width: '100%',
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },
    orText: {
        marginHorizontal: 10,
        color: '#aaa',
        fontSize: 14,
    },
    socialButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '80%',
        marginVertical: 10,
    },
    socialButton: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 50,
        padding: 10,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    signupText: {
        fontSize: 14,
        color: '#000',
        marginTop: 10,
    },
    signupLink: {
        color: '#2274F0',
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
        width: '100%',
    },
    footerText: {
        color: '#aaa',
        fontSize: 12,
    },
    footerLink: {
        color: '#aaa',
        fontSize: 12,
    },
    separator: {
        color: '#aaa',
        fontSize: 12,
        marginHorizontal: 5,
    },
    TermsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
        width: '100%',
    },
    TermsText: {
        fontSize: 12,
        color: '#aaa',
    },
    TermsLink: {
        fontSize: 12,
        color: '#2274F0',
    },
    TermsLinkText: {
        fontSize: 12,
        color: '#2274F0',
    },
});

export default EmailLoginScreen;
