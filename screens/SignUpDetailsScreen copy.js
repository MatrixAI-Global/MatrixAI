import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
const SignUpDetailsScreen2 = ({ navigation }) => {
    const route = useRoute();
    const { userInfo = {}, phone = '', disableEmailInput = false } = route.params || {};
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(userInfo?.name || '');
    const [age, setAge] = useState(userInfo?.age || '');
    const [gender, setGender] = useState('Male');
    const [alternateNumber, setAlternateNumber] = useState('');
    const [inputEmail, setInputEmail] = useState(userInfo?.email || phone || '');
    const [phoneNumber, setPhoneNumber] = useState(userInfo?.phone || phone || '');
    const [password, setPassword] = useState('');

    useEffect(() => {
        console.log('Received user info:', userInfo);
    }, [userInfo]);

   
    return (
        <SafeAreaView style={styles.container}>
            
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <View style={styles.backButtonCircle}>
                    <Icon name="arrow-back" size={20} color="#fff" />
                </View>
            </TouchableOpacity>


            {/* Header */}
            <Text style={styles.headerText}>Complete Your Profile</Text>

            {/* Input Fields */}
            <TextInput
                style={styles.input}
                placeholder="Enter Your Name"
                placeholderTextColor="#aaa"
                value={name}
                onChangeText={setName}
            />

            <TextInput
                style={styles.input}
                placeholder="Select Age"
                placeholderTextColor="#aaa"
            
                value={age}
                onChangeText={setAge}
            />

            {/* Gender Selection */}
            <Text style={styles.genderLabel}>Select Gender</Text>
            <View style={styles.genderContainer}>
                {['Male', 'Female', 'Others'].map((item) => (
                    <TouchableOpacity
                        key={item}
                        style={[
                            styles.genderButton,
                            gender === item && styles.genderButtonSelected,
                        ]}
                        onPress={() => setGender(item)}
                    >
                        <Text style={{ color: gender === item ? '#fff' : '#000' }}>{item}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Email Input */}
            <TextInput
                style={[styles.input, styles.disabledInput]}
                placeholder="Email"
                placeholderTextColor="#aaa"
                value={inputEmail}
                editable={false}
            />

            <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
            />

            <TextInput
                style={styles.input}
                placeholder="Alternate Number (Optional)"
                placeholderTextColor="#aaa"
                keyboardType="phone-pad"
                value={alternateNumber}
                onChangeText={setAlternateNumber}
            />

            <TextInput
                style={styles.input}
                placeholder="Enter Password"
                placeholderTextColor="#aaa"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            {/* Centered Submit Button */}
            <View style={styles.centeredButtonContainer}>
                <TouchableOpacity style={styles.otpButton} onPress={handleLogin}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.otpButtonText}>Save Data</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Privacy Policy</Text>
                <Text style={styles.footerText}>Term of Service</Text>
            </View>
            
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
    backArrow: {
        tintColor: '#fff',
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    headerText: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 80,
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        marginBottom: 20,
        color: '#000',
    },
    disabledInput: {
        backgroundColor: '#f2f2f2',
        color: '#aaa',
    },
    genderLabel: {
        fontSize: 16,
        marginBottom: 10,
        fontWeight: 'bold',
    },
    genderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    genderButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        backgroundColor: '#f2f2f2',
    },
    genderButtonSelected: {
        backgroundColor: '#2274F0',
    },
    centeredButtonContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    otpButton: {
        backgroundColor: '#2274F0',
        paddingVertical: 12,
        borderRadius: 30,
        width: '90%',
        alignItems: 'center',
    },
    otpButtonText: {
        color: '#fff',
        fontWeight: 'medium',
        fontSize: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 30,
    },
    footerText: {
        fontSize: 12,
        color: '#aaa',
    },
});

export default SignUpDetailsScreen2;
