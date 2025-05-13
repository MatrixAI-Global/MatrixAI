import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Animated,
  ActivityIndicator,
  Linking,
  Easing,
  StatusBar,
  ScrollView,
  Alert,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import LottieView from "lottie-react-native";
import { useAuthUser } from '../hooks/useAuthUser';
import { useFocusEffect } from '@react-navigation/native';
const { width, height } = Dimensions.get("window");

const MAX_PROMPT_LENGTH = 100; // Maximum characters before truncation

const CreateImagesScreen = ({ route, navigation }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { message, imageCount = 1 } = route.params; // Extract text and imageCount from params
  const [images, setImages] = useState([]); // Store the generated image URLs
  const [loading, setLoading] = useState(true); // Track loading state
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [currentViewingImage, setCurrentViewingImage] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(true); // Control skeleton visibility
  const { uid } = useAuthUser();  
  
  // Animated values
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loadingDots = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.95)).current;

  // Format prompt for display
  const truncatedMessage = message.length > MAX_PROMPT_LENGTH 
    ? `${message.substring(0, MAX_PROMPT_LENGTH)}...` 
    : message;

  // Clear data when screen loses focus and reset when it gains focus
  useFocusEffect(
    React.useCallback(() => {
      // This runs when the screen comes into focus
      clearStoredImages(); // Clear any previous images first
      fetchAndStoreImages();
      
      // This runs when the screen goes out of focus
      return () => {
        // Clear state when navigating away
        setImages([]);
        setCurrentViewingImage(null);
        setModalVisible(false);
        // Clear stored images
        clearStoredImages();
      };
    }, [message, imageCount])
  );

  // Function to clear stored images
  const clearStoredImages = async () => {
    try {
      await AsyncStorage.removeItem("downloadedImages");
    } catch (error) {
      console.error("Error clearing stored images:", error);
    }
  };

  useEffect(() => {
    // Start shimmer animation
    Animated.loop(
      Animated.timing(shimmerValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Start loading dots animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingDots, {
          toValue: 3,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(loadingDots, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
    
    // Clean up when component unmounts
    return () => {
      setImages([]);
      setCurrentViewingImage(null);
      clearStoredImages();
    };
  }, [shimmerValue, pulseAnim, loadingDots]);

  // Function to fetch and process images
  const fetchAndStoreImages = async () => {
    try {
      // Clear any previously stored images when fetching new ones
      await clearStoredImages();
      
      setLoading(true);
      setShowSkeleton(true);
      
      // Reset animation values
      imageOpacity.setValue(0);
      imageScale.setValue(0.95);
      
      // Make API request to generate new images
      const response = await axios.post(
        "https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/generateImage2",
        { 
          text: message, 
          uid: uid,
          imageCount: imageCount 
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY`,
          },
        }
      );

      if (response.data && response.data.images && response.data.images.length > 0) {
        const imageData = response.data.images;
        await AsyncStorage.setItem("downloadedImages", JSON.stringify(imageData));
        setImages(imageData.map(img => img.url));
        
        // Show skeleton for 1 second before revealing the images
        setTimeout(() => {
          setShowSkeleton(false);
          setLoading(false);
          fadeInImage();
        }, 1000);
      } else {
        setLoading(false);
        setShowSkeleton(false);
        Alert.alert("Error", "Failed to generate images. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching images:", error);
      setLoading(false);
      setShowSkeleton(false);
      Alert.alert("Error", "Something went wrong. Please try again.");
    }
  };

  const fadeInImage = () => {
    Animated.parallel([
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(imageScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleTryAgain = () => {
    fetchAndStoreImages();
  };

  const openImageModal = (url) => {
    setCurrentViewingImage(url);
    setModalVisible(true);
  };

  // Determine loading text with animated dots
  const loadingText = `Creating${'.'.repeat(loadingDots.__getValue())}`;

  // Create shimmer interpolation
  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const renderSkeleton = () => {
    if (imageCount === 1) {
      return renderSingleSkeleton();
    } else {
      return (
        <View style={styles.gridContainer}>
          {[...Array(imageCount)].map((_, index) => (
            <View key={index} style={styles.gridItem}>
              <View style={styles.gridImageSkeleton}>
                <Animated.View
                  style={[
                    styles.shimmer,
                    { transform: [{ translateX: shimmerTranslate }] },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }
  };

  const renderSingleSkeleton = () => (
    <View style={styles.singleContainer}>
      <View style={styles.imageSkeleton}>
        <Animated.View
          style={[
            styles.shimmer,
            { transform: [{ translateX: shimmerTranslate }] },
          ]}
        />
      </View>
    </View>
  );

  const renderSingleImage = () => (
    <Animated.View 
      style={[
        styles.singleContainer, 
        { 
          opacity: imageOpacity,
          transform: [{ scale: imageScale }] 
        }
      ]}
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.1)']}
        style={styles.imageBorder}
      >
        {images.length > 0 ? (
          <Image
            source={{ uri: images[0] }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.placeholderContainer}>
            <MaterialIcons name="image-not-supported" size={32} color="#555" />
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.expandButton}
          onPress={() => openImageModal(images[0])}
        >
          <MaterialIcons name="fullscreen" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  const renderGridImages = () => (
    <Animated.View 
      style={[
        styles.gridContainer, 
        { 
          opacity: imageOpacity,
          transform: [{ scale: imageScale }] 
        }
      ]}
    >
      {images.map((url, index) => (
        <View key={index} style={styles.gridItem}>
          <LinearGradient
            colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.1)']}
            style={styles.gridImageBorder}
          >
            <Image
              source={{ uri: url }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            
            <TouchableOpacity 
              style={styles.gridExpandButton}
              onPress={() => openImageModal(url)}
            >
              <MaterialIcons name="fullscreen" size={16} color="#fff" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ))}
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar barStyle="light-content" />
      
      <Animatable.View 
        animation="fadeIn" 
        duration={600} 
        style={styles.header}
      >
        <TouchableOpacity 
          style={[styles.backButton, {backgroundColor: colors.primary}]} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color='#fff' />
        </TouchableOpacity>
        
        <Text style={[styles.heading, {color: colors.text}]}>
          {loading ? "AI Image Generation" : "AI Generated Image"}
        </Text>
      </Animatable.View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <Animatable.View 
          animation="fadeIn" 
          delay={300}
          style={styles.promptContainer}
        >
          <Text style={styles.promptLabel}>PROMPT</Text>
          {message.length > 100 ? (
            <Text style={styles.promptText}>{message.substring(0, 100) + "..."}</Text>
          ) : (
            <Text style={styles.promptText}>{message}</Text>
          )}
        </Animatable.View>

        {loading ? (
          <>
            <Animatable.View 
              animation="fadeIn" 
              delay={400}
              style={styles.loadingContainer}
            >
              <View style={styles.loadingIndicator}>
                <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
                <LottieView
                  source={require('../assets/image2.json')}
                  autoPlay
                  loop
                  style={{width: '100%', height: 100, backgroundColor: 'transparent'}}
                />
                </Animated.View>
              </View>
              <Text style={[styles.loadingText, {color: colors.text}]}>{loadingText}</Text>
              <Text style={[styles.subtext, {color: colors.text}]}>
                Please don't leave this screen while the image is being generated
              </Text>
            </Animatable.View>
          </>
        ) : null}
        
        {/* Show skeletons during loading or when showSkeleton is true */}
        {(loading || showSkeleton) ? renderSkeleton() : (
          imageCount === 1 ? renderSingleImage() : renderGridImages()
        )}

        {!loading && !showSkeleton && (
          <Animatable.View 
            animation="fadeInUp" 
            duration={600}
            style={styles.buttonsContainer}
          >
            <TouchableOpacity 
              style={styles.tryAgainButton} 
              onPress={handleTryAgain}
            >
              <MaterialIcons name="refresh" size={20} color="#000" />
              <Text style={styles.tryAgainText}>Generate Again</Text>
            </TouchableOpacity>
            
            {images.length > 0 && (
              <TouchableOpacity
                style={[styles.downloadButton]}
                onPress={() => Linking.openURL(images[0])}
              >
                <MaterialIcons name="file-download" size={20} color="#fff" />
                <Text style={styles.downloadText}>Download</Text>
              </TouchableOpacity>
            )}
          </Animatable.View>
        )}
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Animatable.View 
            animation="zoomIn" 
            duration={300}
            style={[
              styles.modalContent,
              {backgroundColor: colors.card}
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, {color: colors.text}]}>Image Preview</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalImageContainer}>
              <Image
                source={{ uri: currentViewingImage }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => Linking.openURL(currentViewingImage)}
              >
                <MaterialIcons name="file-download" size={20} color="#fff" />
                <Text style={styles.modalActionText}>Download</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <MaterialIcons name="close" size={20} color="#000" />
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600",
    color: '#fff',
    flex: 1,
  },
  promptContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8A8A',
    marginBottom: 8,
    letterSpacing: 1,
  },
  promptBox: {
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  promptText: {
    fontSize: 16,
    color: '#00A1F7FF',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  loadingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 12,
    color: '#8A8A8A',
    textAlign: "center",
    maxWidth: '85%',
  },
  singleContainer: {
    width: width * 0.85,
    height: width * 0.85,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    marginVertical: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gridContainer: {
    width: width * 0.9,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  gridItem: {
    width: (width * 0.9 - 12) / 2,
    height: (width * 0.9 - 12) / 2,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  imageBorder: {
    width: '100%',
    height: '100%',
    padding: 2,
    borderRadius: 16,
  },
  gridImageBorder: {
    width: '100%',
    height: '100%',
    padding: 2,
    borderRadius: 12,
  },
  imageSkeleton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    position: "relative",
    borderRadius: 16,
  },
  gridImageSkeleton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    position: "relative",
    borderRadius: 12,
  },
  shimmer: {
    width: "30%",
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    position: "absolute",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  expandButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  gridExpandButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 8,
  },
  tryAgainText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#4F74FF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 8,
  },
  downloadText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalImageContainer: {
    height: height * 0.4,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  modalActions: {
    padding: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "#4F74FF",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 8,
  },
  modalActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', 
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 8,
  },
  closeButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default CreateImagesScreen;
