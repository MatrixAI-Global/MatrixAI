import React, { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { NavigationContainer } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';

enableScreens();
import 'react-native-url-polyfill/auto';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen'; // Import HomeScreen directly
import AIShopScreen from './screens/AiShopScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreens';
import OTPCodeScreen from './screens/OTPCodeScreen';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage

import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import EmailVerificationScreen from './screens/EmailVerificationScreen';
import OTPCodeScreen2 from './screens/OTPCodeScreen copy';
import BotScreen from './screens/BotScreen';
import SignUpDetailsScreen from './screens/SignUpDetailsScreen';
import AudioVideoUploadScreen from './screens/AudioVideoUploadScreen';
import TranslateScreen from './screens/TranslateScreen';
import BotScreen2 from './screens/BotScreen copy';
import TranslatorScreen from './screens/Translator';
import VoiceTranslateScreen from './screens/TranslateVoice';
import ImageGenerateScreen from './screens/ImageGenerateScreen';
import LiveTranslateScreen from './screens/LiveTranslateScreen';
import CreateImagesScreen from './screens/createImageScreen';
import CreateImagesScreen2 from './screens/createImageScreen copy';
import VideoUploadScreen from './screens/VideoGenerate.js';
import ImageSelectScreen from './screens/ImageSelectScreen.js';
import CreateVideoScreen from './screens/createVideoScreen.js';
import PPTGenerateScreen from './screens/PPTGenerateScreen.js';
import CreatePPTScreen from './screens/createPPTScreen.js';

import ProductDetailScreen from './screens/ProductDetailScreen';
import FillInformationScreen from './screens/FillInformationScreen';
import SuccessScreen from './screens/successScreen';

import ReferralScreen from './screens/coins/ReferralScreen.js';
import SubscriptionScreen from './screens/coins/SubscriptionScreen.js';
import TransactionScreen from './screens/coins/TransactionScreen.js';

import TransactionScreen2 from './screens/coins/TransactionScreen copy.js';
import TimeScreen from './screens/coins/TimeScreen.js';
import { AuthProvider, AuthContext } from './context/AuthContext';

import CameraScreen from './screens/CameraScreen.js';
import RemoveBackground from './screens/RemoveBackGround.js';
import { ModalProvider } from './components/ModalContext.js';
import SignUpDetailsScreen2 from './screens/SignUpDetailsScreen copy.js';
// import AddProductScreen from './screens/AddProductScreen.js';
// import WishlistScreen from './screens/WishlistScreen.js';
// import AllMusicAiScreen from './screens/AllMusicAiScreen.js';
// import AllVideoAIScreen from './screens/AllVideoAIScreen.js';
// import AllImagesAiScreen from './screens/AllImagesAiScreen.js';
// import SeeAllScreen from './screens/SeeAllScreen.js';
// import SearchScreen from './screens/AIShop/SearchScreen.js';
import EditProfile from './screens/EditProfile.js';
import SettingsScreen from './screens/SettingsScreen.js';
import CallScreen from './screens/CallScreen.js';

import LiveTranscriptionScreen from './screens/LiveTranscriptionScreen.js';
import AudioRecordScreen from './screens/AudioRecordScreen.js';
import EmailLoginScreen from './screens/EmailLoginScreen.js';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen.js';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen.js';
import BUYSubscription from './screens/coins/BUYSubscription.js';
import { ProStatusProvider } from './hooks/useProStatus.js';
import CustomerSupportScreen from './screens/CustomerSupportScreen.js';
import OrderHistoryScreen from './screens/OrderHistoryScreen.js';
import HelpScreen from './screens/HelpScreen.js';
import AddonScreen from './screens/coins/AddonScreen.js';
import FeedbackScreen from './screens/FeedbackScreen.js';
import PaymentScreen from './screens/coins/PaymentScreen.js';
import AirwallexPaymentScreen from './screens/coins/AirwallexPaymentScreen.js';
import StripeProvider from './components/StripeProvider';
import AirwallexProvider from './components/AirwallexProvider';

// Import the LanguageProvider
import { LanguageProvider } from './context/LanguageContext';
import { getPreferredLanguage } from './utils/languageUtils';

const Stack = createStackNavigator();

interface AuthContextType {
    uid: string | null;
    loading: boolean;
    updateUid: (newUid: string) => Promise<void>;
}

const App = () => {
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Show loading state while checking AsyncStorage
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    
    // Check if the user is logged in on initial app load
    useEffect(() => {
        const initializeApp = async () => {
            try {
                // Check login status
                const userStatus = await AsyncStorage.getItem('userLoggedIn');
                if (userStatus === 'true') {
                    setIsLoggedIn(true);
                }
                
                // Pre-load language preference (LanguageContext will handle this)
                console.log('App initialized');
            } catch (error) {
                console.error('Error initializing app:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeApp();
    }, []);

    // If still loading, show a spinner
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <AuthProvider>
            <AuthContext.Consumer>
                {({ uid }: AuthContextType) => (
                    <>
                        <LanguageProvider>
                        <ModalProvider>
                            <ProStatusProvider>
                            <StripeProvider>
                            <AirwallexProvider>
                            <NavigationContainer>
                                <Stack.Navigator>
                                    {/* Onboarding Screen */}
                                    {!onboardingCompleted && !isLoggedIn && (
                                        <Stack.Screen 
                                            name="Onboarding" 
                                            options={{ headerShown: false }}
                                        >
                                            {(props) => (
                                                <OnboardingScreen
                                                    {...props}
                                                    onFinish={() => setOnboardingCompleted(true)}
                                                />
                                            )}
                                        </Stack.Screen>
                                    )}

                                    {/* Login Screens */}
                                    {!isLoggedIn && (
                                        <>
                                            <Stack.Screen 
                                                name="Login" 
                                                component={LoginScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                         
                                            <Stack.Screen 
                                                name="EmailLogin" 
                                                component={EmailLoginScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="ForgotPassword" 
                                                component={ForgotPasswordScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="EmailVerification" 
                                                component={EmailVerificationScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="OTPCode2" 
                                                component={OTPCodeScreen2} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="OTPCode" 
                                                component={OTPCodeScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="SignUpDetails" 
                                                component={SignUpDetailsScreen} 
                                                options={{ headerShown: false }} 
                                            />
                                            <Stack.Screen 
                                                name="SignUpDetails2" 
                                                component={SignUpDetailsScreen2} 
                                                options={{ headerShown: false }} 
                                            />
                                          <Stack.Screen
  name="TermsOfService"
  component={TermsOfServiceScreen}
  options={{
    title: 'Terms of Service',
    headerStyle: {
      backgroundColor: '#2274F0', // Custom background color
    },
    headerTintColor: '#fff', // Custom text color for the title and back button
    headerTitleStyle: {
      fontWeight: 'bold', // Custom font weight for the title
    },
  }}
/>
<Stack.Screen
  name="PrivacyPolicy"
  component={PrivacyPolicyScreen}
  options={{
    title: 'Privacy Policy',
    headerStyle: {
      backgroundColor: '#2274F0', // Custom background color
    },
    headerTintColor: '#fff', // Custom text color for the title and back button
    headerTitleStyle: {
      fontWeight: 'bold', // Custom font weight for the title
    },
  }}
/>
                                        </>
                                    )}

                                    {/* Main App Screens - Use HomeScreen as initial screen */}
                                    <Stack.Screen 
                                        name="Home" 
                                        component={HomeScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="AIShop" 
                                        component={AIShopScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="Profile" 
                                        component={ProfileScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="BotScreen" 
                                        component={BotScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="BotScreen2" 
                                        component={BotScreen2} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TranslateScreen" 
                                        component={AudioVideoUploadScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TranslateScreen4" 
                                        component={VoiceTranslateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TranslateScreen2" 
                                        component={TranslateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TranslateScreen3" 
                                        component={TranslatorScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="ImageTextScreen" 
                                        component={ImageGenerateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="LiveTranslateScreen" 
                                        component={LiveTranslateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreateImageScreen" 
                                        component={CreateImagesScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreateImageScreen2" 
                                        component={CreateImagesScreen2} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="VideoUpload" 
                                        component={VideoUploadScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="ImageSelectScreen" 
                                        component={ImageSelectScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreateVideoScreen" 
                                        component={CreateVideoScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PPTGenerateScreen" 
                                        component={PPTGenerateScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CreatePPTScreen" 
                                        component={CreatePPTScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="ProductDetail" 
                                        component={ProductDetailScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="FillInformationScreen" 
                                        component={FillInformationScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PaymentSuccess" 
                                        component={SuccessScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                   
                                    <Stack.Screen 
                                        name="ReferralScreen" 
                                        component={ReferralScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="SubscriptionScreen" 
                                        component={SubscriptionScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TransactionScreen" 
                                        component={TransactionScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                     <Stack.Screen 
                                        name="SettingsScreen" 
                                        component={SettingsScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TransactionScreen2" 
                                        component={TransactionScreen2} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="TimeScreen" 
                                        component={TimeScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                    <Stack.Screen 
                                        name="CameraScreen" 
                                        component={CameraScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="RemoveBackground" 
                                        component={RemoveBackground} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                   
                                      <Stack.Screen 
                                        name="EditProfile" 
                                        component={EditProfile} 
                                        options={{ headerShown: false }} 
                                    />
                                  
                                    <Stack.Screen 
                                        name="CallScreen" 
                                        component={CallScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                 
                                     <Stack.Screen 
                                        name="LiveTranscription" 
                                        component={LiveTranscriptionScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="AudioRecordScreen" 
                                        component={AudioRecordScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                  
                                    <Stack.Screen 
                                        name="BUYSubscription" 
                                        component={BUYSubscription} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="PaymentScreen" 
                                        component={PaymentScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="AirwallexPaymentScreen" 
                                        component={AirwallexPaymentScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                    <Stack.Screen 
                                        name="CustomerSupportScreen" 
                                        component={CustomerSupportScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                   <Stack.Screen 
                                   name="OrderHistoryScreen" 
                                   component={OrderHistoryScreen} 
                                   options={{ headerShown: false }} 
                                   />
                                   <Stack.Screen 
                                   name="HelpScreen" 
                                   component={HelpScreen} 
                                   options={{ headerShown: false }} 
                                   />
                                   <Stack.Screen 
                                   name="AddonScreen" 
                                   component={AddonScreen} 
                                   options={{ headerShown: false }} 
                                   />
                                    <Stack.Screen 
                                        name="FeedbackScreen" 
                                        component={FeedbackScreen} 
                                        options={{ headerShown: false }} 
                                    />
                                </Stack.Navigator>
                            </NavigationContainer>
                            </AirwallexProvider>
                            </StripeProvider>
                            </ProStatusProvider>
                        </ModalProvider>
                        </LanguageProvider>
                    </>
                )}
            </AuthContext.Consumer>
        </AuthProvider>
    );
};

export default App;
