import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';
import { supabase } from '../supabaseClient';

const SignUpDetailsScreen = ({ navigation }) => {
    const route = useRoute();
    const { userInfo = {}, email = '', disableEmailInput = false } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(userInfo?.name || '');
    const [age, setAge] = useState(userInfo?.age || '');
    const [gender, setGender] = useState('Male');
    const [inputEmail, setInputEmail] = useState(userInfo?.email || email || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [referralCode, setReferralCode] = useState('');
    const [preferredLanguage, setPreferredLanguage] = useState('English');

    useEffect(() => {
        console.log('Received user info:', userInfo);
    }, [userInfo]);

    // Function to generate a random 6-digit alphanumeric code
    const generateReferralCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    // Function to check if referral code is valid
    const checkReferralCode = async (code) => {
        if (!code) return { valid: true, referrerId: null }; // Empty code is considered valid (optional)
        
        try {
            const { data, error } = await supabase
                .from('users')
                .select('uid')
                .eq('referral_code', code.toUpperCase())
                .single();
                
            if (error) throw error;
            
            return { valid: !!data, referrerId: data?.uid };
        } catch (error) {
            console.error('Error checking referral code:', error);
            return { valid: false, referrerId: null };
        }
    };

    // Function to update referrer's invited_members and add coins
    const updateReferrer = async (referrerId, newUserId) => {
        try {
            // Get current invited_members array
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('invited_members')
                .eq('uid', referrerId)
                .single();
                
            if (userError) throw userError;
            
            // Prepare the updated array
            const updatedInvitedMembers = userData.invited_members || [];
            updatedInvitedMembers.push(newUserId);
            
            // Update the referrer record
            const { error: updateError } = await supabase
                .from('users')
                .update({ 
                    invited_members: updatedInvitedMembers,
                    user_coins: supabase.rpc('increment', { x: 50 }) // Increment coins by 50
                })
                .eq('uid', referrerId);
                
            if (updateError) throw updateError;
            
            console.log('Referrer updated successfully');
        } catch (error) {
            console.error('Error updating referrer:', error);
        }
    };

    const handleSignUp = async () => {
        // Validate inputs
        if (!name.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter your name',
                position: 'bottom'
            });
            return;
        }

        if (!inputEmail.trim() || !inputEmail.includes('@')) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Please enter a valid email address',
                position: 'bottom'
            });
            return;
        }

        if (password.length < 6) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Password must be at least 6 characters long',
                position: 'bottom'
            });
            return;
        }

        if (password !== confirmPassword) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Passwords do not match',
                position: 'bottom'
            });
            return;
        }

        setLoading(true);
        try {
            // Check if referral code is valid
            const { valid, referrerId } = await checkReferralCode(referralCode);
            
            if (referralCode && !valid) {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Invalid referral code',
                    position: 'bottom'
                });
                setLoading(false);
                return;
            }
            
            // Generate a unique referral code for the new user
            const newReferralCode = generateReferralCode();
            
            // Use Supabase directly for signup
            const { data, error } = await supabase.auth.signUp({
                email: inputEmail.trim(),
                password: password,
                options: {
                    data: {
                        name: name.trim(),
                        age: age ? parseInt(age, 10) : null,
                        gender: gender,
                        preferred_language: preferredLanguage
                    }
                }
            });

            if (error) throw error;

            console.log('Signup successful:', data);
            
            // Instead of storing in the database now, pass the data to verification screen
            const userData = {
                uid: data.user.id,
                name: name.trim(),
                email: inputEmail.trim(),
                age: age ? parseInt(age, 10) : null,
                gender: gender,
                preferred_language: preferredLanguage,
                referral_code: newReferralCode,
                referrerId: referrerId,
                password: password // Pass password for auto-login after verification
            };
            
            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Account created successfully! Please check your email for verification.',
                position: 'bottom'
            });

            // Navigate to email verification screen with user data
            navigation.navigate('EmailVerification', {
                email: inputEmail.trim(),
                message: 'We have sent a verification link to your email. Please verify your email within 10 minutes to continue.',
                isNewUser: true,
                userData: userData // Pass the user data to be saved after verification
            });
        } catch (error) {
            console.error('Error during signup:', error);
            
            // Handle specific error cases
            if (error.message.includes('already registered')) {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'This email is already registered. Please login instead.',
                    position: 'bottom'
                });
                navigation.navigate('EmailLogin');
                return;
            }
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.message || 'Signup failed. Please try again.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Back Button */}
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <View style={styles.backButtonCircle}>
                        <Icon name="arrow-back" size={20} color="#fff" />
                    </View>
                </TouchableOpacity>

                {/* Header */}
                <Text style={styles.headerText}>Create Your Account</Text>

                {/* Input Fields */}
                <View style={styles.inputContainer}>
                    <Icon name="person-outline" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Your Name"
                        placeholderTextColor="#aaa"
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                {/* Email Input */}
                <View style={styles.inputContainer}>
                    <Icon name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                        style={[styles.input, disableEmailInput && styles.disabledInput]}
                        placeholder="Email"
                        placeholderTextColor="#aaa"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={inputEmail}
                        onChangeText={setInputEmail}
                        editable={!disableEmailInput}
                    />
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                    <Icon name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Password"
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

                {/* Confirm Password Input */}
                <View style={styles.inputContainer}>
                    <Icon name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor="#aaa"
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={toggleConfirmPasswordVisibility} style={styles.eyeIcon}>
                        <Icon 
                            name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                            size={20} 
                            color="#aaa" 
                        />
                    </TouchableOpacity>
                </View>

                {/* Age Input */}
                <View style={styles.inputContainer}>
                    <MaterialIcons name="cake" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Age (Optional)"
                        placeholderTextColor="#aaa"
                        keyboardType="numeric"
                        value={age}
                        onChangeText={setAge}
                    />
                </View>

                {/* Referral Code Input */}
                <View style={styles.inputContainer}>
                    <MaterialIcons name="card-giftcard" size={20} color="#aaa" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Referral Code (Optional)"
                        placeholderTextColor="#aaa"
                        autoCapitalize="characters"
                        value={referralCode}
                        onChangeText={setReferralCode}
                    />
                </View>

                {/* Gender Selection */}
                <Text style={styles.labelText}>
                    <Icon name="people-outline" size={20} color="#000" style={{marginRight: 5}} />
                    Select Gender
                </Text>
                <View style={styles.optionsContainer}>
                    {['Male', 'Female', 'Others'].map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.optionButton,
                                gender === item && styles.optionButtonSelected,
                            ]}
                            onPress={() => setGender(item)}
                        >
                            <Text style={{ color: gender === item ? '#fff' : '#000' }}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Language Selection */}
                <Text style={styles.labelText}>
                    <Icon name="language-outline" size={20} color="#000" style={{marginRight: 5}} />
                    Preferred Language
                </Text>
                <View style={styles.optionsContainer}>
                    {['English', 'Traditional Chinese', 'Simplified Chinese'].map((item) => (
                        <TouchableOpacity
                            key={item}
                            style={[
                                styles.optionButton,
                                preferredLanguage === item && styles.optionButtonSelected,
                            ]}
                            onPress={() => setPreferredLanguage(item)}
                        >
                            <Text style={{ color: preferredLanguage === item ? '#fff' : '#000' }}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Centered Submit Button */}
                <View style={styles.centeredButtonContainer}>
                    <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.signupButtonText}>Sign Up</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Already have an account */}
                <TouchableOpacity 
                    style={styles.loginLinkContainer}
                    onPress={() => navigation.navigate('EmailLogin')}
                >
                    <Text style={styles.loginLinkText}>
                        Already have an account? <Text style={styles.loginLink}>Login</Text>
                    </Text>
                </TouchableOpacity>

                {/* Footer */}
                <View style={styles.footerLinks}>
                      <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')}>
                        <Text style={styles.footerLink}>Privacy Policy</Text>
                      </TouchableOpacity>
                      <Text style={styles.separator}> | </Text>
                      <TouchableOpacity onPress={() => navigation.navigate('TermsOfService')}>
                        <Text style={styles.footerLink}>Terms of Service</Text>
                      </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    backButton: {
        position: 'absolute',
        top: 10,
        left: 0,
        zIndex: 100,
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
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 60,
        marginBottom: 30,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
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
    disabledInput: {
        backgroundColor: '#f2f2f2',
        color: '#aaa',
    },
    eyeIcon: {
        padding: 5,
    },
    labelText: {
        fontSize: 16,
        marginBottom: 10,
        fontWeight: 'bold',
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        flexWrap: 'wrap',
    },
    optionButton: {
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 10,
        backgroundColor: '#f2f2f2',
        marginHorizontal: 5,
        marginBottom: 10,
    },
    optionButtonSelected: {
        backgroundColor: '#2274F0',
    },
    centeredButtonContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    signupButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        borderRadius: 30,
        width: '90%',
        alignItems: 'center',
    },
    signupButtonText: {
        color: '#fff',
        fontWeight: 'medium',
        fontSize: 16,
    },
    loginLinkContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    loginLinkText: {
        fontSize: 14,
        color: '#000',
    },
    loginLink: {
        color: '#2274F0',
        fontWeight: 'bold',
    },
    footerLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 20,
        width: '100%',
    },
    footerLink: {
        fontSize: 12,
        color: '#888',
    },
    separator: {
        fontSize: 12,
        color: '#888',
        marginHorizontal: 5,
    },
    disabledButton: {
        opacity: 0.7,
    },
});

export default SignUpDetailsScreen;
