import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Image,
  Modal,
  FlatList,
  Animated,
  Share,
  Clipboard,
} from 'react-native';
import { Buffer } from 'buffer';
import AudioRecord from 'react-native-audio-record';
import Sound from 'react-native-sound';
import LottieView from 'lottie-react-native';
import { v4 as uuidv4 } from 'uuid';
import pako from 'pako';
import RNFS from 'react-native-fs';
import 'react-native-get-random-values';
import axios from 'axios';
import { PERMISSIONS, request, check, RESULTS, openSettings } from 'react-native-permissions';
import { supabase } from '../supabaseClient';
import { useAuthUser } from '../hooks/useAuthUser';
// Global refs
let dataSubscription = null;
let websocketConnection = null;
let chunkStartTime = 0; // Track when we started collecting the current chunk
let currentChunkBuffers = []; // Collect raw buffer chunks instead of base64 strings
let chunkCounter = 0; // Counter for chunks
let websocketReady = false; // Flag to indicate when WebSocket is fully ready to receive audio

// TextDecoder polyfill for React Native
// Since TextDecoder is not available natively in RN environment
const decodeUTF8 = (bytes) => {
  // Use Buffer for UTF-8 decoding - already available in RN with buffer package
  return Buffer.from(bytes).toString('utf8');
};

// Function to create a WAV file from PCM data
const createWavFile = (pcmData, sampleRate = 16000, bitsPerSample = 16, channels = 1) => {
  // Calculate sizes
  const dataSize = pcmData.length;
  const headerSize = 44; // Standard WAV header size
  const totalSize = headerSize + dataSize;
  
  // Create a buffer for the WAV file
  const wavBuffer = Buffer.alloc(totalSize);
  
  // Write WAV header
  // "RIFF" chunk descriptor
  wavBuffer.write('RIFF', 0, 'ascii');
  wavBuffer.writeUInt32LE(36 + dataSize, 4); // Chunk size (file size - 8)
  wavBuffer.write('WAVE', 8, 'ascii');
  
  // "fmt " sub-chunk
  wavBuffer.write('fmt ', 12, 'ascii');
  wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  wavBuffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  wavBuffer.writeUInt16LE(channels, 22); // NumChannels
  wavBuffer.writeUInt32LE(sampleRate, 24); // SampleRate
  wavBuffer.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28); // ByteRate
  wavBuffer.writeUInt16LE(channels * bitsPerSample / 8, 32); // BlockAlign
  wavBuffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  
  // "data" sub-chunk
  wavBuffer.write('data', 36, 'ascii');
  wavBuffer.writeUInt32LE(dataSize, 40); // Subchunk2Size
  
  // Copy PCM data
  pcmData.copy(wavBuffer, headerSize);
  
  return wavBuffer;
};

// Add this helper function after all imports and before any other functions
// Utility function to normalize file paths across platforms
const normalizeFilePath = (filePath) => {
  if (!filePath) return null;
  
  // Handle iOS symlinks and double prefixing issues
  if (Platform.OS === 'ios') {
    // Remove double prefixing if it exists
    if (filePath.includes('/Documents//var/mobile/')) {
      // Replace the double prefix with just the DocumentDirectoryPath
      return filePath.replace(
        /^\/var\/mobile\/.*Documents\/\/var\/mobile\/.*Documents\//,
        `${RNFS.DocumentDirectoryPath}/`
      );
    }
    
    // Handle /private prefix (symlink in iOS)
    if (filePath.startsWith('/private/')) {
      return filePath.replace(/^\/private/, '');
    }
  }
  
  return filePath;
};

// Now use this function throughout the code when handling file paths

// Helper to check if a file exists with proper error handling
const fileExists = async (path) => {
  if (!path) return false;
  
  try {
    const normalizedPath = normalizeFilePath(path);
    return await RNFS.exists(normalizedPath);
  } catch (error) {
    console.error('Error checking if file exists:', error);
    return false;
  }
};

const LiveTranscriptionScreen = ({ navigation }) => {
  // State for recording
  const [recording, setRecording] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformData, setWaveformData] = useState([]);
  const [audioPath, setAudioPath] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // State for WebSocket
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState(null);
  
  // Additional states for pause/resume functionality
  const [isPaused, setIsPaused] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  
  // Refs
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const sequenceNumber = useRef(0);
  const connectIdRef = useRef(uuidv4());
  const soundRef = useRef(null);
  
  // Reference to hold the paused state of the websocket
  const websocketPausedRef = useRef(false);
  
  // Reference to temporarily store audio data while paused
  const pausedAudioBufferRef = useRef([]);

  // Add new state variables for translation features
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedLanguage2, setSelectedLanguage2] = useState('Spanish');
  const [translatedText, setTranslatedText] = useState('');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState('source');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [circleAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [slideAnimation] = useState(new Animated.Value(300));
  const { uid, loading } = useAuthUser();
  // Add language codes and other constants
  const languageCodes = {
    Afrikaans: 'af',
    Albanian: 'sq',
    Arabic: 'ar',
    Armenian: 'hy',
    Azerbaijani: 'az',
    Bengali: 'bn',
    Bosnian: 'bs',
    Bulgarian: 'bg',
    Catalan: 'ca',
    Chinese: 'zh',
    Croatian: 'hr',
    Czech: 'cs',
    Danish: 'da',
    Dutch: 'nl',
    English: 'en', // Use 'en' for display
    Estonian: 'et',
    Finnish: 'fi',
    French: 'fr',
    Georgian: 'ka',
    German: 'de',
    Greek: 'el',
    Gujarati: 'gu',
    Hebrew: 'he',
    Hindi: 'hi',
    Hungarian: 'hu',
    Icelandic: 'is',
    Indonesian: 'id',
    Irish: 'ga',
    Italian: 'it',
    Japanese: 'ja',
    Kannada: 'kn',
    Kazakh: 'kk',
    Korean: 'ko',
    Latvian: 'lv',
    Lithuanian: 'lt',
    Macedonian: 'mk',
    Malay: 'ms',
    Malayalam: 'ml',
    Marathi: 'mr',
    Mongolian: 'mn',
    Nepali: 'ne',
    Norwegian: 'no',
    Persian: 'fa',
    Polish: 'pl',
    Portuguese: 'pt',
    Punjabi: 'pa',
    Romanian: 'ro',
    Russian: 'ru',
    Serbian: 'sr',
    Sinhala: 'si',
    Slovak: 'sk',
    Slovenian: 'sl',
    Spanish: 'es',
    Swahili: 'sw',
    Swedish: 'sv',
    Tamil: 'ta',
    Telugu: 'te',
    Thai: 'th',
    Turkish: 'tr',
    Ukrainian: 'uk',
    Urdu: 'ur',
    Uzbek: 'uz',
    Vietnamese: 'vi',
    Welsh: 'cy',
  };

  // New mapping for upload language codes
  const uploadLanguageCodes = {
    Afrikaans: 'af',
    Albanian: 'sq',
    Arabic: 'ar',
    Armenian: 'hy',
    Azerbaijani: 'az',
    Bengali: 'bn',
    Bosnian: 'bs',
    Bulgarian: 'bg',
    Catalan: 'ca',
    Chinese: 'zh',
    Croatian: 'hr',
    Czech: 'cs',
    Danish: 'da',
    Dutch: 'nl',
    English: 'en-US', // Use 'en-US' for upload
    Estonian: 'et',
    Finnish: 'fi',
    French: 'fr',
    Georgian: 'ka',
    German: 'de',
    Greek: 'el',
    Gujarati: 'gu',
    Hebrew: 'he',
    Hindi: 'hi',
    Hungarian: 'hu',
    Icelandic: 'is',
    Indonesian: 'id',
    Irish: 'ga',
    Italian: 'it',
    Japanese: 'ja',
    Kannada: 'kn',
    Kazakh: 'kk',
    Korean: 'ko',
    Latvian: 'lv',
    Lithuanian: 'lt',
    Macedonian: 'mk',
    Malay: 'ms',
    Malayalam: 'ml',
    Marathi: 'mr',
    Mongolian: 'mn',
    Nepali: 'ne',
    Norwegian: 'no',
    Persian: 'fa',
    Polish: 'pl',
    Portuguese: 'pt',
    Punjabi: 'pa',
    Romanian: 'ro',
    Russian: 'ru',
    Serbian: 'sr',
    Sinhala: 'si',
    Slovak: 'sk',
    Slovenian: 'sl',
    Spanish: 'es',
    Swahili: 'sw',
    Swedish: 'sv',
    Tamil: 'ta',
    Telugu: 'te',
    Thai: 'th',
    Turkish: 'tr',
    Ukrainian: 'uk',
    Urdu: 'ur',
    Uzbek: 'uz',
    Vietnamese: 'vi',
    Welsh: 'cy',
  };

  const MAX_RECORDING_DURATION = 300; // 5 minutes in seconds

  // Add timerIdsRef after other refs
  const timerIdsRef = useRef([]);

  const [loadingAudioIds, setLoadingAudioIds] = useState(new Set());
 

  // Add this to your state variables near the top where other state variables are defined
  const [selectedLanguageForUpload, setSelectedLanguageForUpload] = useState('en-US');

  useEffect(() => {
    // Initialize uid - in a real app this would come from authentication

    
    // Initialize
    const setup = async () => {
      // For iOS, bypass permission check
      if (Platform.OS === 'ios') {
        setPermissionGranted(true);
        await initializeAudioRecorder();
      } else {
        const hasPermission = await checkPermission();
        if (hasPermission) {
          await initializeAudioRecorder();
        } else {
          console.log('Permission not granted in initial setup');
        }
      }
      setLoadingPermission(false);
    };
    
    setup();
    
    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      if (websocketConnection) {
        websocketConnection.close();
        websocketConnection = null;
      }
      
      AudioRecord.stop();
    };
  }, []);

  useEffect(() => {
    // Only translate if translate mode is active and there's transcription text
    if (isTranslateMode && transcription && 
        transcription !== 'Press Mic to start listening' && 
        transcription !== 'Listening...') {
      translateText(transcription);
    }
  }, [transcription, isTranslateMode]); // Depend on both transcription and translate mode

  const checkPermission = async () => {
    try {
      console.log('Checking microphone permission');
      if (Platform.OS === 'android') {
        const result = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
        console.log('Android permission check result:', result);
        
        if (result === RESULTS.GRANTED) {
          setPermissionGranted(true);
          return true;
        } else if (result === RESULTS.DENIED) {
          const requestResult = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
          console.log('Android permission request result:', requestResult);
          const isGranted = requestResult === RESULTS.GRANTED;
          setPermissionGranted(isGranted);
          return isGranted;
        } else {
          // BLOCKED or UNAVAILABLE
          setPermissionGranted(false);
          Alert.alert(
            'Microphone Permission Required',
            'This app needs access to your microphone. Please enable microphone permission in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => openSettings() }
            ]
          );
          return false;
        }
      } else {
        // For iOS, just return true without checking permissions
        console.log('iOS device detected, bypassing permission check');
        setPermissionGranted(true);
        return true;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setError(`Permission error: ${error.message}`);
      // For iOS, return true anyway to bypass permission issues
      if (Platform.OS === 'ios') {
        setPermissionGranted(true);
        return true;
      }
      return false;
    }
  };

  const initializeAudioRecorder = async () => {
    try {
      // Clean up any existing listeners first to avoid "Invalid event" error
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      // Stop any existing recording
      try {
        AudioRecord.stop();
      } catch (e) {
        console.log('No active recording to stop');
      }
      
      // Create a unique path for each recording to avoid conflicts
      const recordingId = Date.now().toString();
      
      // Ensure we have a clean, standardized path for iOS to avoid double prefixing
      let tempFilePath;
      if (Platform.OS === 'ios') {
        // Use RNFS.DocumentDirectoryPath directly instead of constructing the path
        tempFilePath = `${RNFS.DocumentDirectoryPath}/recording_${recordingId}.wav`;
        console.log('iOS recording path:', tempFilePath);
      } else {
        tempFilePath = `${RNFS.DocumentDirectoryPath}/recording_${recordingId}.wav`;
      }
      
      // Options optimized for both platforms
      const options = {
        sampleRate: 16000,  // 16kHz as required by API
        channels: 1,        // Mono
        bitsPerSample: 16,  // 16-bit
        audioSource: Platform.OS === 'android' ? 6 : 0,  // MIC source type
        // Set a clear, unique file path for each recording
        wavFile: Platform.OS === 'ios' ? `recording_${recordingId}.wav` : tempFilePath,
        // Add buffer size configuration - important for iOS
        bufferSize: Platform.OS === 'ios' ? 4096 : 8192,
      };
      
      console.log('Initializing AudioRecord with options:', JSON.stringify(options));
      
      // Initialize with a promise wrapper to handle exceptions better
      await new Promise((resolve, reject) => {
        try {
          AudioRecord.init(options);
          console.log('AudioRecord initialized successfully');
          resolve();
        } catch (error) {
          console.error('Error in AudioRecord.init():', error);
          reject(error);
        }
      });
      
      // For both platforms, set up the audio data listener
      setupAudioListener();
      return true;
    } catch (error) {
      console.error('Error initializing audio recorder:', error);
      setError(`Audio init error: ${error.message}`);
      return false;
    }
  };

  const setupAudioListener = () => {
    console.log('Setting up audio listener...');
    
    try {
      // Clean up existing subscription
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }

      // Reset chunk collection
      currentChunkBuffers = [];
      chunkStartTime = Date.now();
      chunkCounter = 0;

      // Set up new listener for both platforms
      dataSubscription = AudioRecord.on('data', data => {
        try {
          // Log data receipt for debugging
          console.log(`[Audio] Data received, length: ${data.length}`);
          
          // Convert base64 data to raw binary buffer
          const chunk = Buffer.from(data, 'base64');
          
          if (chunk.byteLength > 0) {
            console.log(`[Audio] Raw chunk size: ${chunk.byteLength} bytes`);
            
            // Add to the current audio chunks array (for reference)
            audioChunksRef.current.push(data);
            
            // Add raw buffer to our current 1-second chunk collection
            currentChunkBuffers.push(chunk);
            
            // Generate simple waveform data
            const amplitude = Math.min(100, chunk.byteLength / 50);
            setWaveformData(prevData => {
              const newData = [...prevData, amplitude];
              if (newData.length > 30) {
                return newData.slice(newData.length - 30);
              }
              return newData;
            });
            
            // Check if we've collected 1 second worth of audio
            const currentTime = Date.now();
            if (currentTime - chunkStartTime >= 1000) {
              processAudioChunk(currentTime);
            }
          } else {
            console.warn('[Audio] Warning: Received empty audio chunk');
          }
        } catch (error) {
          console.error('[Audio] Error in data listener:', error);
          setError(`Audio data error: ${error.message}`);
        }
      });
      
      console.log('[Audio] Listener setup complete');
    } catch (error) {
      console.error('[Audio] Error setting up audio listener:', error);
      setError(`Error setting up audio: ${error.message}`);
    }
  };
  
  // Move the audio chunk processing to a separate function
  const processAudioChunk = async (currentTime) => {
    try {
      // Combine all buffers into one larger buffer
      const totalLength = currentChunkBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
      console.log(`Combined chunk length: ${totalLength} bytes from ${currentChunkBuffers.length} chunks`);
      
      if (totalLength === 0) {
        console.warn('Warning: Empty audio buffer - no audio data received');
        // Reset and continue
        currentChunkBuffers = [];
        chunkStartTime = currentTime;
        return;
      }
      
      const combinedPCMBuffer = Buffer.concat(currentChunkBuffers, totalLength);
      
      // Convert PCM to WAV
      const wavBuffer = createWavFile(combinedPCMBuffer);
      
      // Generate unique filename
      chunkCounter++;
      const wavFileName = `chunk_${Date.now()}_${chunkCounter}.wav`;
      const chunkFilePath = `${RNFS.DocumentDirectoryPath}/${wavFileName}`;
      
      // Save the WAV file
      const wavBase64 = wavBuffer.toString('base64');
      await RNFS.writeFile(chunkFilePath, wavBase64, 'base64');
      console.log(`WAV chunk saved to ${chunkFilePath}, size: ${wavBuffer.length} bytes`);
      
      // Check WebSocket status with more detail
      const wsStatus = websocketConnection ? websocketConnection.readyState : 'null';
      console.log(`WebSocket status: ${wsStatus}, Ready flag: ${websocketReady}`);
      
      // Send the chunk to the WebSocket if it's fully ready
      if (websocketReady && websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
        console.log(`Sending WAV chunk ${chunkCounter}, size: ${wavBuffer.length} bytes`);
        const result = sendAudioChunkToWebSocket(wavBuffer, false);
        console.log(`Chunk ${chunkCounter} sent: ${result}`);
      } else {
        console.log(`WebSocket not ready to send chunk ${chunkCounter}. Status: ${wsStatus}, Ready: ${websocketReady}`);
        
        // Store the chunk for delayed sending if needed
        // We could implement a queue here to send chunks once the WebSocket is ready
      }
      
      // Reset for the next 1-second chunk
      currentChunkBuffers = [];
      chunkStartTime = currentTime;
    } catch (error) {
      console.error('Error processing 1-second chunk:', error);
      setError(`Chunk processing error: ${error.message}`);
      
      // Just reset the buffers and continue recording
      currentChunkBuffers = [];
      chunkStartTime = Date.now();
    }
  };

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Start from stored duration if resuming, otherwise from 0
    const initialTime = isPaused ? recordingDuration : 0;
    setRecordingTime(initialTime);
    
    const startTime = Date.now() - (initialTime * 1000); // Adjust start time for resuming
    
    timerRef.current = setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      setRecordingTime(elapsedTime);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      // For both platforms, check permissions
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        console.log('No permission to record');
        return;
      }
      
      setIsStartingRecording(true);
      
      // Reset for new recording
      setTranscription('');
      setError(null);
      audioChunksRef.current = [];
      sequenceNumber.current = 0;
      currentChunkBuffers = [];
      chunkStartTime = Date.now();
      chunkCounter = 0;
      websocketReady = false; // Reset websocket ready flag
      
      // Ensure proper cleanup before starting
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      // Clear any existing timers
      if (timerIdsRef.current && timerIdsRef.current.length > 0) {
        timerIdsRef.current.forEach(timerId => clearInterval(timerId));
        timerIdsRef.current = [];
      }
      
      // Connect to WebSocket
      connectToWebSocket();
      
      // Reinitialize audio recorder with fresh settings
      const initialized = await initializeAudioRecorder();
      if (!initialized) {
        console.error('Failed to initialize audio recorder');
        Alert.alert(
          'Recording Error',
          'Could not initialize audio recorder. Please try again.',
          [{ text: 'OK' }]
        );
        setIsStartingRecording(false);
        return;
      }
      
      // Start recording
      console.log('Starting audio recording...');
      try {
        AudioRecord.start();
        setRecording(true);
        setShowActionButtons(true); // Show action buttons when recording starts
        startTimer();
        
        // Start pulse animation
        startPulseAnimation();
        
        setIsStartingRecording(false);
      } catch (err) {
        console.error('Error starting recording:', err);
        setError(`Could not start recording: ${err.message}`);
        Alert.alert(
          'Recording Error',
          'Could not start recording. Please try again.',
          [{ text: 'OK' }]
        );
        setIsStartingRecording(false);
      }
    } catch (error) {
      console.error('Error in startRecording:', error);
      setError(`Start recording error: ${error.message}`);
      setIsStartingRecording(false);
    }
  };

  const pauseRecording = async () => {
    if (!recording || isPaused) return;
    
    try {
      console.log('Pausing recording...');
      
      // Set paused state
      setIsPaused(true);
      websocketPausedRef.current = true;
      
      // Pause data collection
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      // Pause timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Store current recording duration
      setRecordingDuration(recordingTime);
      
      // Stop animation
      stopPulseAnimation();
      
      // On iOS, actually stop the recorder but don't reset state
      if (Platform.OS === 'ios') {
        try {
          // Save current file path
          const tempPath = await AudioRecord.stop();
          console.log('Raw paused recording path:', tempPath);
          
          // Normalize the path before storing
          const normalizedPath = normalizeFilePath(tempPath);
          console.log('Normalized paused recording path:', normalizedPath);
          
          // Store normalized path
          pausedAudioBufferRef.current.push(normalizedPath);
          
          // Verify the file exists
          const exists = await fileExists(normalizedPath);
          if (exists) {
            console.log('Paused recording exists at path:', normalizedPath);
          } else {
            console.error('Paused recording file not found at:', normalizedPath);
            // Try with the original path as fallback
            const originalExists = await fileExists(tempPath);
            if (originalExists) {
              console.log('Paused recording found at original path:', tempPath);
              pausedAudioBufferRef.current.push(tempPath);
            }
          }
        } catch (error) {
          console.error('Error pausing recording on iOS:', error);
        }
      } else {
        // For Android, we can just stop collecting data by removing the listener
        console.log('Paused recording on Android');
      }
    } catch (error) {
      console.error('Error pausing recording:', error);
      setError(`Pause recording error: ${error.message}`);
    }
  };

  const resumeRecording = async () => {
    if (!recording || !isPaused) return;
    
    try {
      console.log('Resuming recording...');
      
      // Resume recording
      if (Platform.OS === 'ios') {
        // Re-initialize with a fresh file
        await initializeAudioRecorder();
        AudioRecord.start();
      }
      
      // Re-setup listener
      setupAudioListener();
      
      // Resume timer with existing duration
      startTimer();
      
      // Resume animation
      startPulseAnimation();
      
      // Mark as no longer paused
      setIsPaused(false);
      websocketPausedRef.current = false;
    } catch (error) {
      console.error('Error resuming recording:', error);
      setError(`Resume recording error: ${error.message}`);
    }
  };

  const deleteRecording = async () => {
    try {
      console.log('Deleting recording...');
      
      // Stop recording regardless of pause state
      await AudioRecord.stop();
      
      // Clean up any existing subscription
      if (dataSubscription) {
        dataSubscription.remove();
        dataSubscription = null;
      }
      
      // Reset all recording state
      setRecording(false);
      setIsPaused(false);
      setShowActionButtons(false);
      stopTimer();
      setRecordingTime(0);
      setTranscription('Press Mic to start listening');
      stopPulseAnimation();
      
      // Clear stored paths
      pausedAudioBufferRef.current = [];
      audioChunksRef.current = [];
      setAudioPath(null);
      
      // Close WebSocket
      if (websocketConnection) {
        websocketConnection.close();
        websocketConnection = null;
        setIsConnected(false);
      }
      
      console.log('Recording deleted');
      
      // Optionally delete the actual file
      if (audioPath) {
        try {
          const exists = await RNFS.exists(audioPath);
          if (exists) {
            await RNFS.unlink(audioPath);
            console.log('Deleted file:', audioPath);
          }
        } catch (fileError) {
          console.error('Error deleting file:', fileError);
        }
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
      setError(`Delete recording error: ${error.message}`);
    }
  };

  // Helper function to check if user has enough coins for recording duration
  const checkUserCoins = async (userId, duration) => {
    // This would be an API call to your backend to check coin balance
    // For now we'll simulate by always returning true
    console.log('Checking coins for user:', userId, 'Duration:', duration);
    return true;
  };

  // Helper function for decoding base64 strings
  const decode = (base64String) => {
    return Buffer.from(base64String, 'base64');
  };

  const saveRecording = async () => {
    try {
      // First pause if not already paused
      if (!isPaused) {
        await pauseRecording();
      }
      
      setIsUploading(true);
      
      // Use the currently selected language for upload
      // Default to English if using translate mode
      const uploadLanguage = isTranslateMode ? 
        uploadLanguageCodes[selectedLanguage] || 'en-US' : 
        'en-US'; // Default to English
        
      setSelectedLanguageForUpload(uploadLanguage);
      
      // Stop the recording to finalize the file
      console.log('Finalizing recording for save...');
      const filePath = await stopRecording();
      
      if (!filePath) {
        throw new Error('Failed to save audio recording');
      }
      
      console.log('Audio file to upload:', filePath);
      
      // Check file existence one more time before uploading
      const fileExistsResult = await fileExists(filePath);
      if (!fileExistsResult) {
        console.error('File not found before upload:', filePath);
        throw new Error(`File not found at path: ${filePath}`);
      }
      
      // Check if user has enough coins
      const hasEnoughCoins = await checkUserCoins(uid, recordingTime);
      
      if (!hasEnoughCoins) {
        setIsUploading(false);
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
      
      // Upload the audio file with the path that is confirmed to exist
      await uploadAudioFile(filePath, recordingTime);
      
      // Reset states after successful upload
      setRecording(false);
      setIsPaused(false);
      setShowActionButtons(false);
      setTranscription('Press Mic to start listening');
      setRecordingTime(0);
    } catch (error) {
      console.error('Error saving recording:', error);
      Alert.alert('Error', 'Failed to save recording: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadAudioFile = async (filePath, duration) => {
    try {
      console.log('Uploading audio file:', filePath, 'Duration:', duration);
      
      if (!filePath) {
        Alert.alert('Error', 'No file selected');
        return;
      }
      
      // Check if user has enough coins
      const hasEnoughCoins = await checkUserCoins(uid, duration);
      
      if (!hasEnoughCoins) {
        setIsUploading(false);
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

      // Create a file object to match the expected structure
      const file = {
        uri: filePath,
        name: `recording_${Date.now()}.wav`,
        type: 'audio/wav'
      };

      try {
        // Verify file exists before proceeding
        const fileExists = await RNFS.exists(file.uri);
        if (!fileExists) {
          throw new Error(`File does not exist at path: ${file.uri}`);
        }

        // Generate a secure unique ID for the audio file
        const audioID = generateAudioID();
        const audioName = file.name || `audio_${Date.now()}.wav`;
        const fileExtension = 'wav'; // Always use wav for recordings
        
        // Create file path for Supabase storage with original extension
        const filePath = `users/${uid}/audioFile/${audioID}.${fileExtension}`;
        
        // Verify file exists and is accessible
        try {
          const fileExists = await RNFS.exists(file.uri);
          if (!fileExists) {
            throw new Error('File does not exist at the specified path');
          }
          
          // Try to get file stats to ensure it's readable
          const fileStats = await RNFS.stat(file.uri);
          if (!fileStats || fileStats.size <= 0) {
            throw new Error('File appears to be empty or inaccessible');
          }
          
          console.log('File validation passed:', {
            size: fileStats.size,
            lastModified: fileStats.mtime
          });
        } catch (fileError) {
          throw new Error(`File validation failed: ${fileError.message}`);
        }
        
        // Read the file as base64
        const fileContent = await RNFS.readFile(file.uri, 'base64');
        
        // Determine content type from file or extension
        const contentType = file.type || getMimeTypeFromExtension(fileExtension);
        
        // Upload to Supabase storage with original format
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, decode(fileContent), {
            contentType: contentType,
            upsert: false
          });
          
        if (uploadError) {
          console.error('Supabase storage upload error:', {
            message: uploadError.message,
            error: uploadError,
            statusCode: uploadError.statusCode
          });
          throw new Error(`Storage upload error: ${uploadError.message || 'Unknown error'}`);
        }
        
        // Get the public URL for the uploaded file
        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);
          
        // Save metadata to database with file format info
        const { data: metadataData, error: metadataError } = await supabase
          .from('audio_metadata')
          .insert([
            {
              uid,
              audioid: audioID,
              audio_name: audioName,
              language: selectedLanguageForUpload,
              audio_url: publicUrl,
              file_path: filePath,
              duration: parseInt(duration, 10),
              uploaded_at: new Date().toISOString(),
            }
          ]);
          
        if (metadataError) {
          console.error('Supabase metadata insert error:', {
            message: metadataError.message,
            error: metadataError,
            code: metadataError.code,
            details: metadataError.details,
            hint: metadataError.hint
          });
          throw new Error(`Metadata error: ${metadataError.message}`);
        }
        
        // Success handling - but no need to show toast as that's handled elsewhere
        
        // Add a longer delay before navigating to ensure everything is processed
        setTimeout(() => {
          // Navigate to translation screen with the generated audioid
          handlePress({ audioid: audioID });
        }, 1500);
        
        return audioID;
      } catch (error) {
        console.error('Upload error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          file: {
            name: file.name,
            type: file.type,
            uri: file.uri
          }
        });
        
        Alert.alert(
          'Error',
          `Failed to upload file: ${error.message}. Please try again.`
        );
        throw error;
      }
    } catch (error) {
      console.error('Error in uploadAudioFile:', error);
      Alert.alert('Error', 'Failed to save recording: ' + error.message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Add helper functions
  const generateAudioID = () => {
    return uuidv4();
  };

  const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };

  const getMimeTypeFromExtension = (extension) => {
    const mimeTypes = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'm4a': 'audio/m4a',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
    };
    return mimeTypes[extension] || 'application/octet-stream';
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

  const stopRecording = async () => {
    try {
      if (!recording) return null;
      
      // Clear any timers
      if (timerIdsRef.current && timerIdsRef.current.length > 0) {
        timerIdsRef.current.forEach(timerId => clearInterval(timerId));
        timerIdsRef.current = [];
      }
      
      // Stop pulse animation
      stopPulseAnimation();
      
      // Stop recording
      console.log('Stopping recording...');
      let audioFile = await AudioRecord.stop();
      console.log('Raw file path from stop recording:', audioFile);
      
      // Normalize the path to avoid file not found errors
      const normalizedAudioFile = normalizeFilePath(audioFile);
      console.log('Normalized file path:', normalizedAudioFile);
      
      setRecording(false);
      stopTimer();
      
      // Save the audio file path
      setAudioPath(normalizedAudioFile);
      console.log('Final audio file saved to:', normalizedAudioFile);

      // Verify the file exists at the normalized path
      const normalizedExists = await fileExists(normalizedAudioFile);
      if (!normalizedExists) {
        console.error('File does not exist at normalized path:', normalizedAudioFile);
        
        // Try with the original path as a fallback
        const originalExists = await fileExists(audioFile);
        if (originalExists) {
          console.log('Found file at original path:', audioFile);
          setAudioPath(audioFile);
          
          // Send the complete audio file to the WebSocket if connected
          await sendFinalAudioToWebsocket(audioFile);
          return audioFile;
        } else {
          console.error('Audio file not found with either path');
          setError('Audio file not found - please try again');
          return null;
        }
      }

      // Send the complete audio file to the WebSocket if connected
      await sendFinalAudioToWebsocket(normalizedAudioFile);
      return normalizedAudioFile;
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError(`Stop recording error: ${error.message}`);
      return null;
    }
  };

  // Helper function to send final audio to websocket
  const sendFinalAudioToWebsocket = async (audioFilePath) => {
    if (!audioFilePath) return;
    
    if (isConnected && websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
      try {
        // Read the file stats
        const fileStats = await RNFS.stat(audioFilePath);
        console.log('Audio file size:', fileStats.size, 'bytes');
        
        if (fileStats.size > 44) { // WAV header is 44 bytes
          const wavData = await RNFS.readFile(audioFilePath, 'base64');
          const wavBuffer = Buffer.from(wavData, 'base64');
          console.log('Sending final audio file, size:', wavBuffer.length, 'bytes');
          
          // Pass true for isLastChunk to indicate this is the final chunk
          sendAudioChunkToWebSocket(wavBuffer, true);
        } else {
          console.warn('Audio file is too small, might not contain actual audio data');
          setError('No audio data captured - please try again');
        }
      } catch (error) {
        console.error('Error sending final audio file:', error);
        setError(`Error sending final file: ${error.message}`);
      }
    } else {
      console.log('Cannot send final audio - WebSocket not connected');
      setError('WebSocket connection lost - please try again');
    }
  };

  const connectToWebSocket = () => {
    // Already connected or connecting
    if (isConnected || isConnecting) return;
    
    try {
      setIsConnecting(true);
      websocketReady = false; // Reset websocket ready flag
      
      // Generate a new UUID for this connection
      connectIdRef.current = uuidv4();
      
      // Use the fluid model WebSocket endpoint
      const wsUrl = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
      
      websocketConnection = new WebSocket(wsUrl, [], {
        headers: {
          'X-Api-App-Key': '9071641778',  // APP ID
          'X-Api-Access-Key': 'HqHv8-dzJV66g_027jbu1gxaKzqwp6gl',  // Access Token
          'X-Api-Resource-Id': 'volc.bigasr.sauc.duration',  // Resource ID for the hourly version
          'X-Api-Connect-Id': connectIdRef.current,  // Connection tracking ID
        }
      });
      
      websocketConnection.binaryType = 'arraybuffer';
      
      websocketConnection.onopen = () => {
        console.log('WebSocket connection opened');
        setIsConnected(true);
        setIsConnecting(false);
        
        // Send initial request with parameters
        sendInitialRequest();
      };
      
      websocketConnection.onmessage = (event) => {
        // Set the ready flag after receiving first message from server
        // This indicates the WebSocket has successfully established bidirectional communication
        if (!websocketReady) {
          console.log('WebSocket is now ready to receive audio data');
          websocketReady = true;
        }
        
        handleWebSocketMessage(event.data);
      };
      
      websocketConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError(`WebSocket error: ${error.message || 'Unknown error'}`);
        setIsConnected(false);
        setIsConnecting(false);
        websocketReady = false;
      };
      
      websocketConnection.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        websocketReady = false;
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setError(`WebSocket connection error: ${error.message}`);
      setIsConnected(false);
      setIsConnecting(false);
      websocketReady = false;
    }
  };

  const sendInitialRequest = () => {
    if (!websocketConnection || websocketConnection.readyState !== WebSocket.OPEN) {
      console.error('Cannot send initial request, WebSocket not open');
      return;
    }
    
    try {
      // Prepare the request parameters
      const requestParams = {
        user: {
          uid: `user_${Date.now()}`,
          platform: Platform.OS,
        },
        audio: {
          format: 'wav',  // Changed back to WAV format
          rate: 16000,
          bits: 16,
          channel: 1,
        },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          enable_ddc: true,
          show_utterances: true,
          vad_segment_duration: 1500,
          end_window_size: 600,
        },
      };
      const azureEndpoint = 'https://api.cognitive.microsofttranslator.com';
      const azureKey = '21oYn4dps9k7VJUVttDmU3oigC93LUtyYB9EvQatENmWOufZa4xeJQQJ99ALACYeBjFXJ3w3AAAbACOG0HQP'; // Replace with your Azure API Key
      const languages = Object.keys(languageCodes);
      const region = 'eastus';
      // Convert to JSON string and log it for debugging
      const jsonParams = JSON.stringify(requestParams);
      console.log('Initial request params:', jsonParams);
      
      // Compress the JSON string using GZIP
      const compressedParams = pako.gzip(jsonParams);
      
      // Create the header - 4 bytes as described in the documentation
      const headerBuffer = new ArrayBuffer(4);
      const headerView = new DataView(headerBuffer);
      
      // Set header values
      // Format: 4 bits version (0001), 4 bits header size (0001), 
      // 4 bits message type (0001), 4 bits message flags (0000),
      // 4 bits serialization (0001), 4 bits compression (0001), 8 bits reserved (00000000)
      headerView.setUint8(0, (1 << 4) | 1); // Version & Header size
      headerView.setUint8(1, (1 << 4) | 0); // Message type & Message flags
      headerView.setUint8(2, (1 << 4) | 1); // Serialization & Compression
      headerView.setUint8(3, 0); // Reserved
      
      // Create payload size (4 bytes)
      const payloadSizeBuffer = new ArrayBuffer(4);
      const payloadSizeView = new DataView(payloadSizeBuffer);
      payloadSizeView.setUint32(0, compressedParams.length, false); // Set as big-endian
      
      // Combine all parts into a single buffer
      const finalBuffer = new Uint8Array(headerBuffer.byteLength + payloadSizeBuffer.byteLength + compressedParams.length);
      finalBuffer.set(new Uint8Array(headerBuffer), 0);
      finalBuffer.set(new Uint8Array(payloadSizeBuffer), headerBuffer.byteLength);
      finalBuffer.set(compressedParams, headerBuffer.byteLength + payloadSizeBuffer.byteLength);
      
      // Send the binary message
      websocketConnection.send(finalBuffer);
      console.log('Sent initial request');
    } catch (error) {
      console.error('Error sending initial request:', error);
      setError(`Error sending initial request: ${error.message}`);
    }
  };

  const sendAudioChunkToWebSocket = (chunk, isLastChunk = false) => {
    if (!websocketConnection || websocketConnection.readyState !== WebSocket.OPEN) {
      console.error('[WebSocket] Cannot send audio chunk, WebSocket not open');
      return false;
    }
    
    try {
      console.log(`[WebSocket] Processing ${chunk.length} bytes audio chunk, isLastChunk: ${isLastChunk}`);
      
      // Check if it's a valid WAV file (should have RIFF header)
      const isWavFile = chunk.length > 12 && 
                        chunk.toString('ascii', 0, 4) === 'RIFF' && 
                        chunk.toString('ascii', 8, 12) === 'WAVE';
      
      console.log(`[WebSocket] Audio format check: ${isWavFile ? 'WAV file' : 'PCM data'}`);
      
      // For iOS, we are directly reading WAV files, so we don't need to convert
      let dataToSend = chunk;
      
      if (!isWavFile && Platform.OS === 'android') {
        // Convert PCM to WAV for Android 
        console.log('[WebSocket] Converting PCM to WAV for Android');
        dataToSend = createWavFile(chunk);
      }
      
      // Ensure we have valid data to send
      if (!dataToSend || dataToSend.length <= 44) { // WAV header is 44 bytes
        console.warn('[WebSocket] No valid audio data to send');
        return false;
      }
      
      try {
        // Compress the audio chunk using GZIP
        const compressedChunk = pako.gzip(dataToSend);
        console.log(`[WebSocket] Compressed to ${compressedChunk.length} bytes from ${dataToSend.length}`);
        
        // Create the header - 4 bytes
        const headerBuffer = new ArrayBuffer(4);
        const headerView = new DataView(headerBuffer);
        
        // Set header values
        // Format: 4 bits version (0001), 4 bits header size (0001), 
        // 4 bits message type (0010 for audio), 4 bits message flags (0000 or 0010 for last chunk),
        // 4 bits serialization (0000), 4 bits compression (0001), 8 bits reserved (00000000)
        headerView.setUint8(0, (1 << 4) | 1); // Version & Header size
        // For last chunk, set the second bit in message flags (0010)
        headerView.setUint8(1, (2 << 4) | (isLastChunk ? 2 : 0)); // Message type & Message flags
        headerView.setUint8(2, (0 << 4) | 1); // Serialization & Compression
        headerView.setUint8(3, 0); // Reserved
        
        // Create payload size (4 bytes)
        const payloadSizeBuffer = new ArrayBuffer(4);
        const payloadSizeView = new DataView(payloadSizeBuffer);
        payloadSizeView.setUint32(0, compressedChunk.length, false); // Set as big-endian
        
        // Combine all parts into a single buffer
        const finalBuffer = new Uint8Array(headerBuffer.byteLength + payloadSizeBuffer.byteLength + compressedChunk.length);
        finalBuffer.set(new Uint8Array(headerBuffer), 0);
        finalBuffer.set(new Uint8Array(payloadSizeBuffer), headerBuffer.byteLength);
        finalBuffer.set(compressedChunk, headerBuffer.byteLength + payloadSizeBuffer.byteLength);
        
        // Send the binary message
        websocketConnection.send(finalBuffer);
        console.log(`[WebSocket] Sent ${finalBuffer.length} bytes ${isLastChunk ? 'FINAL' : 'chunk'}`);
        
        if (isLastChunk) {
          console.log('[WebSocket] Sent last audio chunk');
        }
        
        return true;
      } catch (compressionError) {
        console.error('[WebSocket] Error compressing/sending audio chunk:', compressionError);
        return false;
      }
    } catch (error) {
      console.error('[WebSocket] Error processing audio chunk:', error);
      setError(`Error sending audio chunk: ${error.message}`);
      return false;
    }
  };

  const handleWebSocketMessage = (data) => {
    try {
      // Parse the binary message
      const dataView = new DataView(data);
      
      // Extract header information
      const header1 = dataView.getUint8(0);
      const header2 = dataView.getUint8(1);
      const header3 = dataView.getUint8(2);
      
      // Extract fields from headers
      const messageType = (header2 >> 4) & 0x0F;
      const messageFlags = header2 & 0x0F;
      const compression = header3 & 0x0F;
      
      console.log(`[WebSocket] Received message: type=${messageType}, flags=${messageFlags}, compression=${compression}`);
      
      // Check for error message (messageType === 15)
      if (messageType === 15) {
        const errorCode = dataView.getUint32(4, false); // Big-endian
        const errorMessageSize = dataView.getUint32(8, false); // Big-endian
        
        // Extract error message text using Buffer instead of TextDecoder
        const errorMessageBytes = new Uint8Array(data, 12, errorMessageSize);
        const errorMessage = decodeUTF8(errorMessageBytes);
        
        console.error('[WebSocket] Error from server:', errorCode, errorMessage);
        setError(`Server error: ${errorMessage} (Code: ${errorCode})`);
        return;
      }
      
      // Check for server response (messageType === 9)
      if (messageType === 9) {
        // Extract sequence number (4 bytes)
        const sequenceNumber = dataView.getUint32(4, false); // Big-endian
        
        // Extract payload size (4 bytes)
        const payloadSize = dataView.getUint32(8, false); // Big-endian
        
        console.log(`[WebSocket] Response: seq=${sequenceNumber}, payloadSize=${payloadSize}`);
        
        // Extract compressed payload
        const compressedPayload = new Uint8Array(data, 12, payloadSize);
        
        // Decompress the payload if it's compressed
        let jsonText;
        if (compression === 1) {
          try {
            // Decompress using pako
            const decompressedPayload = pako.ungzip(compressedPayload);
            // Use Buffer instead of TextDecoder
            jsonText = decodeUTF8(decompressedPayload);
          } catch (error) {
            console.error('[WebSocket] Error decompressing payload:', error);
            setError(`Decompression error: ${error.message}`);
            return;
          }
        } else {
          // Not compressed, use Buffer instead of TextDecoder
          jsonText = decodeUTF8(compressedPayload);
        }
        
        // Parse the JSON payload
        const responseData = JSON.parse(jsonText);
        console.log('[WebSocket] Received response:', JSON.stringify(responseData));
        
        // Update the transcription
        if (responseData.result && responseData.result.text) {
          setTranscription(prev => prev + ' ' + responseData.result.text);
          console.log('[WebSocket] Updated transcription with text:', responseData.result.text);
        }

        // Also check for utterances if show_utterances was enabled
        if (responseData.result && 
            responseData.result.utterances && 
            responseData.result.utterances.length > 0) {
          
          // Log all utterances for debugging
          responseData.result.utterances.forEach(utterance => {
            console.log(`[WebSocket] Utterance: ${utterance.text} (${utterance.definite ? 'definite' : 'interim'})`);
          });
          
          // Display the transcription based on all utterances
          const allText = responseData.result.utterances
            .map(u => u.text)
            .join(' ');
          
          if (allText.trim()) {
            setTranscription(allText);
            console.log('[WebSocket] Set transcription from utterances:', allText);
          }
        }
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
      setError(`Error handling message: ${error.message}`);
    }
  };

  // Add translation related functions
  const translateText = async (inputText) => {
    // Validate input text
    if (!inputText || inputText.trim().length === 0) {
      setTranslatedText('');
      return;
    }

    // Don't translate if translate mode is off
    if (!isTranslateMode) {
      return;
    }

    // Validate target language is selected
    if (!selectedLanguage2) {
      setTranslatedText('Please select a target language');
      return;
    }

    // Get current target language code fresh each time
    const currentTargetLanguage = languageCodes[selectedLanguage2];
    if (!currentTargetLanguage) {
      console.error('Invalid target language:', selectedLanguage2);
      setTranslatedText(`Invalid target language: ${selectedLanguage2}`);
      return;
    }
    
    console.log('Translating text:', inputText);
    console.log('Target language:', selectedLanguage2, 'Code:', currentTargetLanguage);
    
    // Define Azure API constants
    const azureEndpoint = 'https://api.cognitive.microsofttranslator.com';
    const azureKey = '21oYn4dps9k7VJUVttDmU3oigC93LUtyYB9EvQatENmWOufZa4xeJQQJ99ALACYeBjFXJ3w3AAAbACOG0HQP';
    const region = 'eastus';

    // Validate Azure configuration
    if (!azureEndpoint || !azureKey || !region) {
      console.error('Azure translation configuration missing');
      setTranslatedText('Translation service not configured');
      return;
    }

    let retries = 3;
    while (retries > 0) {
      try {
          const response = await axios.post(
          `${azureEndpoint}/translate?api-version=3.0&from=${languageCodes[selectedLanguage]}&to=${currentTargetLanguage}`,
          [{
            Text: inputText
          }],
          {
            headers: {
              'Ocp-Apim-Subscription-Key': azureKey,
              'Ocp-Apim-Subscription-Region': region,
              'Content-Type': 'application/json',
              'X-ClientTraceId': generateSimpleUUID(), // Add unique trace ID
              'X-ForceTranslation': 'true' // Force translation to target language
            },
            params: {
              from: languageCodes[selectedLanguage],
              to: currentTargetLanguage
            },
            timeout: 5000
          }
        );

        if (!response.data || !response.data[0] || !response.data[0].translations) {
          throw new Error('Invalid translation response format');
        }

        const translation = response.data[0].translations[0].text;
        if (!translation) {
          throw new Error('Empty translation received');
        }

        // Verify the translation language matches the target language
        const detectedLanguage = response.data[0].detectedLanguage?.language;
        if (detectedLanguage && detectedLanguage !== currentTargetLanguage) {
          console.error('Translation language mismatch:', 
            `Expected ${currentTargetLanguage}, got ${detectedLanguage}`);
          throw new Error('Translation language mismatch');
        }

        console.log('Translation successful:', translation);
        setTranslatedText(translation);
        return; // Success - exit the retry loop
      } catch (error) {
        retries--;
        console.error(`Translation attempt failed (${retries} retries left):`, 
          error.response ? error.response.data : error.message);

        if (retries === 0) {
          setTranslatedText('Translation failed - please try again');
          return;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  const handleCopyText = () => {
    Clipboard.setString(translatedText);
    Alert.alert('Success', 'Text copied to clipboard!');
  };

  const handleShareText = async () => {
    try {
      await Share.share({
        message: translatedText,
      });
    } catch (error) {
      console.error('Error sharing text:', error);
    }
  };

  const toggleTranslateMode = () => {
    const newMode = !isTranslateMode;
    setIsTranslateMode(newMode);
    
    Animated.timing(slideAnimation, {
      toValue: newMode ? 0 : 300,
      duration: 500,
      useNativeDriver: true,
    }).start();
    
    if (!newMode) {
      setTranslatedText('');
    } else if (transcription && transcription !== 'Press Mic to start listening' && transcription !== 'Listening...') {
      translateText(transcription);
    }
  };

  const swapLanguages = async () => {
    const temp = selectedLanguage;
    setSelectedLanguage(selectedLanguage2);
    setSelectedLanguage2(temp);
    
    if (transcription && transcription !== 'Press Mic to start listening' && transcription !== 'Listening...') {
      await translateText(transcription);
    }
  };

  const updateLanguage = async (language, isSourceLanguage) => {
    if (isSourceLanguage) {
      setSelectedLanguage(language);
    } else {
      setSelectedLanguage2(language);
      if (transcription && transcription !== 'Press Mic to start listening') {
        await translateText(transcription);
      }
    }
  };

  // Add animation functions
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 0.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back, Copy, Share */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Image source={require('../assets/back.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <View style={styles.rightHeader}>
          {isTranslateMode && (
            <>
              <TouchableOpacity onPress={handleCopyText}>
                <Image source={require('../assets/copy.png')} style={styles.icon3} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareText}>
                <Image source={require('../assets/share.png')} style={styles.icon3} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity 
            onPress={toggleTranslateMode} 
            style={[styles.translateButton, isTranslateMode && styles.activeTranslateButton]}
          >
            <Image 
              source={require('../assets/Translate.png')} 
              style={[styles.icon4, isTranslateMode && styles.activeIcon]} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Blue Section */}
      <View style={styles.topSection}>
        <View style={styles.container2}>
          <View style={styles.languageSwitcher}>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => {
                setEditingLanguage('source');
                setLanguageModalVisible(true);
              }}
            >
              <Text style={styles.languageText}>{selectedLanguage}</Text>
            </TouchableOpacity>
            
            {isTranslateMode && (
              <>
                <TouchableOpacity style={styles.swapButton} onPress={swapLanguages}>
                  <Image
                    source={require('../assets/Change.png')}
                    style={styles.swapIcon}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.languageButton}
                  onPress={() => {
                    setEditingLanguage('target');
                    setLanguageModalVisible(true);
                  }}
                >
                  <Text style={styles.languageText}>{selectedLanguage2}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
  
        <ScrollView style={{ height: 280 }}>
          <Text style={styles.documentText}>{transcription}</Text>
        </ScrollView>
      </View>

      {/* Animated Circle Behind Mic Icon */}
      <Animated.View
        style={[
          styles.circle,
          {
            opacity: circleAnimation,
            transform: [
              {
                scale: circleAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.5],
                }),
              },
            ],
          },
        ]}
      />

      {/* Sliding White Section - Only visible in translate mode */}
      <Animated.View style={[styles.bottomSection, { transform: [{ translateY: slideAnimation }] }]}>
        <ScrollView contentContainerStyle={styles.scrollView}>
          <Text style={styles.translatedText}>{translatedText || 'Translated Text'}</Text>
        </ScrollView>
      </Animated.View>

      {/* Floating mic button */}
      <View style={styles.floatingMicContainer}>
        {recording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingHeader}>
              <Animated.View 
                style={[styles.recordingDot, { opacity: pulseAnimation }]} 
              />
              <Text style={styles.recordingTimer}>
                {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:
                {(recordingTime % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        )}
        
        {recording ? (
          <>
            {/* When recording is active, show pause/play button */}
            <TouchableOpacity 
              style={[styles.floatingMicButton, recording && styles.recordingActive]} 
              onPress={isPaused ? resumeRecording : pauseRecording}
              disabled={isUploading}
            >
              <Image 
                source={isPaused ? require('../assets/play.png') : require('../assets/pause.png')} 
                style={styles.icon} 
              />
            </TouchableOpacity>
            
            {/* Show delete and tick buttons when recording */}
            {showActionButtons && (
              <>
                {/* Delete button */}
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]} 
                  onPress={deleteRecording}
                  disabled={isUploading}
                >
                  <Image 
                    source={require('../assets/remove.png')} 
                    style={styles.smallIcon} 
                  />
                </TouchableOpacity>
                
                {/* Tick/Save button */}
                <TouchableOpacity 
                  style={[styles.actionButton, styles.tickButton]} 
                  onPress={saveRecording}
                  disabled={isUploading}
                >
                  <Image 
                    source={require('../assets/Tick.png')} 
                    style={styles.smallIcon} 
                  />
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <TouchableOpacity 
            style={[styles.floatingMicButton, recording && styles.recordingActive]} 
            onPress={recording ? stopRecording : startRecording}
            disabled={isUploading || isStartingRecording}
          >
            {isUploading || isStartingRecording ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Image 
                source={require('../assets/mic3.png')} 
                style={styles.icon} 
              />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {/* Loading overlay during upload */}
      {isUploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Uploading...</Text>
        </View>
      )}

      {/* Language Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={languageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={Object.keys(languageCodes)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.languageOption}
                  onPress={() => {
                    updateLanguage(item, editingLanguage === 'source');
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text style={styles.languageOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    position: 'relative',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 45,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#007bff',
  },
  header: {
    flexDirection: 'row',
    paddingTop: 20,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  icon: {
    width: 34,
    height: 34,
    tintColor: '#ffffff',
  },
  icon2: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  icon3: {
    width: 24,
    height: 24,
    tintColor: '#ffffff',
    marginLeft:10,
  },
  icon4: {
    width: 24,
    height: 24,
    tintColor: '#ffffff',
  
  },
  rightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSection: {
    paddingTop: 45,
    paddingHorizontal: 20,
    backgroundColor: '#007bff',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',

  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  languageSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 8,
    width: '80%',
    height:50,
    position: 'relative', // Required for absolute positioning of the swap button
  },
  languageButton: {
    paddingHorizontal: 26,
    flex: 1, // Allow buttons to take equal space
    alignItems: 'center', // Center text horizontally
  },
  languageText: {
    fontSize: 16,
    color: '#000',
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007bff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute', // Position the swap button absolutely
    left: '50%', // Move to the horizontal center
    top: '50%', // Move to the vertical center
    transform: [{ translateX: -10 }, { translateY: -10 }], // Adjust for button size
  },
  container2: {
    flex: 1,
    justifyContent: 'center', // Center vertically
    alignItems: 'center', // Center horizontally
  },
  swapIcon: {
    width: 20,
    height: 20,
    tintColor: '#fff',
  },
  documentText: {
    fontSize: 20,
    color: '#fff',
    marginTop: 30,
  },
  bottomSection: {
    flex: 1,
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '50%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  scrollView: {
    paddingVertical: 10,
  },
  translatedText: {
    fontSize: 18,
    color: '#555',
  },
  circle: {
    position: 'absolute',
    bottom: 100, // Adjust the distance from the mic button
    left: '50%',
    width: 90, // A bit larger than mic button
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 123, 255, 0.3)',
    transform: [{ translateX: -45 }],
    zIndex: 0, // Ensure it is behind the mic button
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  languageOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  languageOptionText: {
    fontSize: 18,
  },
  closeButton: {
    marginTop: 20,
    alignSelf: 'center',
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  translateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E26C05FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    resizeMode: 'cover',
  },
  activeTranslateButton: {
    backgroundColor: '#0056b3',
  },
  activeIcon: {
    tintColor: '#fff',
  },
  floatingMicContainer: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingMicButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    left: -60, // Position to the left of the mic button
  },
  deleteButton2: {  
    backgroundColor: '#ff3b30',
    // Position to the left of the mic button
    left: 60,
  },
  tickButton: {
    backgroundColor: '#4cd964',
    right: -60, // Position to the right of the mic button
  },
  tickButton2: {
    backgroundColor: '#4cd964',
    // Position to the right of the mic button
    right: 60,
  },
  smallIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  recordingIndicator: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
   
    width: 200,
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',

  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
 

    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
    marginRight: 8,
  },
  recordingTimer: {
    fontSize: 14,
    fontWeight: 'bold',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#ffffff',
    marginBottom: 4,
  },
  recordingTimeLeft: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 2,
  },
  recordingActive: {
    backgroundColor: '#ff3b30', // Red color when recording
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
});

export default LiveTranscriptionScreen; 