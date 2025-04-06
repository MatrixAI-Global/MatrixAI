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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';
import LottieView from "lottie-react-native";

const { width, height } = Dimensions.get("window");

const CreateImagesScreen = ({ route, navigation }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const { message } = route.params; // Extract text from params
  const [imageUrl, setImageUrl] = useState(null); // Store the single selected image URL
  const [imageUrls, setImageUrls] = useState([]); // Store all fetched image URLs
  const [loading, setLoading] = useState(true); // Track loading state
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility state
  const [currentViewingImage, setCurrentViewingImage] = useState(null);
  
  // Animated values
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loadingDots = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(0.95)).current;

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
  }, [shimmerValue, pulseAnim, loadingDots]);

  useEffect(() => {
    const fetchAndStoreImages = async () => {
      try {
        const storedUrls = await AsyncStorage.getItem("downloadedImageUrls");
        if (storedUrls) {
          const urls = JSON.parse(storedUrls);
          setImageUrls(urls);
          setImageUrl(urls[0]); // Set the first image as the selected image
          setLoading(false);
          fadeInImage();
        } else {
          const response = await axios.post(
            "https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/generateImage2",
            { text: message, uid: "some-unique-id" },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY`,
              },
            }
          );

          if (response.data.images && response.data.images.length > 0) {
            const urls = response.data.images;
            await AsyncStorage.setItem("downloadedImageUrls", JSON.stringify(urls));
            setImageUrls(urls);
            setImageUrl(urls[0]); // Set the first image as the selected image
            setLoading(false);
            fadeInImage();
          }
        }
      } catch (error) {
        console.error("Error fetching images:", error);
      }
    };

    if (message) fetchAndStoreImages();

    return () => {
      AsyncStorage.removeItem("downloadedImageUrls");
    };
  }, [message]);

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

  const handleSelectImage = (url) => {
    setImageUrl(url);
    setModalVisible(false);
    
    // Animate the selected image scale
    Animated.sequence([
      Animated.timing(imageScale, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(imageScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleTryAgain = () => {
    setImageUrl(null);
    setLoading(true);
    setImageUrls([]);
    // Reset animation
    imageOpacity.setValue(0);
    imageScale.setValue(0.95);
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

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar barStyle="light-content" />
      
      <Animatable.View 
        animation="fadeIn" 
        duration={600} 
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
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
          <LinearGradient
            colors={[colors.card, colors.card + '80']}
            style={styles.promptBox}
          >
            <Text style={[styles.promptText, {color: colors.text}]}>{message}</Text>
          </LinearGradient>
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
            
            {renderSingleSkeleton()}
          </>
        ) : (
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
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
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
                onPress={() => openImageModal(imageUrl)}
              >
                <MaterialIcons name="fullscreen" size={18} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        {!loading && (
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
              <Text style={styles.tryAgainText}>Try Again</Text>
            </TouchableOpacity>
            
            {imageUrl && (
              <TouchableOpacity
                style={[styles.downloadButton]}
                onPress={() => Linking.openURL(imageUrl)}
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
                onPress={() => {
                  handleSelectImage(currentViewingImage);
                }}
              >
                <LinearGradient
                  colors={['#4F74FF', '#3B5FE3']}
                  style={styles.gradientButton}
                >
                  <MaterialIcons name="check" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Select Image</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => Linking.openURL(currentViewingImage)}
              >
                <LinearGradient
                  colors={['#4CAF50', '#3E9142']}
                  style={styles.gradientButton}
                >
                  <MaterialIcons name="file-download" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Download</Text>
                </LinearGradient>
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
    marginBottom: 4,
    letterSpacing: 1,
  },
  promptBox: {
    padding: 12,
    borderRadius: 12,
    minHeight: 60,
  },
  promptText: {
    fontSize: 16,
    color: '#E66902',
    fontWeight: '500',
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
  imageBorder: {
    width: '100%',
    height: '100%',
    padding: 2,
    borderRadius: 16,
  },
  imageSkeleton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    position: "relative",
    borderRadius: 16,
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
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
  },
  modalActionButton: {
    width: '80%',
    marginBottom: 10,
    borderRadius: 25,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  modalActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CreateImagesScreen;
