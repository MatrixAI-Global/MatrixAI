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
  
  // Refs
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const sequenceNumber = useRef(0);
  const connectIdRef = useRef(uuidv4());
  const soundRef = useRef(null);

  // Add new state variables for translation features
  const [isTranslateMode, setIsTranslateMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedLanguage2, setSelectedLanguage2] = useState('Spanish');
  const [translatedText, setTranslatedText] = useState('');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState('source');
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [circleAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [slideAnimation] = useState(new Animated.Value(300));
  const [isUploading, setIsUploading] = useState(false);

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

  useEffect(() => {
    // Initialize
    const setup = async () => {
      const hasPermission = await checkPermission();
      if (hasPermission) {
        await initializeAudioRecorder();
      } else {
        console.log('Permission not granted in initial setup');
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
        // iOS
        const result = await check(PERMISSIONS.IOS.MICROPHONE);
        console.log('iOS permission check result:', result);
        
        if (result === RESULTS.GRANTED) {
          setPermissionGranted(true);
          return true;
        } else if (result === RESULTS.DENIED) {
          const requestResult = await request(PERMISSIONS.IOS.MICROPHONE);
          console.log('iOS permission request result:', requestResult);
          const isGranted = requestResult === RESULTS.GRANTED;
          setPermissionGranted(isGranted);
          return isGranted;
        } else if (result === RESULTS.BLOCKED) {
          // Permission is blocked, prompt to open settings
          Alert.alert(
            'Microphone Permission Required',
            'This app needs access to your microphone. Please enable microphone permission in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => openSettings() }
            ]
          );
          setPermissionGranted(false);
          return false;
        } else {
          // UNAVAILABLE - very rare case
          Alert.alert(
            'Microphone Unavailable',
            'The microphone is not available on this device.',
            [{ text: 'OK' }]
          );
          setPermissionGranted(false);
          return false;
        }
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setError(`Permission error: ${error.message}`);
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
      
      // iOS requires specific configurations to work properly
      const options = {
        sampleRate: 16000,  // 16kHz as required by API
        channels: 1,        // Mono
        bitsPerSample: 16,  // 16-bit
        audioSource: Platform.OS === 'android' ? 6 : 0,  // MIC source type
        // For iOS, we explicitly set a wav file path to ensure audio is captured
        wavFile: Platform.OS === 'ios' 
          ? `${RNFS.DocumentDirectoryPath}/recording.wav` 
          : '',
      };
      
      console.log('Initializing AudioRecord with options:', JSON.stringify(options));
      
      // Initialize with a promise wrapper to handle exceptions better
      await new Promise((resolve, reject) => {
        try {
          AudioRecord.init(options);
          resolve();
        } catch (error) {
          console.error('Error in AudioRecord.init():', error);
          reject(error);
        }
      });
      
      // For iOS, we'll use a file-based approach
      if (Platform.OS === 'ios') {
        console.log('Using file-based audio capture approach for iOS');
        // No need to setup listener for iOS
        return true;
      }
      
      // Setup the listener after initialization (Android only)
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

      // Set up new listener - use a single string parameter for the event name
      dataSubscription = AudioRecord.on('data', data => {
        try {
          // Log data receipt for debugging
          console.log('Audio data received, length:', data.length);
          
          // Convert base64 data to raw binary buffer
          const chunk = Buffer.from(data, 'base64');
          console.log('Raw chunk size', chunk.byteLength);
          
          if (chunk.byteLength > 0) {
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
            console.warn('Warning: Received empty audio chunk');
          }
        } catch (error) {
          console.error('Error in data listener:', error);
          setError(`Audio data error: ${error.message}`);
        }
      });
      
      console.log('Audio listener setup complete');
    } catch (error) {
      console.error('Error setting up audio listener:', error);
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
    
    setRecordingTime(0);
    const startTime = Date.now();
    
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
      // Check permission first
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        console.log('No permission to record');
        return;
      }
      
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
        return;
      }
      
      // Start recording - add a slight delay to ensure initialization is complete
      setTimeout(() => {
        try {
          console.log('Starting audio recording...');
          AudioRecord.start();
          setRecording(true);
          startTimer();
          
          // For iOS, since we don't use the event listener, we'll periodically check 
          // for audio data using a timer
          if (Platform.OS === 'ios') {
            startIOSAudioTimer();
          }
        } catch (err) {
          console.error('Error starting recording:', err);
          setError(`Could not start recording: ${err.message}`);
          Alert.alert(
            'Recording Error',
            'Could not start recording. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }, 500);
    } catch (error) {
      console.error('Error in startRecording:', error);
      setError(`Start recording error: ${error.message}`);
    }
  };

  // For iOS, use a timer-based approach to check for audio data
  const startIOSAudioTimer = () => {
    let tempFilePath = `${RNFS.DocumentDirectoryPath}/recording.wav`;
    let isProcessing = false;
    let lastProcessTime = Date.now();
    let processingAttempts = 0;
    
    console.log('[iOS Audio] Starting iOS audio timer with file path:', tempFilePath);
    
    const audioCheckInterval = setInterval(async () => {
      if (!recording) {
        console.log('[iOS Audio] Recording stopped, clearing interval');
        clearInterval(audioCheckInterval);
        return;
      }
      
      if (isProcessing) {
        console.log('[iOS Audio] Still processing previous chunk, skipping');
        return;
      }
      
      // Only process audio every 2 seconds
      const currentTime = Date.now();
      if (currentTime - lastProcessTime < 2000) {
        return;
      }
      
      processingAttempts++;
      console.log(`[iOS Audio] Processing attempt #${processingAttempts}`);
      lastProcessTime = currentTime;
      
      try {
        // Mark as processing to prevent overlapping operations
        isProcessing = true;
        
        // Temporarily stop recording to capture the chunk
        console.log('[iOS Audio] Pausing recording to capture audio chunk...');
        const audioFilePath = await AudioRecord.stop();
        console.log('[iOS Audio] Recording paused, checking file at:', audioFilePath || tempFilePath);
        
        // Check if the file exists
        const fileExists = await RNFS.exists(audioFilePath || tempFilePath);
        console.log('[iOS Audio] File exists:', fileExists);
        
        if (fileExists) {
          // Get stats to check file size
          const fileStats = await RNFS.stat(audioFilePath || tempFilePath);
          console.log('[iOS Audio] Audio file stats:', JSON.stringify(fileStats));
          
          if (fileStats.size > 44) { // WAV header is 44 bytes, so anything larger has audio data
            console.log('[iOS Audio] Found audio data, file size:', fileStats.size);
            
            try {
              // Read the file
              const audioBase64 = await RNFS.readFile(audioFilePath || tempFilePath, 'base64');
              console.log('[iOS Audio] Read audio file, base64 length:', audioBase64.length);
              
              if (audioBase64 && audioBase64.length > 0) {
                // Convert to buffer
                const audioBuffer = Buffer.from(audioBase64, 'base64');
                
                // Add some basic verification
                if (audioBuffer.length > 44) {
                  // Verify it's a valid WAV file
                  const isWavFile = audioBuffer.toString('ascii', 0, 4) === 'RIFF' && 
                                    audioBuffer.toString('ascii', 8, 12) === 'WAVE';
                  
                  console.log('[iOS Audio] WAV verification:', isWavFile ? 'Valid WAV file' : 'NOT a valid WAV file');
                  
                  if (isWavFile) {
                    // Send to WebSocket directly
                    if (websocketReady && websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
                      console.log('[iOS Audio] Sending WAV chunk to WebSocket, size:', audioBuffer.length);
                      const result = sendAudioChunkToWebSocket(audioBuffer, false);
                      console.log('[iOS Audio] Send result:', result);
                    } else {
                      console.log('[iOS Audio] WebSocket not ready to receive audio. Ready:', websocketReady, 
                                  'Connection:', websocketConnection ? 'exists' : 'null', 
                                  'State:', websocketConnection ? websocketConnection.readyState : 'N/A');
                    }
                  } else {
                    console.warn('[iOS Audio] Audio buffer is not a valid WAV file');
                  }
                } else {
                  console.log('[iOS Audio] Audio buffer too small (only header):', audioBuffer.length);
                }
              }
            } catch (readError) {
              console.error('[iOS Audio] Error reading audio file:', readError);
            }
          } else {
            console.log('[iOS Audio] Audio file exists but contains no audio data (size:', fileStats.size, ')');
          }
        } else {
          console.log('[iOS Audio] Audio file not found:', audioFilePath || tempFilePath);
        }
        
        // Restart recording with a clean file
        try {
          // Delete the old file to ensure we get fresh data
          if (fileExists) {
            await RNFS.unlink(audioFilePath || tempFilePath)
              .then(() => console.log('[iOS Audio] File deleted'))
              .catch(err => console.log('[iOS Audio] Error deleting file:', err));
          }
        } catch (e) {
          console.log('[iOS Audio] Error handling file:', e);
        }
        
        // Restart recording
        console.log('[iOS Audio] Restarting audio recording...');
        AudioRecord.start();
        isProcessing = false;
      } catch (error) {
        console.error('[iOS Audio] Error in iOS audio timer:', error);
        // Make sure to restart recording even if there's an error
        try {
          AudioRecord.start();
        } catch (e) {
          console.error('[iOS Audio] Failed to restart recording after error:', e);
        }
        isProcessing = false;
      }
    }, 500); // Check frequently, but we'll only process every 2 seconds
    
    // Store the interval ID for cleanup
    timerIdsRef.current = [...(timerIdsRef.current || []), audioCheckInterval];
  };
  
  // Add this at the top with other refs
  const timerIdsRef = useRef([]);
  
  // Update stopRecording to clean up iOS timers
  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      // Clear any iOS audio check timers
      if (timerIdsRef.current && timerIdsRef.current.length > 0) {
        timerIdsRef.current.forEach(timerId => clearInterval(timerId));
        timerIdsRef.current = [];
      }
      
      // Stop recording
      const audioFile = await AudioRecord.stop();
      setRecording(false);
      stopTimer();
      
      // Save the audio file path
      setAudioPath(audioFile);
      console.log('Final audio file saved to:', audioFile);

      // Send the complete WAV file to the WebSocket
      if (isConnected && websocketConnection && websocketConnection.readyState === WebSocket.OPEN) {
        try {
          // Read the final WAV file that includes all audio
          const wavData = await RNFS.readFile(audioFile, 'base64');
          const wavBuffer = Buffer.from(wavData, 'base64');
          console.log('Sending final WAV file, size:', wavBuffer.length);
          // Pass true for isLastChunk to indicate this is the final chunk
          sendAudioChunkToWebSocket(wavBuffer, true);
        } catch (error) {
          console.error('Error sending final WAV file:', error);
          setError(`Error sending final file: ${error.message}`);
        }
      } else {
        console.log('Cannot send final audio - WebSocket not connected');
        setError('WebSocket connection lost - please try again');
      }
      
      return audioFile;
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError(`Stop recording error: ${error.message}`);
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

  // Add a helper function to generate UUID
  const generateSimpleUUID = () => {
    return uuidv4();
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
        <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.goBack()}>
          <Image source={require('../assets/back.png')} style={styles.icon2} />
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
        
        <TouchableOpacity 
          style={[styles.floatingMicButton, recording && styles.recordingActive]} 
          onPress={recording ? stopRecording : startRecording}
        >
          <Image 
            source={recording ? require('../assets/pause.png') : require('../assets/mic3.png')} 
            style={styles.icon} 
          />
        </TouchableOpacity>
      </View>

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
  floatingActionButton: {
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
    alignItems: 'center',
    width: 200,
  },
  recordingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
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
    color: '#ffffff',
    marginBottom: 4,
  },
  recordingTimeLeft: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 2,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    position: 'absolute',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

export default LiveTranscriptionScreen; 