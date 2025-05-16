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
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Alert,
  ToastAndroid,
  PermissionsAndroid,
  Modal
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
const { width, height } = Dimensions.get('window');

const ImageGenerateScreen = () => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const [userText, setUserText] = useState('');
  const [isFinished, setIsFinished] = useState(false);
  const [transcription, setTranscription] = useState(
    'Start writing to generate Images (eg: generate tree with red apples)'
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
  
  // Replace mock data with actual state
  const [imageHistory, setImageHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const imagesPerPage = 10;
  const [downloadingImageId, setDownloadingImageId] = useState(null);
  
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
  }, [fadeAnim, scaleAnim, sendRotation]);
  
  // Fetch image history when history panel is opened
  useEffect(() => {
    if (historyOpen && uid) {
      fetchImageHistory(1);
    }
  }, [historyOpen, uid]);

  const fetchImageHistory = async (page = 1) => {
    if (!uid) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://matrix-server.vercel.app/getGeneratedImage?uid=${uid}&page=${page}&limit=${imagesPerPage}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch image history');
      }
      
      const result = await response.json();
      const newImages = result.data || [];
      
      if (page === 1) {
        setImageHistory(newImages);
      } else {
        setImageHistory(prev => [...prev, ...newImages]);
      }
      
      setHistoryPage(page);
      setHasMoreImages(newImages.length >= imagesPerPage);
    } catch (err) {
      console.error('Error fetching image history:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreImages = () => {
    if (!isLoading && hasMoreImages) {
      fetchImageHistory(historyPage + 1);
    }
  };
  
  const handleRemoveImage = async (imageId) => {
    if (!uid || !imageId) return;
    
    try {
      Alert.alert(
        "Remove Image",
        "Are you sure you want to remove this image?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Remove",
            onPress: async () => {
              setIsLoading(true);
              const response = await fetch(
                'https://matrix-server.vercel.app/removeImage',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    uid: uid,
                    image_id: imageId
                  })
                }
              );
              
              if (!response.ok) {
                throw new Error('Failed to remove image');
              }
              
              // Remove the image from the local state
              setImageHistory(prev => prev.filter(img => img.image_id !== imageId));
              setIsLoading(false);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error removing image:', err);
      Alert.alert('Error', 'Failed to remove the image. Please try again.');
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
      'Start writing to generate Images (eg: generate tree with red apples)'
    );
  };

  const handleGenerate = () => {
    // Check if user has enough coins (3) for Generate I
    if (coinCount >= 3) {
      navigation.navigate('CreateImageScreen', { message: transcription });
    } else {
      setRequiredCoins(3);
      setLowBalanceModalVisible(true);
    }
  };
  
  const handleGenerate2 = () => {
    // Check if user has enough coins (12) for Generate IV
    if (coinCount >= 12) {
      navigation.navigate('CreateImageScreen2', { message: transcription });
    } else {
      setRequiredCoins(12);
      setLowBalanceModalVisible(true);
    }
  };

  const navigateToSubscription = () => {
    setLowBalanceModalVisible(false);
    navigation.navigate('SubscriptionScreen');
  };

  const handleDownloadImage = async (imageUrl, imageId) => {
    try {
      // Set downloading state
      setDownloadingImageId(imageId);
      
      // Request storage permission (for Android)
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Matrix AI needs access to your storage to save images.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save image without storage permission',
            position: 'bottom',
          });
          setDownloadingImageId(null);
          return;
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, request photo library permission
        const permission = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
        if (permission !== RESULTS.GRANTED) {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Cannot save image without photo library permission',
            position: 'bottom',
          });
          setDownloadingImageId(null);
          return;
        }
      }
      
      // Create appropriate filename
      const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'jpg';
      const newFilename = `matrix_ai_image_${Date.now()}.${extension}`;
      
      // Determine where to save the file based on platform
      const targetPath = Platform.OS === 'ios' 
        ? `${RNFS.DocumentDirectoryPath}/${newFilename}`
        : `${RNFS.PicturesDirectoryPath}/${newFilename}`;
      
      // Download the file
      const download = RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: targetPath,
        background: true,
        discretionary: true,
      });
      
      // Wait for the download to complete
      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // For Android: Make the file visible in gallery
        if (Platform.OS === 'android') {
          // Use ToastAndroid for native toast on Android
          ToastAndroid.show('Image saved to gallery', ToastAndroid.SHORT);
          
          // Use the MediaScanner to refresh the gallery
          await RNFS.scanFile(targetPath);
        } else if (Platform.OS === 'ios') {
          // For iOS: Save to Camera Roll
          await CameraRoll.save(`file://${targetPath}`, {
            type: 'photo',
            album: 'MatrixAI'
          });
          
          // Show toast notification
          Toast.show({
            type: 'success',
            text1: 'Download Complete',
            text2: 'Image has been saved to your Photos',
            position: 'bottom',
          });
        }
      } else {
        throw new Error('Download failed with status code: ' + result.statusCode);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: 'Could not save the image. Please try again.',
        position: 'bottom',
      });
    } finally {
      setDownloadingImageId(null);
    }
  };
  
  const handleShareImage = async (imageUrl) => {
    try {
      // Create a temporary path to save the image for sharing
      const filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop() || 'jpg';
      const tempFilename = `matrix_ai_image_${Date.now()}.${extension}`;
      const tempFilePath = `${RNFS.TemporaryDirectoryPath}/${tempFilename}`;
      
      // Download the file to temporary location
      const download = RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: tempFilePath,
      });
      
      // Wait for download to complete
      const result = await download.promise;
      
      if (result.statusCode === 200) {
        // Share the image
        const shareOptions = {
          title: 'Share Image',
          url: `file://${tempFilePath}`,
          type: `image/${extension}`,
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
      console.error('Error sharing image:', error);
      if (error.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share the image. Please try again.');
      }
    }
  };

  const renderHistoryItem = ({ item }) => (
    <View style={[styles.historyItem, {backgroundColor: colors.border}]}>
      <Image 
        source={{ uri: item.image_url }} 
        style={styles.historyImage}
        resizeMode="cover"
      />
      <View style={[styles.historyItemContent, {backgroundColor: colors.border}]}>
        <Text style={[styles.historyDate, {color: colors.text}]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text style={[styles.historyPrompt, {color: colors.text}]} numberOfLines={2}>
          {item.prompt_text}
        </Text>
        <View style={styles.historyActions}>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleRemoveImage(item.image_id)}
          >
            <MaterialIcons name="delete" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleDownloadImage(item.image_url, item.image_id)}
            disabled={downloadingImageId === item.image_id}
          >
            {downloadingImageId === item.image_id ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <MaterialIcons name="file-download" size={20} color={colors.text} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.historyActionButton, {backgroundColor: colors.background2}]}
            onPress={() => handleShareImage(item.image_url)}
          >
            <MaterialIcons name="ios-share" size={20} color={colors.text} />
          </TouchableOpacity>
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
                  <Text style={styles.generateText}>Generate I</Text>
                  <View style={styles.horizontalContent}>
                    <Text style={styles.coinText}>-3</Text>
                    <Image source={require('../assets/coin.png')} style={styles.coinIcon} />
                  </View>
                </View>
                <Image source={require('../assets/send2.png')} style={styles.icon} />
              </View>
            </TouchableOpacity>
          
            <TouchableOpacity 
              style={[styles.generateButton, { backgroundColor: colors.secondary }]} 
              onPress={handleGenerate2}
            >
              <View style={styles.horizontalContent}>
                <View style={styles.generateContent}>
                  <Text style={styles.generateText}>Generate IV</Text>
                  <View style={styles.horizontalContent}>
                    <Text style={styles.coinText}>-12</Text>
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
              placeholder="Type your prompt here..."
              placeholderTextColor="#999999"
              value={userText}
              onChangeText={(text) => {
                setUserText(text); // Update input
                setTranscription(text || 'Start writing to generate Images (eg: generate tree with red apples)');
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
            <Text style={styles.loaderText}>Loading your images...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, {color: colors.text}]}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchImageHistory(1)}
            >
              <Text style={[styles.retryText, {color: colors.text}]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : imageHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No images generated yet</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={imageHistory}
              renderItem={renderHistoryItem}
              keyExtractor={item => item.image_id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
              onEndReached={loadMoreImages}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                hasMoreImages ? (
                  <TouchableOpacity 
                    style={styles.viewMoreButton}
                    onPress={loadMoreImages}
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
              You need {requiredCoins} coins to generate this image.
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
    justifyContent: 'space-between',
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
  icon2: {
    width: 16,
    height: 16,
    tintColor:'#333',
    marginRight: 5,
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
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  tryAgainButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  tryAgainText: {
    color: '#000000',
    fontSize: 16,
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
  generateButton2: {
    backgroundColor: '#FF6600FF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginHorizontal: 10,
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
  historyImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
  historyActionIcon: {
    width: 16,
    height: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
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
});

export default ImageGenerateScreen;
