import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image, StatusBar, Dimensions, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Easing } from 'react-native';
import Header from '../components/Header';
import FeatureCard from '../components/FeatureCard';
import FloatingButton from '../components/FloatingButton';
import FeatureCardWithDetails from '../components/FeatureCardWithDetails';
import { useAuth } from '../hooks/useAuth';
import { SafeAreaView } from 'react-native-safe-area-context';
import Banner2 from '../components/AIShop/Banner copy';
import SidePanel from '../components/SidePanel';
import { ProStatusProvider } from '../hooks/useProStatus';
import FeatureCardWithDetailsPro from '../components/FeatureCardWithDetailsPro';  
import FeatureCardWithDetailsAddon from '../components/FeatureCardWithDetailsAddon';
import LanguageSelector from '../components/LanguageSelector';
import { useLanguage } from '../context/LanguageContext';
import { ThemedView, ThemedText } from '../components/ThemedView';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window'); // Get screen width
import { useProStatus } from '../hooks/useProStatus';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import FeatureCardWithDetails2 from '../components/FeatureCardWithDetails copy';
import { getProStatus, getCoinsCount } from '../utils/proStatusUtils';

const HomeScreen = ({ navigation }) => {
  const { uid, loading } = useAuth();
  const rotateValue = useRef(new Animated.Value(0)).current;
  const [isRotatingFast, setIsRotatingFast] = useState(false);
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(false);
  const coinCount = useCoinsSubscription(uid);
  const { t } = useLanguage();
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  
  // Access the pro status
  const { isPro, checkProStatus } = useProStatus();
  const [localIsPro, setLocalIsPro] = useState(false);
  
  // Additional fallback check from storage to ensure pro status consistency
  useEffect(() => {
    const checkStoredProStatus = async () => {
      try {
        const storedProStatus = await getProStatus();
        const storedCoinsCount = await getCoinsCount();
        
        console.log('HomeScreen - Stored Pro Status:', storedProStatus);
        console.log('HomeScreen - Stored Coins Count:', storedCoinsCount);
        
        // Update local state with stored value
        setLocalIsPro(storedProStatus);
        
        // If stored status says user is pro but context doesn't, update context
        if (storedProStatus && !isPro && uid) {
          checkProStatus(uid);
        }
      } catch (error) {
        console.error('Error checking stored pro status:', error);
      }
    };
    
    checkStoredProStatus();
  }, [isPro, uid]);
  
  // Determine if user should be treated as pro based on both context and local state
  const isUserPro = isPro || localIsPro;
  
  // Gradient rotation animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: isRotatingFast ? 1000 : 8000,  // Change speed based on button click
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotateValue, isRotatingFast]);

  // Interpolate rotation value
  const rotation = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const circleRadius = width * 2; // 60% of screen width

  const handleButtonPress = () => {
    setIsRotatingFast(true);

    // Stop fast rotation after 3 seconds
    setTimeout(() => {
      setIsRotatingFast(false);
      // Navigate to TranslateScreen after 3 seconds
      navigation.navigate('TranslateScreen');
    }, 1000);
  };

  // Function to toggle the side panel
  const toggleSidePanel = () => {
    setIsSidePanelVisible(!isSidePanelVisible);
  };

  return (
    <ProStatusProvider>
     
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Fixed Header */}
        <View style={[styles.fixedHeader, { backgroundColor: colors.background }]}>
          <Header navigation={navigation} uid={uid} openDrawer={toggleSidePanel} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Rotating Animated Gradient with Fixed Content */}
          <ThemedView style={styles.content}>
            <View style={styles.roundedCardContainer}>
              <Animated.View
                style={[
                  styles.animatedGradientContainer,
                  {
                    width: circleRadius,
                    height: circleRadius,
                    borderRadius: circleRadius / 2,
                    top: -(circleRadius * 0.1), // Adjust position for centering
                    left: '50%',
                    marginLeft: -(circleRadius / 2), // Ensure it's centered horizontally
                    transform: [{ rotate: rotation }],
                  },
                ]}>
                <LinearGradient
                  colors={['#2A76F1', '#88C2FF', '#2A76F1']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.gradientBackground}
                />
              </Animated.View>

              <View style={styles.gradientContent}>
                <View style={styles.rowContainer}>
                  <View style={styles.micContainer}>
                    <Image source={require('../assets/voice.png')} style={styles.micIcon} />
                  </View>
                  <View style={styles.columnContainer}>
                    <ThemedText style={styles.sectionTitle}>{t('speechToText')}</ThemedText>
                    <ThemedText style={styles.voiceChangeText}>{t('convertAudioToText')}</ThemedText>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.createButton} onPress={handleButtonPress}>
                <Text style={styles.createButtonText}>{t('create')}</Text>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Scrollable Content */}
          {/* Feature Cards */}
          <ThemedView style={styles.featureRow}>
            <FeatureCard
              title={t('generateImage')}
              description={t('createStunningImageDesc')}
              iconSource={require('../assets/card/image.png')}
              navigation={navigation}
              targetScreen="ImageTextScreen"
            />
        
            <FeatureCard
              title={t('generateVideo')}
              description={t('convertVideoDesc')}
              iconSource={require('../assets/card/video.png')}
              navigation={navigation}
              targetScreen="VideoUpload"
            />
          </ThemedView>
          <ThemedView style={styles.featureRow}>
            <FeatureCard
              title={t('removeBackground')}
              description={t('removeBackgroundDesc')}
              iconSource={require('../assets/card/image.png')}
              navigation={navigation}
              targetScreen="RemoveBackground"
            />
      
            <FeatureCard
              title={t('createPPT')}
              description={t('createPPTDesc')}
              iconSource={require('../assets/card/ppt.png')}
              navigation={navigation}
              targetScreen="PPTGenerateScreen"
            />
          </ThemedView>
          
          {/* Conditional rendering based on Pro status */}
          {!isUserPro ? (
            <FeatureCardWithDetails2/>
          ) : (
            <>
              <FeatureCardWithDetailsPro/>
              {(coinCount < 200) && <FeatureCardWithDetailsAddon/>}
            </>
          )}
          <ThemedView style={styles.endTextContainer}>
            <ThemedText style={styles.crossBee}>MatrixAI❤️</ThemedText>
            <ThemedText style={styles.AppYard3}>{t('worldsBestAITools')}</ThemedText>
            <ThemedText style={styles.AppYard4}>{t('allRightsReserved')}</ThemedText>
          </ThemedView>
        </ScrollView>
        <FloatingButton />
      </SafeAreaView>
    </ProStatusProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFFFF',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  banner:{
    alignSelf:'center',
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnContainer: {
    flexDirection: 'column',
    alignItems: 'start',
  },
  content: {
    marginTop: 20,
   
  },
  roundedCardContainer: {
    width: '100%',
    height: 130,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  animatedGradientContainer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  gradientBackground: {
    flex: 1,
    borderRadius: 500,  // Ensures it's circular
  },
  gradientContent: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'flex-start', // Align text to the left
    top: 20,
    left: 20,
  },
  micContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FF6600',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10, // Space between mic and text
  },
  micIcon: {
    width: 25,
    height: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  voiceChangeText: {
    fontSize: 12,
    color: '#FFF',
    marginTop: 5, // Space between speech to script and change voice text
  },
  createButton: {
    backgroundColor: '#262626',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '80%',
    alignSelf: 'center',
    marginTop: 60, // Space between change voice text and button
    justifyContent: 'center', // Vertically center the content inside the button
    alignItems: 'center', // Horizontally center the content inside the button
  },
  createButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center', // Ensures the text is centered inside the button
  },
  endTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop: 10,
  },
  crossBee: {
    fontSize: 28,
    color: '#95959527',
    fontWeight: 'bold',
  },
  AppYard3: { 
    fontSize: 20,
    color: '#95959527',
    fontWeight: 'bold',
  },
  AppYard4: { 
    fontSize: 12,
    color: '#9595957D',
    fontWeight: 'bold',
    marginTop: 20,
    alignSelf: 'center',
  },
  
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  scrollViewContent: {
  
    paddingBottom: 20,
  },
  fixedHeader: {
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  languageSelector: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1100,
  },
  statusBarContainer: {
    backgroundColor: '#2A76F1',
  }
});

export default HomeScreen;
