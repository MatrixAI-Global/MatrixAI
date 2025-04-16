import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const StoriesScreen = ({ navigation }) => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  
  // Sample video data - in a real app, this would come from an API or props
  const videos = [
    { 
      id: '1', 
      url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-walking-under-an-urban-bridge-40859-large.mp4',
      duration: 15000 // 15 seconds in milliseconds
    },
    { 
      id: '2', 
      url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-using-smartphone-at-night-cityscape-43823-large.mp4',
      duration: 15000 
    },
    { 
      id: '3', 
      url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-taking-a-selfie-in-the-city-2706-large.mp4',
      duration: 15000 
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);

  // Start progress animation for current story
  const startProgressAnimation = () => {
    // Reset progress animation
    progressAnim.setValue(0);
    
    // Stop any existing animation
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
    
    // Start new animation
    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: videos[currentIndex].duration,
      useNativeDriver: false
    });
    
    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        goToNextStory();
      }
    });
  };

  // Handle story navigation
  const goToNextStory = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Exit stories when we reach the end
      navigation.goBack();
    }
  };

  const goToPrevStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Reset and start progress when video changes
  useEffect(() => {
    setProgress(0);
    startProgressAnimation();
  }, [currentIndex]);

  // Handle video load errors
  const handleVideoError = (error) => {
    console.error("Video loading error:", error);
    // Optionally go to next story on error
    goToNextStory();
  };

  // Handle video progress
  const handleProgress = (data) => {
    setProgress(data.currentTime / (videos[currentIndex].duration / 1000));
  };

  // Handle screen press
  const handleScreenPress = (event) => {
    const screenWidth = Dimensions.get('window').width;
    const pressX = event.nativeEvent.locationX;

    if (pressX < screenWidth * 0.3) {
      // Left side press - go to previous
      goToPrevStory();
    } else if (pressX > screenWidth * 0.7) {
      // Right side press - go to next
      goToNextStory();
    } else {
      // Center press - pause/play
      setPaused(!paused);
      if (paused) {
        // Resume progress animation
        startProgressAnimation();
      } else {
        // Pause progress animation
        progressAnimation.current?.stop();
      }
    }
  };

  // Handle back button press
  const handleBackPress = () => {
    navigation.goBack();
  };

  // Render progress bars
  const renderProgressBars = () => {
    return (
      <View style={styles.progressContainer}>
        {videos.map((_, index) => {
          const isActive = index === currentIndex;
          
          return (
            <View key={index} style={styles.progressBarContainer}>
              {isActive ? (
                <Animated.View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      }),
                      backgroundColor: colors.primary 
                    }
                  ]}
                />
              ) : (
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: index < currentIndex ? '100%' : '0%',
                      backgroundColor: index < currentIndex ? colors.primary : colors.border
                    }
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="black" barStyle="light-content" />
      
      {/* Back button */}
      <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      
      {/* Progress bars */}
      {renderProgressBars()}

      {/* Video player */}
      <TouchableOpacity 
        activeOpacity={1}
        style={styles.videoContainer}
        onPress={handleScreenPress}
      >
        <Video
          ref={videoRef}
          source={{ uri: videos[currentIndex].url }}
          style={styles.video}
          resizeMode="cover"
          paused={paused}
          onError={handleVideoError}
          onProgress={handleProgress}
          repeat={false}
          bufferConfig={{
            minBufferMs: 5000,
            maxBufferMs: 10000,
            bufferForPlaybackMs: 1000,
            bufferForPlaybackAfterRebufferMs: 2000
          }}
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: height,
    position: 'absolute',
  },
  progressContainer: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
});

export default StoriesScreen; 