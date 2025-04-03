import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
  StatusBar,
  Easing,
  Linking,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import LinearGradient from 'react-native-linear-gradient';
import * as Animatable from 'react-native-animatable';

const { width, height } = Dimensions.get("window");

const CreateImagesScreen2 = ({ route, navigation }) => {
  const { message } = route.params; // Extract text from params
  const [imageUrl, setImageUrl] = useState(null); // Store the downloaded image URL
  const [loading, setLoading] = useState(true); // Track loading state
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const [selectedImage, setSelectedImage] = useState(null);
  const [gridImages, setGridImages] = useState([null, null, null, null]);

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
    const fetchAndStoreImage = async () => {
      try {
        const storedUrl = await AsyncStorage.getItem("downloadedImageUrl");
        if (storedUrl) {
          const url = storedUrl;
          setImageUrl(url);
          // Create a grid of 4 images using the same URL
          setGridImages([url, url, url, url]);
          setLoading(false);
          fadeInImage();
        } else {
          const response = await axios.post(
            "https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/generateImage",
            { text: message, uid: "some-unique-id" },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkdGdkaGVoeGhnYXJrb252cGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ2Njg4MTIsImV4cCI6MjA1MDI0NDgxMn0.mY8nx-lKrNXjJxHU7eEja3-fTSELQotOP4aZbxvmNPY`,
              },
            }
          );

          if (response.data.images && response.data.images.length > 0) {
            const url = response.data.images[0];
            await AsyncStorage.setItem("downloadedImageUrl", url);
            setImageUrl(url);
            // Create a grid of 4 images using the same URL
            setGridImages([url, url, url, url]);
            setLoading(false);
            fadeInImage();
          }
        }
      } catch (error) {
        console.error("Error fetching image:", error);
      }
    };

    if (message) fetchAndStoreImage();

    return () => {
      AsyncStorage.removeItem("downloadedImageUrl");
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
    setSelectedImage(url);
  };

  const handleTryAgain = () => {
    setLoading(true);
    setImageUrl(null);
    setSelectedImage(null);
    setGridImages([null, null, null, null]);
    // Reset animations
    imageOpacity.setValue(0);
    imageScale.setValue(0.95);
  };

  // Create shimmer interpolation
  const shimmerTranslate = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  // Determine loading text with animated dots
  const loadingText = `Creating${'.'.repeat(loadingDots.__getValue())}`;

  const renderSkeletonGrid = () => (
    <View style={styles.gridContainer}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={styles.imageBox}>
          <View style={styles.imageSkeleton}>
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
          {loading ? "AI Image Generation" : "AI Generated Images"}
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
                  <ActivityIndicator size="large" color="#fff" />
                </Animated.View>
              </View>
              <Text style={[styles.loadingText, {color: colors.text}]}>{loadingText}</Text>
              <Text style={[styles.subtext, {color: colors.text}]}>
                Please don't leave this screen while images are being generated
              </Text>
            </Animatable.View>
            
            {renderSkeletonGrid()}
          </>
        ) : (
          <Animated.View 
            style={[
              styles.gridContainer, 
              { opacity: imageOpacity }
            ]}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.imageBox,
                  selectedImage === gridImages[index] && styles.selectedBox,
                  selectedImage === gridImages[index] && { transform: [{ scale: imageScale }] }
                ]}
                onPress={() => gridImages[index] && handleSelectImage(gridImages[index])}
                disabled={!gridImages[index]}
                activeOpacity={0.7}
              >
                {gridImages[index] ? (
                  <React.Fragment>
                    <Image
                      source={{ uri: gridImages[index] }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                    {selectedImage === gridImages[index] && (
                      <View style={styles.selectedOverlay}>
                        <MaterialIcons name="check-circle" size={28} color="#fff" />
                      </View>
                    )}
                  </React.Fragment>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <MaterialIcons name="image-not-supported" size={32} color="#555" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
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
            
            {selectedImage && (
              <TouchableOpacity
                style={[styles.downloadButton]}
                onPress={() => Linking.openURL(selectedImage)}
              >
                <MaterialIcons name="file-download" size={20} color="#fff" />
                <Text style={styles.downloadText}>Download</Text>
              </TouchableOpacity>
            )}
          </Animatable.View>
        )}
      </ScrollView>
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
    paddingHorizontal: 20,
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
    backgroundColor: 'rgba(0, 123, 255, 0.3)',
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
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 16,
  },
  imageBox: {
    width: width * 0.43,
    height: width * 0.43,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  imageSkeleton: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2A2A2A",
    overflow: "hidden",
    position: "relative",
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
  },
  selectedBox: {
    borderWidth: 3,
    borderColor: "#4F74FF",
  },
  selectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(79, 116, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default CreateImagesScreen2;
