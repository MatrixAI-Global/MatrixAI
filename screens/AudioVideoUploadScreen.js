import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    TextInput,
    Image,
    ActivityIndicator,
    Modal,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DocumentPicker from 'react-native-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';  // Import react-native-fs to read files
import axios from 'axios';
import { Buffer } from 'buffer';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler'; 
import Share from 'react-native-share'; // Add for file sharing
import { Button, Alert } from 'react-native';
import { supabase } from '../supabaseClient'; 
import { Picker } from '@react-native-picker/picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Sound from 'react-native-sound';
import { useAuthUser } from '../hooks/useAuthUser';

 // Add this import if not present

const audioIcon = require('../assets/mic3.png');
const videoIcon = require('../assets/cliper.png');
const backIcon = require('../assets/back.png');
const uploadIcon = require('../assets/Import.png');
const resizeIcon = require('../assets/cliper.png');
const helpIcon = require('../assets/threeDot.png');
const helpIcon2 = require('../assets/mic2.png');
const Translate = require('../assets/right-up.png');
const coin = require('../assets/coin.png');
const micIcon = require('../assets/mic3.png');
const micIcon2 = require('../assets/Translate.png');
const clockIcon = require('../assets/clock.png');
const calendarIcon = require('../assets/calender.png');
const emptyIcon = require('../assets/empty.png');

// Custom Toast Component
const CustomToast = ({ visible, title, message, onHide }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        if (visible) {
            // Fade in
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
            
            // Auto hide after 3 seconds
            const timer = setTimeout(() => {
                onHide();
            }, 1000);
            
            return () => clearTimeout(timer);
        } else {
            // Fade out
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, fadeAnim, onHide]);
    
    if (!visible) return null;
    
    return (
        <Animated.View 
            style={[
                styles.toastContainer, 
                { opacity: fadeAnim }
            ]}
        >
            <View style={styles.toastContent}>
                <Text style={styles.toastTitle}>{title}</Text>
                <Text style={styles.toastMessage}>{message}</Text>
            </View>
        </Animated.View>
    );
};

const AudioVideoUploadScreen = () => {
    const navigation = useNavigation();
    const [files, setFiles] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false); // Add loading state
   
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [isFilterMode, setIsFilterMode] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('en-US');
    const [audioFile, setAudioFile] = useState(null);
    const [uploading, setUploading] = useState(false); // For upload indicator
   
    const [duration, setDuration] = useState(null);
    const audioRecorderPlayer = new AudioRecorderPlayer();
    const [popupVisible, setPopupVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [newFileName, setNewFileName] = useState('');
    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [uploadData, setUploadData] = useState(null);
    const { uid, loading } = useAuthUser();
    const [languages, setLanguages] = useState([
  
       
            { label: 'Cantonese', value: 'zh-HK' },
            { label: 'Chinese Traditional', value: 'zh-TW' },
            { label: 'English (UK)', value: 'en-GB' },
            { label: 'English (US)', value: 'en-US' },
            { label: 'French', value: 'fr' },
            { label: 'German', value: 'de' },
            { label: 'Hindi', value: 'hi' },
            { label: 'Japanese', value: 'ja' },
            { label: 'Mandarin', value: 'zh-CN' },
            { label: 'Spanish', value: 'es' }
        
    ]);
    const [loadingAudioIds, setLoadingAudioIds] = useState(new Set()); // Track loading audio IDs
    console.log(uid,'UID');
    // Custom toast state
    const [toastVisible, setToastVisible] = useState(false);
    const [toastTitle, setToastTitle] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('default');
    const fadeAnim = useRef(new Animated.Value(0)).current;
    
    // Function to show custom toast
    const showCustomToast = (title, message, type = 'default') => {
        setToastTitle(title);
        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);
        
        // Animate fade in
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
        
        // Auto hide toast after 3 seconds
        setTimeout(() => {
            hideCustomToast();
        }, 1000);
    };
    
    // Function to hide custom toast
    const hideCustomToast = () => {
        // Animate fade out
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setToastVisible(false);
        });
    };

    // Function to generate a secure random audio ID
    const generateAudioID = () => {
        // Generate a random string using timestamp and Math.random
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substring(2, 15);
        return `${timestamp}-${randomStr}-${Math.random().toString(36).substring(2, 15)}`;
    };

    useFocusEffect(
        React.useCallback(() => {
            loadFiles(false); // Pass false to indicate it's not a forced refresh
        }, [])
    );

    // Function to save files to local storage
    const saveFilesToLocalStorage = async (filesData) => {
        try {
            await AsyncStorage.setItem(`audio_files_${uid}`, JSON.stringify(filesData));
            console.log('Files saved to local storage');
        } catch (error) {
            console.error('Error saving files to local storage:', error);
        }
    };

    // Function to get files from local storage
    const getFilesFromLocalStorage = async () => {
        try {
            const storedFiles = await AsyncStorage.getItem(`audio_files_${uid}`);
            return storedFiles ? JSON.parse(storedFiles) : null;
        } catch (error) {
            console.error('Error getting files from local storage:', error);
            return null;
        }
    };

    const loadFiles = async (forceRefresh = false) => {
        setIsLoading(true); // Start loading
        
        try {
            // If not forcing a refresh, try to get data from local storage first
            if (!forceRefresh) {
                const cachedFiles = await getFilesFromLocalStorage();
                if (cachedFiles && cachedFiles.length > 0) {
                    console.log('Using cached files from local storage');
                    setFiles(cachedFiles);
                    setIsLoading(false);
                    return;
                }
            }
            
            // If forcing refresh or no cached data, fetch from API
            const response = await fetch(`https://matrix-server.vercel.app/getAudio/${uid}`);
            
            // Check response content type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.log('Non-JSON response received');
                setFiles([]); // Set empty files array
                setIsLoading(false); // Stop loading
                return;
            }

            const data = await response.json();
            
            if (response.ok) {
                // Sort files by uploaded_at in descending order (newest first)
                const sortedFiles = (data.audioData || []).sort((a, b) => 
                    new Date(b.uploaded_at) - new Date(a.uploaded_at)
                );
                setFiles(sortedFiles);
                
                // Save to local storage for future use
                await saveFilesToLocalStorage(sortedFiles);
            } else {
                console.log('Error fetching audio:', data.error);
                setFiles([]); // Set empty files array
            }
        } catch (error) {
            console.log('Error fetching audio:', error);
            setFiles([]); // Set empty files array
        } finally {
            setIsLoading(false); // Stop loading
        }
    };

    // Refresh files after modifications - force refresh from API
    const refreshFiles = async () => {
        await loadFiles(true);
    };

    useEffect(() => {
        // Refresh files when edit modal closes
        if (!editModalVisible) {
            refreshFiles();
        }
    }, [editModalVisible]);

    const getFilteredFiles = () => {
        if (!files || files.length === 0) {
            return [];
        }
        if (!searchQuery) {
            return files;
        }
        return files.filter(file => {
            const fileName = file.audio_name?.toLowerCase() || '';
            const searchTerm = searchQuery.toLowerCase();
            return fileName.includes(searchTerm);
        });
    };

    const getAudioDuration = async (uri) => {
        return new Promise((resolve) => {
            try {
                // First try to estimate duration based on file size
                // This is a fallback method that works for most audio files
                const estimateDurationFromSize = async () => {
                    try {
                        // Check if the URI is valid and accessible
                        const exists = await RNFS.exists(uri);
                        if (!exists) {
                            console.log('File does not exist at path:', uri);
                            return 60; // Default duration if file doesn't exist
                        }
                        
                        // Get file stats to determine size
                        const stats = await RNFS.stat(uri);
                        if (stats && stats.size) {
                            // Estimate duration based on file size
                            // Assuming average bitrate of 128kbps for MP3 files
                            const estimatedDuration = Math.round(stats.size / (128 * 1024 / 8));
                            // Cap at reasonable values between 30 seconds and 10 minutes
                            return Math.min(Math.max(estimatedDuration, 30), 600);
                        }
                    } catch (err) {
                        console.log('Error getting file stats:', err);
                    }
                    // Default duration if estimation fails
                    return 60;
                };
                
                // For iOS, try using Sound but with better error handling
                if (Platform.OS === 'ios') {
                    // Set a timeout to prevent hanging if Sound initialization takes too long
                    const timeoutPromise = new Promise(resolve => {
                        setTimeout(() => resolve(null), 1000); // 3 second timeout
                    });
                    
                    const soundPromise = new Promise(resolve => {
                        const sound = new Sound(uri, '', (error) => {
                            if (error) {
                                console.log('Error loading audio with Sound:', error);
                                resolve(null);
                            } else {
                                const durationInSeconds = sound.getDuration();
                                sound.release();
                                if (durationInSeconds > 0) {
                                    resolve(Math.round(durationInSeconds));
                                } else {
                                    resolve(null);
                                }
                            }
                        });
                    });
                    
                    // Race between timeout and sound initialization
                    Promise.race([soundPromise, timeoutPromise])
                        .then(async (duration) => {
                            if (duration) {
                                resolve(duration);
                            } else {
                                // Fall back to size-based estimation if Sound fails
                                const estimatedDuration = await estimateDurationFromSize();
                                resolve(estimatedDuration);
                            }
                        });
                } else {
                    // For Android, use size-based estimation directly
                    estimateDurationFromSize().then(resolve);
                }
            } catch (err) {
                console.error('Unhandled error in getAudioDuration:', err);
                // Default to a reasonable duration if there's an exception
                resolve(60);
            }
        });
    };

    const handleFileSelect = async () => {
        try {
            const res = await DocumentPicker.pick({
                type: [DocumentPicker.types.audio],
            });
    
            if (res && res[0]) {
                setAudioFile(res[0]);
                
                // Show loading indicator while calculating duration
                setUploading(true);
                
                try {
                    // Get duration with improved error handling
                    const durationInSeconds = await getAudioDuration(res[0].uri);
                    setDuration(durationInSeconds);
                    console.log('Calculated audio duration:', durationInSeconds);
                } catch (durationError) {
                    console.error('Error getting duration:', durationError);
                    // Set a default duration if we can't determine it
                    setDuration(60);
                } finally {
                    setUploading(false);
                    setPopupVisible(true); // Show popup after file selection
                }
            }
        } catch (err) {
            setUploading(false);
            if (DocumentPicker.isCancel(err)) {
                console.log('User cancelled file picker.');
            } else {
                console.error('Error picking file:', err);
                Alert.alert('Error', 'An error occurred while picking the file.');
            }
        }
    };
    
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

    const validateFile = (file) => {
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
        return true;
    };

    const checkUserCoins = async (uid, requiredCoins) => {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("user_coins")
                .eq("uid", uid)
                .single();

            if (error) {
                console.error('Error checking user coins:', error);
                return false;
            }

            if (!data || data.user_coins < requiredCoins) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in checkUserCoins:', error);
            return false;
        }
    };

    const handleUpload = async (file, duration) => {
        if (!file) {
            Alert.alert('Error', 'No file selected');
            return;
        }
        
        // Check if user has enough coins
        const hasEnoughCoins = await checkUserCoins(uid, duration);
        
        if (!hasEnoughCoins) {
            setUploading(false);
            setPopupVisible(false);
            Alert.alert(
                'Insufficient Coins',
                'You don\'t have enough coins to process this audio. Please recharge.',
                [
                    {
                        text: 'Recharge Now',
                        onPress: () => navigation.navigate('TransactionScreen')
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel'
                    }
                ]
            );
            return;
        }
        
        setUploading(true);

        try {
            // Verify file exists before proceeding
            const fileExists = await RNFS.exists(file.uri);
            if (!fileExists) {
                throw new Error(`File does not exist at path: ${file.uri}`);
            }

            // Generate a secure unique ID for the audio file
            const audioID = generateAudioID();
            const audioName = file.name || `audio_${Date.now()}.mp3`;
            const fileExtension = audioName.split('.').pop();
            
            // Create file path for Supabase storage
            const filePath = `users/${uid}/audioFile/${audioID}.${fileExtension}`;
            
            // Read the file as base64
            const fileContent = await RNFS.readFile(file.uri, 'base64');
            
            // Upload to Supabase storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('user-uploads')
                .upload(filePath, decode(fileContent), {
                    contentType: file.type || 'audio/mpeg',
                    upsert: false
                });
                
            if (uploadError) {
                throw new Error(`Upload error: ${uploadError.message}`);
            }
            
            // Get the public URL for the uploaded file
            const { data: { publicUrl } } = supabase.storage
                .from('user-uploads')
                .getPublicUrl(filePath);
                
            // Save metadata to database - provide the audioid since the database requires it
            const { data: metadataData, error: metadataError } = await supabase
                .from('audio_metadata')
                .insert([
                    {
                        uid,
                        audioid: audioID, // Use the secure generated audioID
                        audio_name: audioName,
                        language: selectedLanguage,
                        audio_url: publicUrl,
                        file_path: filePath,
                        duration: parseInt(duration, 10),
                        uploaded_at: new Date().toISOString(),
                    }
                ]);
                
            if (metadataError) {
                throw new Error(`Metadata error: ${metadataError.message}`);
            }
            
            // Success handling
            setUploadData({
                audioID,
                publicUrl,
                audioName
            });
            
            // Force refresh from API to get the latest data
            await refreshFiles();
            
            // Custom toast implementation
            showCustomToast('Import Complete', 'Your file has been imported successfully.', 'success');

            setUploading(false);
            setPopupVisible(false);
            
            // Add a longer delay before navigating to ensure the toast is visible for at least a moment
            const navigateToTranslation = () => {
                // Navigate to translation screen with the generated audioid
                handlePress({ audioid: audioID });
            };
            
            setTimeout(navigateToTranslation, 1500);
            
        } catch (error) {
            console.error('Upload error details:', {
                message: error.message,
                file: file ? {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    uri: file.uri
                } : 'No file'
            });
            
            // Show error toast
            showCustomToast('Upload Failed', 'There was a problem uploading your file.', 'error');
            
            Alert.alert(
                'Error',
                'Failed to upload file. Please try again.'
            );
            setUploadData(null);
        } finally {
            setUploading(false);
        }
    };
    
    const handlePress = async ({ audioid }) => {
        try {
            setLoadingAudioIds(prev => new Set(prev).add(audioid)); // Set loading for this audioid
            console.log('audioid:', audioid, 'uid:', uid);
            console.log('Types:', typeof audioid, typeof uid);
    
            // Create a proper JSON object for the request body
            const requestBody = JSON.stringify({
                uid: String(uid),
                audioid: String(audioid)
            });

            console.log('Request body:', requestBody);

            const response = await fetch('https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/convertAudio', {
                method: 'POST',
                headers: { 
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: requestBody
            });

            // Log the raw response for debugging
            const responseText = await response.text();
            console.log('Raw response:', responseText);

            // Parse the response text as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Error parsing response:', parseError);
                Alert.alert('Error', 'Invalid response from server. Please try again later.');
                return;
            }

            if (response.ok && data.message === "Transcription completed and saved") {
                navigation.navigate('TranslateScreen2', {
                    uid,
                    audioid,
                    transcription: data.transcription,
                    audio_url: data.audio_url
                });
            } else {
                console.error('API Error:', data);
                Alert.alert('Error', `Failed to process audio: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Network Error:', error);
            Alert.alert('Error', 'Network error occurred. Please check your connection.');
        } finally {
            setLoadingAudioIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(audioid); // Remove loading for this audioid
                return newSet;
            });
        }
    };
    
    const handleClosePopup = () => {
        setPopupVisible(false); // Close popup
    };

    const handlePress2 = async (item) => {
       
            navigation.navigate('TranslateScreen2', {
                uid,
                audioid: item.audioid, // Use item.audioid if audioid doesn't exist
            });
    };
    


    const handleRemoveFile = async (audioid) => {
        console.log(audioid,uid);
        
        if (!uid || !audioid) {
            console.error('Error: UID and audioid are required');
            Alert.alert('Error', 'UID and audio ID are required to delete the file.');
            return;
        }
    
        try {
            console.log('Deleting file with UID:', uid, 'and AudioID:', audioid); // Debug log
    
            const response = await fetch('https://matrix-server.vercel.app/removeAudio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: uid,  // User's UID
                    audioid: audioid,  // File's unique ID
                }),
            });
    
            const data = await response.json();
    
            if (response.ok) {
                console.log('File deleted successfully:', data); // Debug log
    
                // Update local state after deletion
                const updatedFiles = files.filter((file) => file.audioid !== audioid);
                setFiles(updatedFiles);
                
                // Update local storage with the updated files
                await saveFilesToLocalStorage(updatedFiles);
                
                // Show success toast
                showCustomToast('Success', 'File deleted successfully.', 'success');
            } else {
                console.error('Error deleting audio:', data.error);
                showCustomToast('Error', data.error || 'Failed to delete the audio file.', 'error');
            }
        } catch (error) {
            console.error('Error deleting audio:', error);
            showCustomToast('Error', 'An error occurred while deleting the audio file.', 'error');
        }
    };


    
  
    const handleFloatingButtonPress = () => {
        // Set a flag in AsyncStorage to indicate we need to refresh when coming back
        AsyncStorage.setItem('should_refresh_audio_files', 'true')
            .then(() => {
                navigation.navigate('LiveTranscription');
            })
            .catch(error => {
                console.error('Error setting refresh flag:', error);
                navigation.navigate('LiveTranscription');
            });
    };
    
    const formatDuration = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
      
        if (minutes === 0) {
          return `${remainingSeconds} sec`; // Only show seconds if minutes are 0
        } else if (remainingSeconds === 0) {
          return `${minutes} min`; // Only show minutes if seconds are 0
        } else {
          return `${minutes} min ${remainingSeconds} sec`; // Show both
        }
      };

    const openFilterModal = () => setFilterModalVisible(true);
    const closeFilterModal = () => setFilterModalVisible(false);

    const handleShareFile = async (file) => {
        try {
            setIsSharing(true);
            if (!file.audio_url) {
                Alert.alert('Error', 'File URL is not available');
                setIsSharing(false);
                return;
            }

            // Create temporary file path
            const tempFilePath = `${RNFS.TemporaryDirectoryPath}/${file.audio_name || 'audio_file'}.mp3`;
            
            // Download the file
            const download = RNFS.downloadFile({
                fromUrl: file.audio_url,
                toFile: tempFilePath,
                progress: (res) => {
                    const progressPercent = (res.bytesWritten / res.contentLength) * 100;
                    console.log(`Download progress: ${progressPercent.toFixed(2)}%`);
                }
            });

            // Wait for download to complete
            await download.promise;
            
            // Share the downloaded file
            const shareOptions = {
                title: `Share ${file.audio_name}`,
                url: `file://${tempFilePath}`,
                type: 'audio/mpeg',
                failOnCancel: false,
                message: `Check out this audio file: ${file.audio_name}`,
            };

            const result = await Share.open(shareOptions);
            
            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    console.log('Shared with activity type:', result.activityType);
                } else {
                    console.log('Shared successfully');
                }
            } else if (result.action === Share.dismissedAction) {
                console.log('Sharing dismissed');
            }

            // Clean up temporary file
            try {
                await RNFS.unlink(tempFilePath);
                console.log('Temporary file deleted');
            } catch (cleanupError) {
                console.error('Error deleting temporary file:', cleanupError);
            }
        } catch (error) {
            console.error('Error sharing file:', error.message);
            Alert.alert('Error', 'Failed to share the file. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    const handleEditName = async () => {
        if (!newFileName.trim()) {
            Alert.alert('Invalid Name', 'File name cannot be empty.');
            return;
        }
    
        try {
            const response = await fetch('https://matrix-server.vercel.app/editAudio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    uid: uid, // User's UID
                    audioid: selectedFile.audioid, // File's unique ID
                    updatedName: newFileName, // New name for the audio file
                }),
            });
    
            const data = await response.json();
    
            if (response.ok) {
                // Update local state with the new file name
                const updatedFiles = files.map((file) =>
                    file.audioid === selectedFile.audioid
                        ? { ...file, audio_name: newFileName }
                        : file
                );
                setFiles(updatedFiles);
                
                // Update local storage with the updated files
                await saveFilesToLocalStorage(updatedFiles);
                
                // Show success toast
                showCustomToast('Success', 'File name updated successfully.', 'success');
                
                setEditModalVisible(false); // Close edit modal
                setNewFileName('');
            } else {
                console.error('Error updating audio:', data.error);
                showCustomToast('Error', 'Failed to update the audio name.', 'error');
            }
        } catch (error) {
            console.error('Error updating audio name:', error);
            showCustomToast('Error', 'An error occurred while updating the audio name.', 'error');
        }
    };
    

    const toggleFileSelection = (fileId) => {
        setSelectedFiles((prevSelected) => {
            if (prevSelected.includes(fileId)) {
                return prevSelected.filter(id => id !== fileId);
            } else {
                return [...prevSelected, fileId];
            }
        });
    };

    const renderRightActions = (item,progress, dragX) => (
        <View style={styles.rightActionsContainer}>
            
            {/* Edit Button */}
            <TouchableOpacity
            onPress={() => {
                console.log(item);
                setSelectedFile(item); // Set selected file for editing
                setEditModalVisible(true); // Open edit modal
            }}
            style={styles.actionButton1}
        >
            <Image
                source={require('../assets/pencil2.png')}
                style={styles.actionIcon}
            />
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity
            onPress={() => handleShareFile(item)}
            style={styles.actionButton2}
            disabled={isSharing}
        >
            {isSharing ? (
                <ActivityIndicator color="#fff" size="small" />
            ) : (
                <Image
                    source={require('../assets/send.png')}
                    style={styles.actionIcon}
                />
            )}
        </TouchableOpacity>

        {/* Remove Button */}
        <TouchableOpacity
            onPress={() => handleRemoveFile(item.audioid)}
            style={styles.actionButton3}
        >
            <Image
                source={require('../assets/remove.png')}
                style={styles.actionIcon}
            />
        </TouchableOpacity>
        </View>
    );
    const renderFileItem = ({ item }) => {
        const isSelected = selectedFiles.includes(item.audioid);
        const isLoading = loadingAudioIds.has(item.audioid); // Check if this audioid is loading

        return (
            <Swipeable
            renderRightActions={(progress, dragX) => renderRightActions(item, progress, dragX)} // Pass `item` to renderRightActions
            overshootRight={false}
        >
                <TouchableOpacity
                    style={[
                        styles.fileItem,
                        isSelected && styles.selectedFileItem,
                    ]}
                    onPress={() => {
                        if (isFilterMode) {
                            toggleFileSelection(item.audioid);
                        }
                    }}
                >
                    {isFilterMode && (
                        <View style={styles.dot}>
                            {isSelected && <View style={styles.innerDot} />}
                        </View>
                    )}
                    <Image
                        source={audioIcon }
                        style={styles.fileIcon}
                    />
                <View style={styles.detailsRow}>
    <Text style={styles.fileName} numberOfLines={1}>
        {item.audio_name?.length > 20 ? `${item.audio_name.substring(0, 18)}...` : item.audio_name || 'Unknown File'}
    </Text>
    <View style={styles.fileDetails}>
        <Image source={clockIcon} style={styles.detailIcon} />
        <Text style={styles.detailText}>
        {formatDuration(item.duration)}
      </Text>
        <Image source={calendarIcon} style={styles.detailIcon} />
        <Text style={styles.detailText}>
            {item.uploaded_at ? 
                `${item.uploaded_at.split('T')[0].split('-')[2]}/${item.uploaded_at.split('T')[0].split('-')[1]} ${item.uploaded_at.split('T')[1].substring(0, 5)}` 
                : 'Unknown Date'}
        </Text>
    </View>
</View>

                        <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handlePress2(item)}
                    >
                         {isLoading ? ( // Show loading indicator if this audioid is loading
                            <>
                                <ActivityIndicator size="small" color="#000" />
                                <Text style={styles.convert}>Loading...</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.convert}>
                                    Convert
                                </Text>
                                <Image source={Translate} style={styles.detailIcon5} />
                            </>
                        )}
                    </TouchableOpacity>
                </TouchableOpacity>
            </Swipeable>
        );
    };
 
    const handleDeleteAll = async () => {
        try {
            setIsDeleting(true);
            // Create a copy of selected files array
            const filesToDelete = [...selectedFiles];
            
            // Delete each selected file one by one
            for (const audioid of filesToDelete) {
                await handleRemoveFile(audioid);
            }
            
            // Clear selection and exit filter mode
            setSelectedFiles([]);
            setIsFilterMode(false);
            
            // Show success toast
            showCustomToast('Success', `${filesToDelete.length} files deleted successfully.`, 'success');
        } catch (error) {
            console.error('Error deleting files:', error);
            showCustomToast('Error', 'Failed to delete some files', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleFilterMode = () => {
        const newFilterMode = !isFilterMode;
        setIsFilterMode(newFilterMode);
        
        // // If entering filter mode, select all files
        // if (newFilterMode) {
        //     setSelectedFiles(files.map(file => file.audioid));
        // } else {
        //     // Clear selection when exiting filter mode
        //     setSelectedFiles([]);
        // }
    };

    // Helper function to decode base64
    const decode = (base64) => {
        return Buffer.from(base64, 'base64');
    };

    // Add this to refresh files when the screen comes into focus
    useEffect(() => {
        // Subscribe to focus events
        const unsubscribe = navigation.addListener('focus', async () => {
            // Check if we should refresh (coming back from LiveTranscriptionTest)
            const shouldRefresh = await AsyncStorage.getItem('should_refresh_audio_files');
            
            if (shouldRefresh === 'true') {
                // Clear the flag
                await AsyncStorage.setItem('should_refresh_audio_files', 'false');
                // Force refresh from API
                await loadFiles(true);
            } else {
                // Normal load (will use cache if available)
                await loadFiles(false);
            }
        });

        // Clean up the subscription when component unmounts
        return unsubscribe;
    }, [navigation]);

    // Sort languages alphabetically on component mount
    useEffect(() => {
        // Sort languages alphabetically by label
        const sortedLanguages = [...languages].sort((a, b) => 
            a.label.localeCompare(b.label)
        );
        setLanguages(sortedLanguages);
    }, []);

    const toastStyles = StyleSheet.create({
        toastContainer: {
            position: 'absolute',
            bottom: 40,
            left: 20,
            right: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
            flexDirection: 'row',
            alignItems: 'center',
        },
        toastContent: {
            flex: 1,
        },
        toastTitle: {
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 4,
        },
        toastMessage: {
            fontSize: 14,
            color: '#666',
        },
        successToast: {
            backgroundColor: 'rgba(52, 211, 153, 0.95)', // Modern green
        },
        errorToast: {
            backgroundColor: 'rgba(248, 113, 113, 0.95)', // Modern red
        },
        infoToast: {
            backgroundColor: 'rgba(96, 165, 250, 0.95)', // Modern blue
        },
        closeToastButton: {
            position: 'absolute',
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
        },
        closeToastButtonText: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#fff',
        }
    });

    const renderToast = () => {
        if (!toastVisible) return null;

        const getToastStyle = () => {
            switch (toastType) {
                case 'success':
                    return toastStyles.successToast;
                case 'error':
                    return toastStyles.errorToast;
                case 'info':
                    return toastStyles.infoToast;
                default:
                    return {};
            }
        };

        return (
            <Animated.View 
                style={[
                    toastStyles.toastContainer, 
                    getToastStyle(),
                    { opacity: fadeAnim }
                ]}
            >
                <TouchableOpacity 
                    style={toastStyles.closeToastButton} 
                    onPress={hideCustomToast}
                >
                    <Text style={toastStyles.closeToastButtonText}>×</Text>
                </TouchableOpacity>
                <View style={toastStyles.toastContent}>
                    <Text style={[
                        toastStyles.toastTitle,
                        { color: toastType === 'default' ? '#000' : '#fff' }
                    ]}>
                        {toastTitle}
                    </Text>
                    <Text style={[
                        toastStyles.toastMessage,
                        { color: toastType === 'default' ? '#666' : '#fff' }
                    ]}>
                        {toastMessage}
                    </Text>
                </View>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Section */}
           
          
               
           <Image source={require('../assets/logo8.png')} style={styles.headerIcon2} />
          
            <View style={styles.topButtonsContainer}>
            <TouchableOpacity style={styles.headerIcon3} onPress={() => navigation.goBack()}>
                                   <Image
                                       source={require('../assets/back.png')} 
                                       style={styles.headerIcon3}
                                   />
                               </TouchableOpacity>
                <TouchableOpacity style={styles.topButton} onPress={handleFileSelect}>
                    <Image source={uploadIcon} style={styles.topIcon} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.topButton2}>
                    <Image source={resizeIcon} style={styles.topIcon} />
                </TouchableOpacity>
                <View style={styles.topHelp}>
                    <Image source={helpIcon2} style={styles.topHelpIcon} />
                    <Text style={styles.helpText}>How to add voice memos to Transcribe</Text>
                </View>
            </View>
            {/* Loading Indicator */}
            {/* {uploading && (
                <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color="#0066FEFF" />
                    <Text style={styles.uploadingText}>Uploading Audio...</Text>
                </View>
            )} */}

            {/* Search Bar */}
            <View style={styles.searchBox2}>
            <View style={styles.searchBox}>
                <Image source={require('../assets/search.png')} style={styles.searchIcon} />
                <TextInput
                    placeholder="Search"
                    style={styles.textInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>
            <TouchableOpacity onPress={toggleFilterMode} style={styles.filterButton}>
    <Image source={require('../assets/select-all.png')} style={styles.filterIcon} />
</TouchableOpacity>

</View>
            {/* Filter Modal */}
            
            {/* File List */}
            <FlatList
                data={getFilteredFiles()}
                keyExtractor={(item) => item.audioid}
                renderItem={renderFileItem}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#007bff" />
                        ) : (
                            <>
                                <Image 
                                    source={emptyIcon}
                                    style={styles.emptyImage}
                                />
                                <Text style={styles.emptyText}>
                                    {searchQuery 
                                        ? "No files match your search"
                                        : "No audio files found"}
                                </Text>
                            </>
                        )}
                    </View>
                }
            />
                {isFilterMode && (
            <TouchableOpacity style={styles.deleteAllButton} onPress={handleDeleteAll}>
                {isDeleting ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <>
                        <Image source={require('../assets/remove.png')} style={styles.deleteIcon} />
                        <Text style={styles.deleteAllButtonText}>Delete All</Text>
                    </>
                )}
            </TouchableOpacity>
        )}
            {/* Add File Floating Button */}
          
            <TouchableOpacity style={styles.floatingButton} onPress={handleFloatingButtonPress}>
                <Image source={micIcon} style={styles.floatingButtonIcon} />
            </TouchableOpacity>
    
    
            {popupVisible && (
    <View style={styles.popupContainer}>
        <View style={styles.popupContent}>
            <Text style={styles.popupText}>Upload Audio</Text>
            
            <View style={styles.languageSelector}>
                <Text style={styles.languageLabel}>Select Language:</Text>
                <Picker
                    selectedValue={selectedLanguage}
                    style={styles.picker}
                    onValueChange={(itemValue) => setSelectedLanguage(itemValue)}
                >
                    {languages.map((lang) => (
                        <Picker.Item key={lang.value} label={lang.label} value={lang.value} />
                    ))}
                </Picker>
            </View>

            <View style={styles.popupButtons}>
                <TouchableOpacity onPress={handleClosePopup} style={styles.popupButton}>
                    <Text style={styles.popupButtonText}>Close</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={async () => {
                        await handleUpload(audioFile, duration);
                    }}
                    disabled={uploading}
                >
                    <Text style={styles.convert2}>-{duration}</Text>
                    <Image source={coin} style={styles.detailIcon2} />

                    {uploading ? (
                        <ActivityIndicator size="small" color="#0000ff" />
                    ) : (
                        <Text style={styles.convert}>Convert</Text>
                    )}

                    <Image source={Translate} style={styles.detailIcon5} />
                </TouchableOpacity>
            </View>
        </View>
    </View>
)}


            {/* Edit Modal */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit File Name</Text>
                        <TextInput
                            style={styles.editInput}
                            placeholder="Enter new file name"
                            value={newFileName}
                            onChangeText={setNewFileName}
                            autoFocus={true}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setEditModalVisible(false);
                                    setNewFileName('');
                                }}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={handleEditName}
                            >
                                <Text style={styles.modalButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Toast */}
            {renderToast()}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
   
       
    },
    rightActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        backgroundColor: '#5E5E5E31',
        paddingHorizontal: 5,
        height: '88%',
    },
 
  
  
      popupContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
      popupContent: { backgroundColor: 'white', padding: 20, borderRadius: 10, width: '80%' },
      popupText: { fontSize: 18, textAlign: 'center', fontWeight: 'bold', marginBottom: 10 },
      popupButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
      popupButton: { padding: 10, backgroundColor: '#0066FE', borderRadius: 5 },
      popupButtonText: { color: 'white' },
   
      
    dot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#007bff',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#007bff',
    },
    selectedFileItem: {
        backgroundColor: '#e6f7ff',
    },
    deleteAllButton: {
        position: 'absolute',
        bottom: 30,
        left: '10%',
        right: '60%',
        backgroundColor: '#ff4d4d',
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    deleteIcon: {
        width: 20,
        height: 20,
        tintColor: '#fff',
    },
   
   
    uploadingOverlay: {
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderRadius: 5, // Optional, for rounded corners
        marginVertical: 10, // Adjust based on how much space you want above and below
        zIndex: 100, // Optional, depending on your layout
    },
    
    uploadingText: {
        marginTop: 10,
        color: '#0478F4FF',
        fontSize: 16,
    },
    deleteAllButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    
    actionButton: {
        position: 'absolute', // Makes the button position absolute
        right: 5, // Distance from the right edge of the screen
     // Distance from the bottom edge of the screen
        backgroundColor: '#57575710',
        borderRadius: 20,
        padding: 8, // Adjust padding for better touch area
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5, // Adds shadow for Android
        shadowColor: '#000', // Adds shadow for iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    actionButton4: {
       // Distance from the right edge of the screen
     // Distance from the bottom edge of the screen
        backgroundColor: '#FF6600FF',
        borderRadius: 20,
        padding: 8, // Adjust padding for better touch area
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5, // Adds shadow for Android
        shadowColor: '#000', // Adds shadow for iOS
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    
    convert:{
marginRight:5,
fontSize:12,
color:'#000',
    },
    convert2:{
        marginRight:5,
        fontSize:16,
        color:'#000',
            },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        marginTop: 100, // Adjust this value to position the empty state below search box
    },
    emptyImage: {
        width: 200,
        height: 200,
        resizeMode: 'contain',
        marginBottom: 20,
        opacity: 0.8
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginTop: 10
    },
    actionButton1: {
        backgroundColor: '#298EF9FF',
        borderRadius: 20,
        padding: 10,
        marginHorizontal: 5,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 25,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
        width: '90%',
        height: 40,
        marginLeft:5,
    },
    searchBox2: {
        flexDirection: 'row',
        alignItems: 'center',
      
     
     
        width: '100%',
        height: 50,
    },
    searchIcon: {
        width: 20,
        height: 20,
        marginRight: 10,
        resizeMode: 'contain',
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingVertical: 0,
        paddingHorizontal: 10,
        height: 40,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 25,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
        width: '90%',
        height: 40,
        marginLeft: 5,
    },
    filterButton: {
        marginLeft: 1,
    },
    filterIcon: {
        width: 30,
        height: 30,
        resizeMode: 'contain',
    },
  
    actionButton2: {
        backgroundColor: '#007bff',
        borderRadius: 20,
        padding: 10,
        marginHorizontal: 5,
    },
    actionButton3: {
        backgroundColor: '#ff4d4d',
        borderRadius: 20,
        padding: 10,
        marginHorizontal: 5,
    },
    actionIcon: {
        width: 20,
        tintColor:'#FFFFFFFF',
        height: 20,
        resizeMode: 'contain',
    },
    fileDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    detailIcon: {
        width: 14,
        height: 14,
        marginRight: 4,
        resizeMode: 'contain',
    },
    detailIcon5: {
        width: 20,
        height: 20,
        marginRight: 1,
        borderRadius:20,
        resizeMode: 'contain',
        backgroundColor:'#007bff',
        tintColor:'#fff',
    },
    removeButton: {
        backgroundColor: '#ff4d4d',
        width: 40,
        height: 40,
        borderRadius: 20, // Circular button
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 1,
        marginRight:10,
        marginTop:15,
    },
    removeButtonText: {
        color: '#fff',
        fontSize: 12,
        textAlign: 'center',
    },
   
    topButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 12,
    },
    topButton: {
        backgroundColor: '#FF6600',
        padding: 12,
        borderRadius: 10,
        marginRight: 10,
    },
    topButton2: {
        backgroundColor: '#FAA300',
        padding: 12,
        borderRadius: 10,
        marginRight: 10,
    },
    topIcon: {
        width: 34,
        height: 34,
        resizeMode: 'contain',
    },
    topHelp: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#007bff',
        borderRadius: 10,
        padding: 12,
    },
    topHelpIcon: {
        width: 34,
        height: 34,
        resizeMode: 'contain',
        marginRight: 8,
    },
    topHelpIcon2: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
    },
    helpText: {
        color: '#ffffff',
        fontSize: 12,
        flexShrink: 1,
    },
    detailText: {
        color: '#B7B7B7FF',
        fontSize: 10,
        flexShrink: 1,
        marginRight: 5,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#007bff',
    },
    noResultsText: {
        marginTop: 20,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',

     
    },
    headerTitle: {
       
        position:'absolute',
        left:'42%',
     fontSize:20,
     fontWeight:'bold',
     color:'#007bff',
    },
    headerIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
    },
    headerIcon3: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        marginRight:10,
    },
    headerIcon2: {
        width: 200,
        height: 50,
        alignSelf:'center',
        resizeMode: 'contain',
    },
    detailIcon2: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
    },
    
    searchBar: {
        backgroundColor: '#f1f3f6',
        borderRadius: 8,
        marginHorizontal: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f9f9f9',
        borderColor:'#3333334E',
        borderWidth:1,
        padding: 14,
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        elevation: 2,
    },
    fileItem2: {
        flexDirection: 'row',
        alignItems: 'center',





    },
    fileIcon: {
        width: 36,
        height: 36,
        marginRight: 12,
        resizeMode: 'contain',
    },
    fileName: {
        flex: 1,
        fontSize: 15,
        color: '#333',
        fontWeight: 'bold',
    },
  
  
    floatingButton: {
        position: 'absolute',
        bottom: 50,
        right: 25,
        backgroundColor: '#007bff',
        borderRadius: 30,
        padding: 16,
        elevation: 5,
    },
    floatingButton2: {
        position: 'absolute',
        bottom: 30,
        right: 90,
        backgroundColor: '#FF6600',
        borderRadius: 30,
        padding: 16,
        elevation: 5,
    },
    floatingButtonIcon: {
        width: 24,
        height: 24,
        tintColor: '#fff',
    },
    editInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        marginBottom: 20,
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: '#28a745',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    modalButton: {
        padding: 10,
        borderRadius: 5,
        width: '45%',
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#6c757d',
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
    },
    languageSelector: {
        marginVertical: 15,
    },
    languageLabel: {
        fontSize: 16,
        marginBottom: 5,
        fontWeight: '500',
    },
    picker: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginTop: 5,
    },
    toastContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    toastContent: {
        flex: 1,
    },
    toastTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    toastMessage: {
        fontSize: 14,
        color: '#666',
    },
    successToast: {
        backgroundColor: 'rgba(52, 211, 153, 0.95)', // Modern green
    },
    errorToast: {
        backgroundColor: 'rgba(248, 113, 113, 0.95)', // Modern red
    },
    infoToast: {
        backgroundColor: 'rgba(96, 165, 250, 0.95)', // Modern blue
    }
});

export default AudioVideoUploadScreen;
