import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Platform, PermissionsAndroid, Alert, ActivityIndicator } from 'react-native';
import { Buffer } from 'buffer';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import Sound from 'react-native-sound';
import AudioRecord from 'react-native-audio-record';
import RNFS from 'react-native-fs';

let sound = null;
let dataSubscription = null;

const AudioRecordScreen = () => {
    const [audioFile, setAudioFile] = useState('');
    const [recording, setRecording] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [paused, setPaused] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [waveformData, setWaveformData] = useState([]);
    const [debugMessage, setDebugMessage] = useState('');
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const checkPermission = async () => {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: "App Microphone Permission",
                        message: "This App needs access to your microphone so you can record audio.",
                        buttonNeutral: "Ask Me Later",
                        buttonNegative: "Cancel",
                        buttonPositive: "OK"
                    }
                );
                const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
                setPermissionGranted(isGranted);
                return isGranted;
            } else {
                const micPermission = PERMISSIONS.IOS.MICROPHONE;
                const result = await check(micPermission);
                
                if (result === RESULTS.GRANTED) {
                    setPermissionGranted(true);
                    return true;
                }
                
                return requestPermission();
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
            setDebugMessage(`Permission error: ${error.message}`);
            return false;
        }
    }

    const requestPermission = async () => {
        try {
            const micPermission = PERMISSIONS.IOS.MICROPHONE;
            const result = await request(micPermission);
            const isGranted = result === RESULTS.GRANTED;
            setPermissionGranted(isGranted);
            return isGranted;
        } catch (error) {
            console.error('Error requesting permissions:', error);
            setDebugMessage(`Permission request error: ${error.message}`);
            return false;
        }
    }

    const setupAudioListener = () => {
        // Clean up any existing subscription
        if (dataSubscription) {
            dataSubscription.remove();
            dataSubscription = null;
        }

        // Setup new listener
        dataSubscription = AudioRecord.on('data', data => {
            try {
                const chunk = Buffer.from(data, 'base64');
                console.log('chunk size', chunk.byteLength);
                
                if (chunk.byteLength > 0) {
                    audioChunksRef.current.push(data);
                    
                    // Generate simple waveform visualization data
                    const amplitude = Math.min(100, chunk.byteLength / 50); // Scale to max 100
                    setWaveformData(prevData => {
                        // Keep last 30 points for visualization
                        const newData = [...prevData, amplitude];
                        if (newData.length > 30) {
                            return newData.slice(newData.length - 30);
                        }
                        return newData;
                    });
                }
            } catch (error) {
                console.error('Error processing audio data:', error);
                setDebugMessage(`Audio data error: ${error.message}`);
            }
        });
    };

    const initializeAudioRecorder = async () => {
        try {
            // Clean up previous resources
            if (dataSubscription) {
                dataSubscription.remove();
                dataSubscription = null;
            }
            
            // Clear previous file if exists
            const filePath = `${RNFS.DocumentDirectoryPath}/test.wav`;
            if (await RNFS.exists(filePath)) {
                await RNFS.unlink(filePath);
                console.log('Deleted previous recording file');
            }
            
            // Configure audio options - these are important for quality capture
            const options = {
                sampleRate: 44100,
                channels: 1,
                bitsPerSample: 16,
                wavFile: 'test.wav',
                // On Android, specify audio source
                ...(Platform.OS === 'android' && { audioSource: 6 }), // 6 = MIC on Android
                // Set buffer size properly for the platform
                bufferSize: Platform.OS === 'ios' ? 4096 : 8192
            };

            console.log('Initializing AudioRecord with options:', JSON.stringify(options));
            
            // Initialize AudioRecord
            await AudioRecord.init(options);
            
            // Set up the audio data listener immediately
            setupAudioListener();

            setIsInitialized(true);
            console.log('AudioRecord initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing audio recorder:', error);
            setDebugMessage(`Init error: ${error.message}`);
            Alert.alert('Error', 'Failed to initialize audio recording');
            return false;
        }
    };

    const startTimer = () => {
        // Clear any existing timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        
        setRecordingTime(0);
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const start = async () => {
        if (!permissionGranted) {
            const granted = await checkPermission();
            if (!granted) {
                console.log('Microphone permission not granted');
                Alert.alert('Permission Denied', 'Microphone permission is required to record audio.');
                return;
            }
        }

        // Reset and initialize the recorder on each start
        try {
            await initializeAudioRecorder();
            
            // Reset everything
            audioChunksRef.current = [];
            setWaveformData([]);
            
            console.log('start recording...');
            setAudioFile('');
            setRecording(true);
            setLoaded(false);
            
            // Start the timer to track recording duration
            startTimer();
            
            // Start recording
            await AudioRecord.start();
            
            console.log('Recording started successfully');
        } catch (error) {
            console.error('Error starting recording:', error);
            setDebugMessage(`Start error: ${error.message}`);
            Alert.alert('Error', 'Failed to start recording');
            setRecording(false);
            stopTimer();
        }
    }

    const stop = async () => {
        if (!recording) return;
        
        try {
            console.log('stop recording...');
            // Stop the timer
            stopTimer();
            
            // Stop recording
            let audioFile = await AudioRecord.stop();
            
            // Cleanup listeners
            if (dataSubscription) {
                dataSubscription.remove();
                dataSubscription = null;
            }
            
            console.log('audio file ==> ', audioFile);
            console.log('Total audio chunks collected:', audioChunksRef.current.length);
            
            if (audioChunksRef.current.length === 0) {
                console.warn("Warning: No audio data was captured during recording");
                setDebugMessage('No audio chunks captured');
                Alert.alert("Recording Warning", "No audio data was captured. Please ensure your microphone is working and try again.");
            } else {
                // Check if the file actually exists and has content
                try {
                    const fileExists = await RNFS.exists(audioFile);
                    if (fileExists) {
                        const fileStats = await RNFS.stat(audioFile);
                        console.log('File size:', fileStats.size);
                        setDebugMessage(`File size: ${fileStats.size} bytes, Chunks: ${audioChunksRef.current.length}`);
                    } else {
                        setDebugMessage('File does not exist after recording');
                    }
                } catch (fileError) {
                    console.error('Error checking file:', fileError);
                    setDebugMessage(`File error: ${fileError.message}`);
                }
            }
            
            setAudioFile(audioFile);
            setRecording(false);
            setPaused(true);
        } catch (error) {
            console.error('Error stopping recording:', error);
            setDebugMessage(`Stop error: ${error.message}`);
            Alert.alert('Error', 'Failed to stop recording');
            setRecording(false);
            stopTimer();
        }
    }

    const load = () => {
        return new Promise((resolve, reject) => {
            if (!audioFile) {
                return reject('file path is empty');
            }

            sound = new Sound(audioFile, '', error => {
                if (error) {
                    console.log('Failed to load the file', error);
                    setDebugMessage(`Load error: ${error.message}`);
                    return reject(error);
                }
                setLoaded(true);
                return resolve();
            });
        });
    };

    const play = async () => {
        if (!loaded) {
            try {
                await load();
            } catch (error) {
                console.log(error);
                setDebugMessage(`Play error: ${error}`);
                Alert.alert('Error', 'Failed to load audio file');
                return;
            }
        }

        setPaused(false);
        Sound.setCategory('Playback');

        sound.play(success => {
            if (success) {
                console.log('Successfully finished playing...');
            } else {
                console.log('playback failed due to audio decoding errors');
                setDebugMessage('Playback failed');
            }
            setPaused(true);
        });
    };

    const pause = () => {
        if (sound) {
            sound.pause();
            setPaused(true);
        }
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const renderWaveform = () => {
        return (
            <View style={styles.waveformContainer}>
                {waveformData.map((value, index) => (
                    <View 
                        key={index}
                        style={[
                            styles.waveformBar,
                            { height: value, backgroundColor: recording ? '#ff5555' : '#1b34f2' }
                        ]}
                    />
                ))}
                {waveformData.length === 0 && !recording && (
                    <Text style={styles.waveformPlaceholder}>
                        No audio recorded yet
                    </Text>
                )}
            </View>
        );
    };

    useEffect(() => {
        const setup = async () => {
            const hasPermission = await checkPermission();
            
            if (hasPermission) {
                await initializeAudioRecorder();
            } else {
                console.log('Microphone permission not granted');
                setDebugMessage('Microphone permission not granted');
            }
        };

        setup();

        // Cleanup function
        return () => {
            stopTimer();
            
            if (sound) {
                sound.release();
            }
            
            if (dataSubscription) {
                dataSubscription.remove();
            }
            
            if (isInitialized && recording) {
                AudioRecord.stop();
            }
        };
    }, []);

    return (
        <SafeAreaView style={styles.mainContainer}>
            <View style={styles.subContainer}>
                <View style={styles.header}>
                    <Text style={styles.title}>Audio Recorder and Player</Text>
                </View>

                {/* Recording Status and Timer */}
                <View style={styles.statusContainer}>
                    {recording && (
                        <View style={styles.recordingIndicator}>
                            <View style={styles.redDot} />
                            <Text style={styles.recordingText}>RECORDING</Text>
                        </View>
                    )}
                    <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
                </View>
                
                {/* Waveform Visualization */}
                {renderWaveform()}

                {/* Debug messages */}
                {debugMessage ? (
                    <View style={styles.debugContainer}>
                        <Text style={styles.debugText}>{debugMessage}</Text>
                    </View>
                ) : null}

                {/* Audio file path display */}
                {audioFile ? (
                    <View style={styles.audioFileContainer}>
                        <Text style={styles.audioFileLabel}>Recording saved to:</Text>
                        <Text style={styles.audioFilePath}>{audioFile}</Text>
                    </View>
                ) : null}

                {/* Controls */}
                <View style={styles.controlsContainer}>
                    <TouchableOpacity 
                        onPress={recording ? stop : start} 
                        style={[styles.btnView, recording ? styles.stopButton : styles.recordButton]}
                    >
                        <Text style={styles.btnText}>{recording ? 'Stop' : 'Record'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={paused ? play : pause} 
                        style={[styles.btnView, styles.playButton, (!audioFile || recording) && styles.disabledButton]}
                        disabled={!audioFile || recording}
                    >
                        <Text style={styles.btnText}>{paused ? 'Play' : 'Pause'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Recording Info */}
                <View style={styles.infoContainer}>
                    {recording && (
                        <Text style={styles.infoText}>
                            Chunks captured: {audioChunksRef.current.length}
                        </Text>
                    )}
                    
                    {!permissionGranted && (
                        <TouchableOpacity onPress={checkPermission} style={styles.permissionButton}>
                            <Text style={styles.permissionButtonText}>Grant Microphone Permission</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#f5f5f5'
    },
    subContainer: {
        flex: 1,
        padding: 20
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000000'
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    redDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'red',
        marginRight: 8
    },
    recordingText: {
        color: 'red',
        fontWeight: 'bold'
    },
    timerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333'
    },
    waveformContainer: {
        height: 100,
        backgroundColor: '#e9e9e9',
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        padding: 10
    },
    waveformBar: {
        width: 5,
        marginHorizontal: 2,
        backgroundColor: '#1b34f2',
        borderRadius: 5
    },
    waveformPlaceholder: {
        color: '#999',
        fontStyle: 'italic'
    },
    debugContainer: {
        backgroundColor: '#ffe0e0',
        padding: 10,
        borderRadius: 5,
        marginBottom: 15
    },
    debugText: {
        color: '#700',
        fontSize: 12
    },
    audioFileContainer: {
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#e9e9e9',
        borderRadius: 5
    },
    audioFileLabel: {
        fontWeight: 'bold',
        marginBottom: 5
    },
    audioFilePath: {
        fontSize: 12,
        color: '#666'
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 30
    },
    btnView: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 140,
        height: 50,
        borderRadius: 25,
        marginHorizontal: 10
    },
    recordButton: {
        backgroundColor: '#1b34f2'
    },
    stopButton: {
        backgroundColor: '#ff3333'
    },
    playButton: {
        backgroundColor: '#32cd32'
    },
    disabledButton: {
        opacity: 0.5
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold'
    },
    infoContainer: {
        alignItems: 'center',
        marginTop: 10
    },
    infoText: {
        color: '#666',
        marginBottom: 10
    },
    permissionButton: {
        padding: 10,
        backgroundColor: '#ff9500',
        borderRadius: 5
    },
    permissionButtonText: {
        color: 'white',
        fontWeight: 'bold'
    }
});

export default AudioRecordScreen;