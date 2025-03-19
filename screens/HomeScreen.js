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
const { width } = Dimensions.get('window'); // Get screen width
import { useProStatus } from '../hooks/useProStatus';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
const HomeScreen = ({ navigation }) => {
  const { uid, loading } = useAuth();
  const rotateValue = useRef(new Animated.Value(0)).current;
  const [isRotatingFast, setIsRotatingFast] = useState(false);
  const [isSidePanelVisible, setIsSidePanelVisible] = useState(false);
  const coinCount = useCoinsSubscription(uid);
  
  // Access the pro status
  const { isPro } = useProStatus();
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
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Fixed Header */}
        <View style={styles.fixedHeader}>
          <Header navigation={navigation} uid={uid} openDrawer={toggleSidePanel} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Rotating Animated Gradient with Fixed Content */}
          <View style={styles.content}>
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
                    <Text style={styles.sectionTitle}>Speech to Script</Text>
                    <Text style={styles.voiceChangeText}> Change your voice as you wish</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.createButton} onPress={handleButtonPress}>
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable Content */}
          {/* Feature Cards */}
          <View style={styles.featureRow}>
           
            <FeatureCard
              title="Generate Image"
              description="Create stunning Image with MatrixAI"
              iconSource={require('../assets/card/image.png')}
              navigation={navigation}
              targetScreen="ImageTextScreen"
            />
        
            <FeatureCard
              title="Generate Video"
              description="Convert your own Video."
              iconSource={require('../assets/card/video.png')}
              navigation={navigation}
              targetScreen="VideoUpload"
            />
            </View>
            <View style={styles.featureRow}>
            <FeatureCard
              title="Remove Background"
              description="Remove Background from you Images."
              iconSource={require('../assets/card/image.png')}
              navigation={navigation}
              targetScreen="RemoveBackground"
            />
      
            <FeatureCard
              title="Create Presentation"
              description="Create your prsentation is less than a minutue"
              iconSource={require('../assets/card/ppt.png')}
              navigation={navigation}
              targetScreen="PPTGenerateScreen"
            />
         
          </View>
           {/* Conditional rendering based on Pro status */}
           {!isPro ? (
            <FeatureCardWithDetails/>
          ) : (
            <>
              <FeatureCardWithDetailsPro/>
              {(coinCount < 200) && <FeatureCardWithDetailsAddon/>}
            </>
          )}
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
    padding: 10,
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
    paddingHorizontal: 20,
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
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  scrollViewContent: {
  
    paddingBottom: 100,
  },
  fixedHeader: {
  
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
});

export default HomeScreen;
