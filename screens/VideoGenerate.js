import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  PermissionsAndroid,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuthUser } from '../hooks/useAuthUser';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import Toast from 'react-native-toast-message';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('window');

const VideoGenerateScreen = () => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const [userText, setUserText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [transcription, setTranscription] = useState(
    'Start writing to generate Videos (eg: A cat and dog playing mobile)'
  );
  
  // Initialize animated values with useRef to prevent re-creation on re-renders
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const sendRotation = useRef(new Animated.Value(0)).current;
  const historySlideAnim = useRef(new Animated.Value(width)).current;
  
  const navigation = useNavigation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { uid, loading } = useAuthUser();
  const coinCount = useCoinsSubscription(uid);
  const [lowBalanceModalVisible, setLowBalanceModalVisible] = useState(false);
  const [requiredCoins, setRequiredCoins] = useState(0);
  
  // Video-specific state
  const [videoHistory, setVideoHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreVideos, setHasMoreVideos] = useState(false);
  const videosPerPage = 10;
  const [downloadingVideoId, setDownloadingVideoId] = useState(null);
  
  // Video preview modal state
  const [videoPreviewModalVisible, setVideoPreviewModalVisible] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewVideoTitle, setPreviewVideoTitle] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isDownloadingPreview, setIsDownloadingPreview] = useState(false);
  const [localVideoPath, setLocalVideoPath] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const videoRef = useRef(null);
  
  // Run animations on mount
  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(sendRotation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    ]).start();

    // Cleanup function to remove temporary files on unmount
    return () => {
      if (localVideoPath) {
        const filePath = localVideoPath.replace('file://', '');
        RNFS.exists(filePath).then(exists => {
          if (exists) {
            RNFS.unlink(filePath).catch(error => {
              console.log('Could not clean up video file on unmount:', error);
            });
          }
        });
      }
    };
  }, [fadeAnim, scaleAnim, sendRotation, localVideoPath]);
  
  // Fetch video history when history panel is opened
  useEffect(() => {
    if (historyOpen && uid) {
      fetchVideoHistory(1);
    }
  }, [historyOpen, uid]);

  const fetchVideoHistory = async (page = 1) => {
    if (!uid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://matrix-server.vercel.app/getAllVideos?uid=${uid}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch video history');
      }
      
      const result = await response.json();
      const newVideos = result.videos || [];
      
      if (page === 1) {
        setVideoHistory(newVideos);
      } else {
        setVideoHistory(prev => [...prev, ...newVideos]);
      }
      
      setHistoryPage(page);
      setHasMoreVideos(newVideos.length >= videosPerPage);
    } catch (err) {
      console.error('Error fetching video history:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreVideos = () => {
    if (!isLoading && hasMoreVideos) {
      fetchVideoHistory(historyPage + 1);
    }
  };
  
  const handleRemoveVideo = async (videoId) => {
    if (!uid || !videoId) return;
    
    try {
      Alert.alert(
        "Remove Video",
        "Are you sure you want to remove this video?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Remove",
            onPress: async () => {
              setIsLoading(true);
              // Note: You'll need to implement the remove video API endpoint
              const response = await fetch(
                'https://matrix-server.vercel.app/removeVideo',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    uid: uid,
                    videoId: videoId
                  })
                }
              );
              
              if (!response.ok) {
                throw new Error('Failed to remove video');
              }
              
              // Remove the video from the local state
              setVideoHistory(prev => prev.filter(video => video.videoId !== videoId));
              setIsLoading(false);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error removing video:', err);
      Alert.alert('Error', 'Failed to remove the video. Please try again.');
      setIsLoading(false);
    }
  };

  const toggleHistory = () => {
    // Toggle the history state
    setHistoryOpen(!historyOpen);
    
    // Animate the panel
    Animated.timing(historySlideAnim, {
      toValue: historyOpen ? width : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  };
  
  const handleSend = () => {
    if (userText.trim().length > 0) {
      setIsFinished(true); // Show buttons after sending the input
    }
  };

  const handleTryAgain = () => {
    setIsFinished(false); // Reset to show the input box again
    setUserText(''); // Clear the text input
    setTranscription(
      'Start writing to generate Videos (eg: A cat and dog playing mobile)'
    );
  };

  const handleGenerate = () => {
    // Check if user has enough coins (5) for Video Generate
    if (coinCount >= 25) {
      navigation.navigate('CreateVideoScreen', { message: transcription });
    } else {
      setRequiredCoins(25);
      setLowBalanceModalVisible(true);
    }
  };

  const navigateToSubscription = () => {
    setLowBalanceModalVisible(false);
    navigation.navigate('SubscriptionScreen');
  };

  const handleDownloadVideo = async (videoUrl, videoId) => {
    try {
      // Set downloading state
      setDownloadingVideoId(videoId);
      
      console.log('Starting video download for URL:', videoUrl);
      
      // Request storage permission (for Android)
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Matrix AI needs access to your storage to save videos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save video without storage permission',
            position: 'bottom',
          });
          setDownloadingVideoId(null);
          return;
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, request photo library permission (same as image download)
        const permission = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        if (permission !== RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save video without photo library permission',
            position: 'bottom',
          });
          setDownloadingVideoId(null);
          return;
        }
      }
      
      // Create appropriate filename
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'mp4';
      const newFilename = `matrix_ai_video_${Date.now()}.mp4`; // Always use .mp4 for iOS compatibility
      
      // Determine where to save the file based on platform
      const targetPath = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/${newFilename}`
        : `${RNFS.PicturesDirectoryPath}/${newFilename}`;
      
      console.log('Downloading to path:', targetPath);
      
      // Download the file
      const download = RNFS.downloadFile({
        fromUrl: videoUrl,
        toFile: targetPath,
        background: true,
        discretionary: true,
        progressDivider: 10,
        begin: (res) => {
          console.log('Download started, total size:', res.contentLength);
        },
        progress: (res) => {
          const progressPercent = (res.bytesWritten / res.contentLength) * 100;
          console.log(`Download progress: ${progressPercent.toFixed(2)}%`);
        }
      });
      
      // Wait for the download to complete
      const result = await download.promise;
      console.log('Download result:', result);
      
      if (result.statusCode === 200) {
        // For Android: Make the file visible in gallery
        if (Platform.OS === 'android') {
          Toast.show({
            type: 'success',
            text1: 'Download Complete',
            text2: 'Video has been saved to your gallery',
            position: 'bottom',
          });
          
          // Use the MediaScanner to refresh the gallery
          await RNFS.scanFile(targetPath);
        } else if (Platform.OS === 'ios') {
          // For iOS: Save to Camera Roll with enhanced error handling
          console.log('Starting iOS video save process...');
          
          // First verify the file exists
          const fileExists = await RNFS.exists(targetPath);
          console.log('File exists:', fileExists);
          if (!fileExists) {
            throw new Error('Downloaded file not found');
          }
          
          // Get file stats to verify it's not empty
          const fileStats = await RNFS.stat(targetPath);
          console.log('File stats:', fileStats);
          if (fileStats.size === 0) {
            throw new Error('Downloaded file is empty');
          }
          
          // Try to save to Photos without album specification (more reliable)
          try {
            await CameraRoll.save(`file://${targetPath}`, {
              type: 'video'
            });
            console.log('Video saved to Photos successfully');
            
            // Show toast notification
            Toast.show({
              type: 'success',
              text1: 'Download Complete',
              text2: 'Video has been saved to your Photos',
              position: 'bottom',
            });
            
            // Clean up the file from Documents directory after saving to Photos
            try {
              await RNFS.unlink(targetPath);
              console.log('Cleaned up temporary file');
            } catch (cleanupError) {
              console.log('Could not clean up temporary file:', cleanupError);
            }
          } catch (saveError) {
            console.error('Error saving to Photos:', saveError);
            // If saving to Photos fails, at least the file is downloaded
            Toast.show({
              type: 'info',
              text1: 'Download Complete',
              text2: 'Video downloaded but could not save to Photos. Check Files app.',
              position: 'bottom',
            });
          }
        }
      } else {
        throw new Error('Download failed with status code: ' + result.statusCode);
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: 'Could not save the video. Please try again.',
        position: 'bottom',
      });
    } finally {
      setDownloadingVideoId(null);
    }
  };
  
  const handleShareVideo = async (videoUrl) => {
    try {
      // Create a temporary path to save the video for sharing
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'mp4';
      const tempFilename = `matrix_ai_video_${Date.now()}.${extension}`;
      const tempFilePath = `${RNFS.TemporaryDirectoryPath}/${tempFilename}`;
      
      // Download the file to temporary location
      const download = RNFS.downloadFile({
        fromUrl: videoUrl,
        toFile: tempFilePath,
      });
      
      // Wait for download to complete
      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // Share the video
        const shareOptions = {
          title: 'Share Video',
          url: `file://${tempFilePath}`,
          type: `video/${extension}`,
          failOnCancel: false,
        };
        
        await Share.open(shareOptions);
        
        // Clean up the temporary file
        try {
          await RNFS.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      } else {
        throw new Error('Download failed with status code: ' + result.statusCode);
      }
    } catch (error) {
      console.error('Error sharing video:', error);
      if (error.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share the video. Please try again.');
      }
    }
  };

  const handleVideoPreview = async (videoUrl, promptText) => {
    try {
      setPreviewVideoUrl(videoUrl); // Store original URL for retry
      setPreviewVideoTitle(promptText);
      setVideoPreviewModalVisible(true);
      setIsDownloadingPreview(true);
      setDownloadProgress(0);
      setLocalVideoPath(null);
      setIsPreviewPlaying(false);

      // Create a unique filename for the video
      const filename = videoUrl.substring(videoUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'mp4';
      const tempFilename = `preview_video_${Date.now()}.${extension}`;
      const tempFilePath = `${RNFS.CachesDirectoryPath}/${tempFilename}`;

      console.log('Downloading video for preview:', videoUrl);
      console.log('Saving to:', tempFilePath);

      // Download the video with progress tracking
      const download = RNFS.downloadFile({
        fromUrl: videoUrl,
        toFile: tempFilePath,
        background: false,
        discretionary: false,
        progressDivider: 10,
        begin: (res) => {
          console.log('Preview download started, total size:', res.contentLength);
        },
        progress: (res) => {
          if (res.contentLength > 0) {
            const progressPercent = (res.bytesWritten / res.contentLength) * 100;
            setDownloadProgress(Math.round(progressPercent));
            console.log(`Preview download progress: ${progressPercent.toFixed(2)}%`);
          }
        }
      });

      // Wait for download to complete
      const result = await download.promise;
      console.log('Preview download result:', result);

      if (result.statusCode === 200) {
        // Verify file exists and has content
        const fileExists = await RNFS.exists(tempFilePath);
        if (fileExists) {
          const fileStats = await RNFS.stat(tempFilePath);
          if (fileStats.size > 0) {
            setLocalVideoPath(`file://${tempFilePath}`);
            setIsDownloadingPreview(false);
            setIsPreviewPlaying(true);
            console.log('Video ready for preview:', `file://${tempFilePath}`);
          } else {
            throw new Error('Downloaded file is empty');
          }
        } else {
          throw new Error('Downloaded file not found');
        }
      } else {
        throw new Error(`Download failed with status code: ${result.statusCode}`);
      }
    } catch (error) {
      console.error('Error downloading video for preview:', error);
      setIsDownloadingPreview(false);
      Toast.show({
        type: 'error',
        text1: 'Preview Error',
        text2: 'Failed to load video for preview. Please try again.',
        position: 'bottom',
      });
      // Don't close the modal, let user try again or close manually
    }
  };

  const closeVideoPreview = async () => {
    setVideoPreviewModalVisible(false);
    setIsPreviewPlaying(false);
    setIsDownloadingPreview(false);
    setPreviewVideoUrl(null);
    setPreviewVideoTitle('');
    setDownloadProgress(0);
    
    // Clean up the temporary file
    if (localVideoPath) {
      try {
        const filePath = localVideoPath.replace('file://', '');
        const fileExists = await RNFS.exists(filePath);
        if (fileExists) {
          await RNFS.unlink(filePath);
          console.log('Cleaned up preview video file');
        }
      } catch (error) {
        console.log('Could not clean up preview video file:', error);
      }
      setLocalVideoPath(null);
    }
  };

  const togglePreviewPlayback = () => {
    setIsPreviewPlaying(!isPreviewPlaying);
  };

  const handlePreviewVideoEnd = () => {
    setIsPreviewPlaying(false);
  };

  const renderHistoryItem = ({ item }) => (
    <View style={[styles.historyItem, {backgroundColor: colors.border}]}>
      <TouchableOpacity 
        style={[
          styles.videoThumbnail,
          item.isReady && styles.videoThumbnailReady
        ]}
        onPress={() => item.isReady && handleVideoPreview(item.videoUrl, item.promptText)}
        disabled={!item.isReady}
        activeOpacity={0.7}
      >
        <MaterialIcons 
          name="play-circle-filled" 
          size={40} 
          color={item.isReady ? colors.primary : colors.text} 
        />
        <Text style={[styles.videoDuration, {color: colors.text}]}>{item.size}</Text>
        {item.isReady && (
          <View style={styles.previewIndicator}>
            <MaterialIcons name="visibility" size={16} color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>
      <View style={[styles.historyItemContent, {backgroundColor: colors.border}]}>
        <Text style={[styles.historyDate, {color: colors.text}]}>
          {item.ageDisplay}
        </Text>
        <Text style={[styles.historyPrompt, {color: colors.text}]} numberOfLines={2}>
          {item.promptText}
        </Text>
        <Text style={[styles.videoStatus, {color: item.isReady ? '#4CAF50' : '#FF9800'}]}>
          {item.statusDisplay}
        </Text>
        <View style={styles.historyActions}>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleRemoveVideo(item.videoId)}
          >
            <MaterialIcons name="delete" size={20} color={colors.text} />
          </TouchableOpacity>
          {item.isReady && (
            <>
              <TouchableOpacity 
                style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
                onPress={() => handleDownloadVideo(item.videoUrl, item.videoId)}
                disabled={downloadingVideoId === item.videoId}
              >
                {downloadingVideoId === item.videoId ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <MaterialIcons name="file-download" size={20} color={colors.text} />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
                onPress={() => handleShareVideo(item.videoUrl)}
              >
                <MaterialIcons name="ios-share" size={20} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={{flex: 1}}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: colors.background}]}>
        {/* Header Animation */}
        <Animated.View style={[styles.header, { transform: [{ scale: scaleAnim }], backgroundColor: colors.background2}]}>
          <TouchableOpacity 
            style={[styles.backButton, {backgroundColor: colors.primary}]} 
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Matrix AI</Text>
          {!isFinished && (
            <TouchableOpacity 
              style={[styles.historyButton, {backgroundColor: colors.primary}]} 
              onPress={toggleHistory}
            >
              <MaterialIcons name="history" size={24} color={'#fff'} />
            </TouchableOpacity>
          )}
        </Animated.View>
        
        <Animated.View style={[styles.placeholderContainer, { opacity: fadeAnim }]}>
          <Image   
            source={require('../assets/matrix.png')}
            style={[styles.placeholderImage, {tintColor: colors.text}]}
          />
          <Text style={[styles.placeholderText, {color: colors.text}]}>Hi, Welcome to Matrix AI</Text>
          <Text style={[styles.placeholderText2, {color: colors.text}]}>What can I generate for you today?</Text>
        </Animated.View>
        
        <LottieView 
          source={require('../assets/image2.json')}
          autoPlay
          loop
          style={{width: '100%', height: 100, backgroundColor: 'transparent'}}
        />

        {/* Buttons */}
        {isFinished && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.generateButton, { backgroundColor: colors.primary }]} 
              onPress={handleGenerate}
            >
              <View style={styles.horizontalContent}>
                <View style={styles.generateContent}>
                  <Text style={styles.generateText}>Generate Video</Text>
                  <View style={styles.horizontalContent}>
                    <Text style={styles.coinText}>-25</Text>
                    <Image source={require('../assets/coin.png')} style={styles.coinIcon} />
                  </View>
                </View>
                <Image source={require('../assets/send2.png')} style={styles.icon} />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Input section with KeyboardAvoidingView properly implemented */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 10}
      >
        {!isFinished && (
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type your video prompt here..."
              placeholderTextColor="#999999"
              value={userText}
              onChangeText={(text) => {
                setUserText(text); // Update input
                setTranscription(text || 'Start writing to generate Videos (eg: A cat and dog playing mobile)');
              }}
            />
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={handleSend}
            >
              <Image
                source={require('../assets/send2.png')}
                style={[styles.sendIcon, {tintColor: '#FFFFFF'}]}
              />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* History Panel */}
      <Animated.View 
        style={[
          styles.historyPanel, 
          {
            transform: [{ translateX: historySlideAnim }],
            backgroundColor: colors.background2
          }
        ]}
      >
        <View style={styles.historyHeader}>
          <Text style={[styles.historyTitle, {color: colors.text}]}>Generation History</Text>
          <TouchableOpacity onPress={toggleHistory}>
            <Image 
              source={require('../assets/back.png')} 
              style={[styles.historyCloseIcon, {tintColor: colors.text}]} 
            />
          </TouchableOpacity>
        </View>
        
        {isLoading && historyPage === 1 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#007BFF" />
            <Text style={styles.loaderText}>Loading your videos...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, {color: colors.text}]}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchVideoHistory(1)}
            >
              <Text style={[styles.retryText, {color: colors.text}]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : videoHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No videos generated yet</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={videoHistory}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.videoId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
              onEndReached={loadMoreVideos}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                hasMoreVideos ? (
                  <TouchableOpacity 
                    style={styles.viewMoreButton}
                    onPress={loadMoreVideos}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={[styles.viewMoreText, {color: colors.text}]}>View More</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          </>
        )}
      </Animated.View>

      {/* Low Balance Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={lowBalanceModalVisible}
        onRequestClose={() => setLowBalanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, {backgroundColor: colors.background2}]}>
            <Image 
              source={require('../assets/coin.png')} 
              style={styles.modalCoinImage} 
            />
            <Text style={[styles.modalTitle, {color: colors.text}]}>Insufficient Balance</Text>
            <Text style={[styles.modalMessage, {color: colors.text}]}>
              You need {requiredCoins} coins to generate this video.
              Your current balance is {coinCount} coins.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setLowBalanceModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.rechargeButton]} 
                onPress={navigateToSubscription}
              >
                <Text style={styles.rechargeButtonText}>Recharge Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Video Preview Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={videoPreviewModalVisible}
        onRequestClose={closeVideoPreview}
      >
        <View style={styles.videoPreviewOverlay}>
          <View style={styles.videoPreviewContainer}>
            {/* Modal Header with Title */}
            <View style={styles.videoPreviewHeader}>
              <Text style={styles.videoPreviewTitle} numberOfLines={2}>
                {previewVideoTitle}
              </Text>
              <TouchableOpacity style={styles.videoPreviewCloseButton} onPress={closeVideoPreview}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Video Player Container */}
            <View style={styles.videoPlayerContainer}>
              {isDownloadingPreview ? (
                // Loading State
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#007BFF" />
                  <Text style={styles.loadingText}>Preparing video...</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${downloadProgress}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>{downloadProgress}%</Text>
                  </View>
                </View>
              ) : localVideoPath ? (
                // Video Player
                <Video
                  ref={videoRef}
                  source={{ uri: localVideoPath }}
                  style={styles.videoPreview}
                  controls={true}
                  paused={!isPreviewPlaying}
                  resizeMode="contain"
                  repeat={false}
                  onEnd={handlePreviewVideoEnd}
                  onLoad={(data) => {
                    console.log('Video loaded successfully:', data);
                  }}
                  onError={(error) => {
                    console.error('Video playback error:', error);
                    Toast.show({
                      type: 'error',
                      text1: 'Playback Error',
                      text2: 'Failed to play video. Please try again.',
                      position: 'bottom',
                    });
                  }}
                  onBuffer={({ isBuffering }) => {
                    console.log('Video buffering:', isBuffering);
                  }}
                />
              ) : (
                // Error State
                <View style={styles.errorStateContainer}>
                  <MaterialIcons name="error-outline" size={48} color="#ff6b6b" />
                  <Text style={styles.errorStateText}>Failed to load video</Text>
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => handleVideoPreview(previewVideoUrl, previewVideoTitle)}
                  >
                    <Text style={styles.retryButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingRight: 10,
  },
  headerTitle:{
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  historyButton: {
    padding: 8,
    borderRadius: 20,
  },
  placeholderContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  placeholderImage: { 
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  placeholderText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText2: {
    fontSize: 14,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    margin: 10,
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
  },
  keyboardAvoidView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  sendButton: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 25,
    marginLeft: 10,
  },
  sendIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
    resizeMode: 'contain',
  },
  horizontalContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 16,
    height: 16,
    tintColor:'#fff',
    marginLeft:10,
  },
  generateContent: {
    alignItems: 'center',
  },
  generateText: {
    fontSize: 16,
    color: '#fff',
  },
  coinIcon: {
    width: 12,
    height: 12,
    marginTop: 2,
  },
  coinText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 2,
  },
  generateButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  // History panel styles
  historyPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '70%',
    height: '100%',
    backgroundColor: '#1E1E2E',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginTop: 40,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  historyCloseIcon: {
    width: 24,
    height: 24,
    transform: [{rotate: '180deg'}],
  },
  historyList: {
    padding: 15,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
  },
  videoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoThumbnailReady: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    fontSize: 10,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  historyDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  historyPrompt: {
    color: '#fff',
    fontSize: 14,
    marginVertical: 4,
  },
  videoStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  historyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  historyActionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loaderText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007BFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
  },
  viewMoreButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  viewMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalCoinImage: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  rechargeButton: {
    backgroundColor: '#007BFF',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '500',
  },
  rechargeButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  videoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPreviewContainer: {
    width: '95%',
    height: '85%',
    backgroundColor: '#000',
    borderRadius: 15,
    overflow: 'hidden',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  videoPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  videoPreviewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  videoPreviewCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  videoPlayerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  previewIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 2,
    borderRadius: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    flex: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007BFF',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    marginLeft: 15,
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 40,
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorStateText: {
    color: '#ff6b6b',
    marginBottom: 15,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default VideoGenerateScreen;
