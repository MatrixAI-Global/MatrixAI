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
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  Keyboard,
  StatusBar,
  PixelRatio
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Share from 'react-native-share';
import Clipboard from '@react-native-clipboard/clipboard';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const scale = Math.min(width / 375, height / 812); // Base scale on iPhone X dimensions for consistency

// Function to normalize font size based on screen width
const normalize = (size) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Function to calculate responsive padding/margin
const responsiveSpacing = (size) => size * scale;

const HumaniseTextScreen = () => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const navigation = useNavigation();
  
  // State variables
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedTone, setSelectedTone] = useState('casual');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sendRotation = useRef(new Animated.Value(0)).current;
  const historySlideAnim = useRef(new Animated.Value(width)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultTranslateY = useRef(new Animated.Value(20)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  
  // History items
  const [historyItems, setHistoryItems] = useState([
    { id: '1', originalText: 'The meeting is scheduled for tomorrow.', humanisedText: 'Hey, just wanted to give you a heads up that we have a meeting on the calendar for tomorrow.', date: '2 hours ago', tone: 'casual' },
    { id: '2', originalText: 'I cannot attend the conference.', humanisedText: 'Unfortunately, I won\'t be able to make it to the conference this time around.', date: '1 day ago', tone: 'formal' },
  ]);
  
  // Tones
  const tones = [
    { id: 'casual', name: 'Casual', icon: 'coffee' },
    { id: 'formal', name: 'Formal', icon: 'tie' },
    { id: 'friendly', name: 'Friendly', icon: 'emoticon-happy-outline' },
    { id: 'professional', name: 'Professional', icon: 'briefcase-outline' },
  ];

  // Add keyboard listener
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    // Initial animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
    
    // Continuous rotation for icons
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Continuous scan line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const toggleHistory = () => {
    setHistoryOpen(!historyOpen);
    
    // Use device width for animation
    Animated.timing(historySlideAnim, {
      toValue: historyOpen ? width : 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
    
    // Close keyboard if it's open when toggling history
    if (keyboardVisible) {
      Keyboard.dismiss();
    }
  };
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });
  
  const handleSend = () => {
    if (inputText.trim() === '') {
      Alert.alert('Error', 'Please enter some text to humanise');
      return;
    }
    
    setIsProcessing(true);
    
    // Create a detailed prompt for humanising the text based on the selected tone
    let humanisePrompt;
    
    switch(selectedTone) {
      case 'casual':
        humanisePrompt = `Rewrite the following text in a casual, conversational tone as if you're talking to a friend. Make it sound natural and human-written, avoiding any AI-like patterns: "${inputText}"`;
        break;
      case 'formal':
        humanisePrompt = `Rewrite the following text in a formal, professional tone suitable for business or academic contexts. Keep it human-sounding while maintaining professionalism: "${inputText}"`;
        break;
      case 'friendly':
        humanisePrompt = `Rewrite the following text in a friendly, warm tone. Add some personality and make it sound like it was written by a human, not AI. You can include emojis where appropriate: "${inputText}"`;
        break;
      case 'professional':
        humanisePrompt = `Rewrite the following text in a professional tone suitable for work environments. Make it sound human-written while maintaining clarity and professionalism: "${inputText}"`;
        break;
      default:
        humanisePrompt = `Rewrite the following text to sound more human and less like AI-generated text: "${inputText}"`;
    }
    
    // Make API call to matrix-server
    axios.post('https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/createContent', {
      prompt: humanisePrompt
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      // Extract the response
      const result = response.data.output.text.trim();
      
      setOutputText(result);
      setIsFinished(true);
      
      // Add to history
      const newHistoryItem = {
        id: Date.now().toString(),
        originalText: inputText,
        humanisedText: result,
        tone: selectedTone,
        date: 'Just now'
      };
      
      setHistoryItems([newHistoryItem, ...historyItems]);
      
      // Animate result appearance
      Animated.parallel([
        Animated.timing(resultOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(resultTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();
    })
    .catch(error => {
      console.error('Error humanising text:', error);
      Alert.alert('Error', 'Failed to humanise text. Please try again.');
      
      // Fallback to simple transformation if API fails
      handleFallbackHumanisation();
    })
    .finally(() => {
      setIsProcessing(false);
    });
  };
  
  // Fallback function for text humanisation if API fails
  const handleFallbackHumanisation = () => {
    // Example transformation based on tone
    let result = '';
    
    switch(selectedTone) {
      case 'casual':
        result = `Hey, just wanted to let you know that ${inputText.toLowerCase()}`;
        break;
      case 'formal':
        result = `I would like to inform you that ${inputText}`;
        break;
      case 'friendly':
        result = `Hi there! ${inputText} Hope that helps! 😊`;
        break;
      case 'professional':
        result = `I'm reaching out regarding ${inputText}. Please let me know if you require any clarification.`;
        break;
      default:
        result = inputText;
    }
    
    setOutputText(result);
    setIsFinished(true);
    
    // Add to history
    const newHistoryItem = {
      id: Date.now().toString(),
      originalText: inputText,
      humanisedText: result,
      tone: selectedTone,
      date: 'Just now'
    };
    
    setHistoryItems([newHistoryItem, ...historyItems]);
    
    // Animate result appearance
    Animated.parallel([
      Animated.timing(resultOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(resultTranslateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
    
    Alert.alert('Notice', 'Using simple transformation as API call failed.');
  };
  
  const handleReset = () => {
    setInputText('');
    setOutputText('');
    setIsFinished(false);
    resultOpacity.setValue(0);
    resultTranslateY.setValue(20);
  };
  
  const copyToClipboard = () => {
    Clipboard.setString(outputText);
    setIsCopied(true);
    
    // Reset copied status after 2 seconds
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };
  
  const shareText = async () => {
    try {
      const shareOptions = {
        message: outputText,
        title: 'Humanised Text from MatrixAI'
      };
      
      await Share.open(shareOptions);
    } catch (error) {
      console.log('Error sharing text:', error);
    }
  };
  
  const renderToneItem = ({ item }) => {
    // Determine the appropriate background color based on tone when selected
    const selectedColor = item.id === 'formal' ? '#3F51B5' : 
                          item.id === 'professional' ? '#2196F3' : 
                          item.id === 'friendly' ? '#9C27B0' : '#FF9800';
    
    // Apply different styling based on selection state
    const isSelected = selectedTone === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.toneItem,
          isSelected && [styles.selectedToneItem, { backgroundColor: selectedColor }],
          { 
            backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
            borderWidth: 1,
            borderColor: isSelected ? selectedColor : 'transparent',
            transform: isSelected ? [{ scale: 1.05 }] : [{ scale: 1 }]
          }
        ]}
        onPress={() => setSelectedTone(item.id)}
      >
        <MaterialCommunityIcons 
          name={item.icon} 
          size={normalize(24)} 
          color={isSelected ? colors.text : colors.text} 
        />
        <Text style={[
          styles.toneName,
          { 
            color: isSelected ? colors.text : colors.text,
            fontWeight: isSelected ? '600' : '500'
          }
        ]}>
          {item.name}
        </Text>
        
        {/* Add a small indicator for the selected item */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <MaterialIcons name="check" size={normalize(14)} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  const renderHistoryItem = ({ item }) => {
    // For very small screens, we might need to truncate the text more
    const truncateLength = width < 320 ? 40 : width < 375 ? 50 : 60;
    const isSmallScreen = width < 360;
    
    return (
      <TouchableOpacity 
        style={[styles.historyItem, { 
          backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        }]}
        onPress={() => {
          setInputText(item.originalText);
          setOutputText(item.humanisedText);
          setSelectedTone(item.tone);
          setIsFinished(true);
          toggleHistory();
          
          // Animate result appearance
          Animated.parallel([
            Animated.timing(resultOpacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(resultTranslateY, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            })
          ]).start();
        }}
      >
        <View style={[styles.historyItemHeader, isSmallScreen && { flexDirection: 'column' }]}>
          <View style={[styles.historyItemTextContainer, isSmallScreen && { marginBottom: responsiveSpacing(8) }]}>
            <Text style={[styles.historyItemTitle, { color: colors.text }]} numberOfLines={2}>
              {item.originalText.length > truncateLength ? `${item.originalText.substring(0, truncateLength)}...` : item.originalText}
            </Text>
            <Text style={[styles.historyItemDate, { color: colors.textSecondary }]}>
              {item.date}
            </Text>
          </View>
          <View style={[
            styles.historyItemBadge, 
            { 
              backgroundColor: item.tone === 'formal' ? '#3F51B5' : 
                            item.tone === 'professional' ? '#2196F3' : 
                            item.tone === 'friendly' ? '#9C27B0' : '#FF9800',
              opacity: 0.9,
              alignSelf: isSmallScreen ? 'flex-start' : 'center'
            }
          ]}>
            <Text style={styles.historyItemBadgeText}>
              {item.tone.charAt(0).toUpperCase() + item.tone.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={[styles.historyItemSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.humanisedText}
        </Text>
      </TouchableOpacity>
    );
  };

  // Adjust layout based on screen size
  const isSmallScreen = width < 360;
  const isMediumScreen = width >= 360 && width < 400;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={currentTheme === 'dark' ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      
      {/* Header with better touch targets */}
      <Animated.View style={[styles.header, { 
        transform: [{ scale: scaleAnim }], 
        backgroundColor: currentTheme === 'dark' ? 'rgba(28, 28, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)'
      }]}>
        <TouchableOpacity 
          style={[styles.backButton, { minWidth: responsiveSpacing(44), minHeight: responsiveSpacing(44), justifyContent: 'center', alignItems: 'center' }]} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={normalize(24)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          <MaterialCommunityIcons name="human-greeting" size={normalize(20)} color={colors.primary} /> Humanise Text
        </Text>
        <TouchableOpacity 
          style={[styles.historyButton, { minWidth: responsiveSpacing(44), minHeight: responsiveSpacing(44), justifyContent: 'center', alignItems: 'center' }]} 
          onPress={toggleHistory}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="history" size={normalize(24)} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>
      
      {/* Main container */}
      <View style={styles.mainContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.contentWrapper}>
            {/* Welcome Banner with matching container */}
            <View style={styles.standardContainer}>
              <Animated.View style={[styles.welcomeBanner, { 
                opacity: fadeAnim,
                transform: [{ translateY: Animated.multiply(Animated.subtract(1, fadeAnim), 20) }]
              }]}>
                <LinearGradient
                  colors={currentTheme === 'dark' ? 
                    ['#9C27B0', '#7B1FA2'] : 
                    ['#E1BEE7', '#CE93D8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bannerGradient}
                >
                  {/* Decorative elements */}
                  <Animated.View 
                    style={[
                      styles.decorCircle1, 
                      { 
                        opacity: 0.1, 
                        transform: [{ rotate: spin }],
                        borderColor: colors.primary
                      }
                    ]}
                  />
                  <Animated.View 
                    style={[
                      styles.decorCircle2, 
                      { 
                        opacity: 0.15, 
                        transform: [{ rotate: spin }],
                        borderColor: currentTheme === 'dark' ? colors.secondary : colors.primary
                      }
                    ]}
                  />
                  
                  <View style={[styles.bannerContent, isSmallScreen && { flexDirection: 'column' }]}>
                    <View style={[styles.bannerTextContent, isSmallScreen && { paddingRight: 0, marginBottom: responsiveSpacing(16) }]}>
                      <Text style={[styles.bannerTitle, { color: colors.text }]}>
                        Humanise Your Text
                      </Text>
                      <Text style={[styles.bannerSubtitle, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                        Transform AI-generated text into natural, human-like writing
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItemBanner}>
                          <Ionicons name="checkmark-circle" size={normalize(16)} color={currentTheme === 'dark' ? '#BA68C8' : '#9C27B0'} />
                          <Text style={[styles.featureText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                            Multiple tone options
                          </Text>
                        </View>
                        <View style={styles.featureItemBanner}>
                          <Ionicons name="checkmark-circle" size={normalize(16)} color={currentTheme === 'dark' ? '#BA68C8' : '#9C27B0'} />
                          <Text style={[styles.featureText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                            Natural-sounding results
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <Animated.View style={[styles.iconOuter, isSmallScreen && { alignSelf: 'center' }, { transform: [{ scale: pulseAnim }] }]}>
                      <View style={styles.iconContainer}>
                        <LinearGradient
                          colors={['#9C27B0', '#7B1FA2']}
                          style={styles.iconGradient}
                        >
                          <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <MaterialCommunityIcons name="human-greeting" size={normalize(32)} color="#FFFFFF" />
                          </Animated.View>
                        </LinearGradient>
                        <Animated.View 
                          style={[
                            styles.iconRing, 
                            { 
                              transform: [{ rotate: spin }],
                              borderColor: currentTheme === 'dark' ? '#9C27B0' : '#9C27B0' 
                            }
                          ]}
                        />
                      </View>
                    </Animated.View>
                  </View>
                </LinearGradient>
              </Animated.View>
            </View>
            
            {/* Tone Selector */}
            <View style={styles.toneContainer}>
              <View style={styles.sectionHeaderContainer}>
                <MaterialCommunityIcons name="format-font" size={normalize(20)} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Tone</Text>
              </View>
              <FlatList
                data={tones}
                renderItem={renderToneItem}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.toneList}
              />
            </View>
            
            {/* Input Section */}
            <View style={styles.standardContainer}>
              <View style={styles.inputContainer}>
                <View style={styles.sectionHeaderContainer}>
                  <MaterialCommunityIcons name="text-box-check-outline" size={normalize(20)} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Text</Text>
                </View>
                
                <View style={[styles.textInputContainer, { 
                  backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                  borderColor: colors.border,
                  shadowColor: colors.primary
                }]}>
                  <View style={styles.inputHeaderBar}>
                    <Text style={[styles.inputLabel, { color: '#9C27B0' }]}>
                      <MaterialCommunityIcons name="text-box-outline" size={normalize(14)} color={'#9C27B0'} /> Input Text
                    </Text>
                    <TouchableOpacity 
                      style={[styles.pasteButton, { minWidth: responsiveSpacing(70), minHeight: responsiveSpacing(30), justifyContent: 'center', alignItems: 'center' }]} 
                      onPress={async () => {
                        const clipboardText = await Clipboard.getString();
                        if (clipboardText) {
                          setInputText(clipboardText);
                        }
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons name="content-paste" size={normalize(14)} color={colors.primary} />
                      <Text style={[styles.pasteButtonText, { color: colors.primary }]}>Paste</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.textInputWrapper]}>
                    <TextInput
                      style={[styles.textInput, { color: colors.text, height: Math.max(150 * scale, 150) }]}
                      placeholder="Enter text you want to humanise..."
                      placeholderTextColor={'#A3A3A3FF'}
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                      numberOfLines={8}
                      textAlignVertical="top"
                      editable={!isProcessing}
                    />
                    
                    {/* Scan line animation */}
                    {inputText.length > 0 && !isFinished && (
                      <Animated.View 
                        style={[
                          styles.scanLine,
                          {
                            backgroundColor: colors.primary,
                            opacity: 0.4,
                            transform: [
                              { 
                                translateY: scanLineAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 150 * scale]
                                })
                              }
                            ]
                          }
                        ]}
                      />
                    )}
                  </View>
                  
                  <View style={styles.textInputFooter}>
                    <Text style={[styles.characterCount, { color: '#9C27B0' }]}>
                      {inputText.length} characters
                    </Text>
                    {inputText.length > 0 && selectedTone && (
                        <Text style={[styles.longTextNote, { color: '#9C27B0' }]}>
                        <Ionicons name="checkmark-circle" size={normalize(12)} color={'#9C27B0'} /> {selectedTone.charAt(0).toUpperCase() + selectedTone.slice(1)} tone
                      </Text>
                    )}
                  </View>
                </View>
                
                {!isFinished && (
                  <TouchableOpacity 
                    style={[styles.submitButton, {
                      backgroundColor: isProcessing || inputText.trim() === '' ? '#BA68C8' : '#9C27B0',
                      opacity: isProcessing || inputText.trim() === '' ? 0.7 : 1
                    }]}
                    onPress={handleSend}
                    disabled={isProcessing || inputText.trim() === ''}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.fixedAnalyzeButtonContent}>
                        <Text style={styles.submitButtonText}>Humanise</Text>
                        <MaterialCommunityIcons name="human-greeting" size={normalize(20)} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            {/* Result Section */}
            {isFinished && (
              <View style={styles.standardContainer}>
                <Animated.View style={[styles.resultContainer, {
                  opacity: resultOpacity,
                  transform: [{ translateY: resultTranslateY }]
                }]}>
                  <View style={[styles.resultHeader, isSmallScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <View style={styles.sectionHeaderContainer}>
                      <MaterialCommunityIcons name="text-box-check-outline" size={normalize(20)} color={colors.primary} />
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>Humanised Result</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.resetButton, isSmallScreen && { marginTop: responsiveSpacing(8) }]}
                      onPress={handleReset}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="refresh" size={normalize(20)} color={colors.primary} />
                      <Text style={[styles.resetButtonText, { color: colors.primary }]}>
                        New Text
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={[styles.resultBox, {
                    backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: colors.border
                  }]}>
                    <Text style={[styles.resultText, { color: colors.text }]}>
                      {outputText}
                    </Text>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(245, 245, 255, 0.6)' }]}
                      onPress={copyToClipboard}
                    >
                      <MaterialIcons 
                        name={isCopied ? "check" : "content-copy"} 
                        size={normalize(22)} 
                        color={isCopied ? "#4CAF50" : colors.text} 
                      />
                      <Text style={[styles.actionButtonText, { 
                        color: isCopied ? "#4CAF50" : colors.text 
                      }]}>
                        {isCopied ? "Copied" : "Copy"}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, { backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(245, 245, 255, 0.6)' }]}
                      onPress={shareText}
                    >
                      <MaterialIcons name="share" size={normalize(22)} color={colors.text} />
                      <Text style={[styles.actionButtonText, { color: colors.text }]}>
                        Share
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              </View>
            )}
            
            {/* Processing Animation */}
            {isProcessing && (
              <View style={styles.processingContainer}>
                <LottieView 
                  source={require('../assets/image2.json')}
                  autoPlay
                  loop
                  style={styles.lottieAnimation}
                />
                <Text style={[styles.processingText, { color: colors.text }]}>
                  Transforming your text...
                </Text>
                <Text style={[styles.processingSubtext, { color: colors.textSecondary }]}>
                  Using advanced AI to create human-like content
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
      
      {/* History Panel */}
      <Animated.View 
        style={[styles.historyPanel, {
          backgroundColor: currentTheme === 'dark' ? 'rgba(20, 20, 30, 0.95)' : 'rgba(245, 245, 255, 0.95)',
          transform: [{ translateX: historySlideAnim }]
        }]}
      >
        <View style={[styles.historyHeader, { 
          borderBottomColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }]}>
          <View style={styles.historyHeaderContent}>
            <MaterialCommunityIcons name="history" size={normalize(24)} color={colors.primary} />
            <Text style={[styles.historyTitle, { color: colors.text }]}>
              Transformation History
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={toggleHistory}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={normalize(24)} color={colors.text} />
          </TouchableOpacity>
        </View>
        
        {historyItems.length > 0 ? (
          <FlatList
            data={historyItems}
            renderItem={renderHistoryItem}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.historyList}
          />
        ) : (
          <View style={styles.emptyHistoryContainer}>
            <MaterialCommunityIcons 
              name="history" 
              size={normalize(48)} 
              color={colors.textSecondary} 
            />
            <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
              No history found
            </Text>
            <Text style={[styles.emptyHistorySubtext, { color: colors.textSecondary }]}>
              Your previous transformations will appear here
            </Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: responsiveSpacing(8),
  },
  headerTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyButton: {
    padding: responsiveSpacing(8),
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: responsiveSpacing(40),
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%', 
    maxWidth: 600,
    paddingHorizontal: responsiveSpacing(16),
  },
  standardContainer: {
    width: '100%',
    marginTop: responsiveSpacing(16),
  },
  welcomeBanner: {
    width: '100%',
    borderRadius: responsiveSpacing(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 0,
  },
  bannerGradient: {
    width: '100%',
    borderRadius: responsiveSpacing(24),
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    top: -30 * scale,
    right: -30 * scale,
    width: 150 * scale,
    height: 120 * scale,
    borderRadius: 60 * scale,
    borderWidth: 10 * scale,
    borderStyle: 'dashed',
  },
  decorCircle2: {
    position: 'absolute',
    bottom: -40 * scale,
    left: -40 * scale,
    width: 100 * scale,
    height: 100 * scale,
    borderRadius: 50 * scale,
    borderWidth: 8 * scale,
    borderStyle: 'solid',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
    padding: responsiveSpacing(24),
  },
  bannerTextContent: {
    flex: 1,
    paddingRight: responsiveSpacing(16),
    minWidth: width * 0.5,
  },
  bannerTitle: {
    fontSize: normalize(26),
    fontWeight: 'bold',
    marginBottom: responsiveSpacing(8),
  },
  bannerSubtitle: {
    fontSize: normalize(14),
    lineHeight: normalize(20),
    marginBottom: responsiveSpacing(12),
  },
  featureList: {
    marginTop: responsiveSpacing(8),
  },
  featureItemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing(6),
  },
  featureText: {
    fontSize: normalize(12),
    marginLeft: responsiveSpacing(6),
  },
  iconOuter: {
    width: 80 * scale,
    height: 80 * scale,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64 * scale,
    height: 64 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconGradient: {
    width: 64 * scale,
    height: 64 * scale,
    borderRadius: 32 * scale,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconRing: {
    position: 'absolute',
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 40 * scale,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsiveSpacing(12),
  },
  toneContainer: {
    marginTop: responsiveSpacing(24),
    width: '100%',
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  toneList: {
    paddingVertical: responsiveSpacing(8),
    marginLeft: responsiveSpacing(16),
  },
  toneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing(12),
    borderRadius: responsiveSpacing(12),
    marginRight: responsiveSpacing(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedToneItem: {
    backgroundColor: '#9C27B0',
  },
  toneName: {
    marginLeft: responsiveSpacing(8),
    fontWeight: '500',
    fontSize: normalize(14),
  },
  inputContainer: {
    marginTop: responsiveSpacing(24),
    width: '100%',
  },
  textInputContainer: {
    width: '100%',
    borderRadius: responsiveSpacing(16),
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: responsiveSpacing(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  inputLabel: {
    fontSize: normalize(14),
    fontWeight: '500',
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasteButtonText: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginLeft: responsiveSpacing(4),
  },
  textInputWrapper: {
    padding: responsiveSpacing(12),
    minHeight: 160 * scale,
    position: 'relative',
  },
  textInput: {
    fontSize: normalize(16),
    minHeight: 150 * scale,
  },
  textInputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing(16),
    paddingVertical: responsiveSpacing(8),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  characterCount: {
    fontSize: normalize(12),
  },
  longTextNote: {
    fontSize: normalize(12),
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
  },
  submitButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginTop: responsiveSpacing(12),
    marginBottom: responsiveSpacing(20),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  fixedAnalyzeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: responsiveSpacing(16),
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: normalize(16),
    marginRight: responsiveSpacing(10),
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: responsiveSpacing(20),
    padding: responsiveSpacing(16),
  },
  lottieAnimation: {
    width: 200 * scale, 
    height: 100 * scale,
  },
  processingText: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginTop: responsiveSpacing(8),
  },
  processingSubtext: {
    fontSize: normalize(14),
    marginTop: responsiveSpacing(4),
    textAlign: 'center',
  },
  resultContainer: {
    marginTop: responsiveSpacing(24),
    width: '100%',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: responsiveSpacing(16),
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(6),
    borderRadius: responsiveSpacing(16),
  },
  resetButtonText: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginLeft: responsiveSpacing(4),
  },
  resultBox: {
    borderRadius: responsiveSpacing(16),
    borderWidth: 1,
    padding: responsiveSpacing(16),
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultText: {
    fontSize: normalize(16),
    lineHeight: normalize(24),
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing(16),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(12),
    paddingHorizontal: responsiveSpacing(20),
    flex: 0.48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonText: {
    fontWeight: '500',
    fontSize: normalize(14),
    marginLeft: responsiveSpacing(8),
  },
  historyPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: '100%',
    zIndex: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: responsiveSpacing(16),
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + responsiveSpacing(16) : responsiveSpacing(16),
  },
  historyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  closeButton: {
    padding: responsiveSpacing(4),
    minWidth: responsiveSpacing(40),
    minHeight: responsiveSpacing(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    padding: responsiveSpacing(16),
  },
  historyItem: {
    borderRadius: responsiveSpacing(16),
    padding: responsiveSpacing(16),
    marginBottom: responsiveSpacing(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: responsiveSpacing(12),
  },
  historyItemTextContainer: {
    flex: 1,
    marginRight: responsiveSpacing(12),
  },
  historyItemTitle: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginBottom: responsiveSpacing(4),
  },
  historyItemDate: {
    fontSize: normalize(12),
  },
  historyItemBadge: {
    paddingHorizontal: responsiveSpacing(10),
    paddingVertical: responsiveSpacing(4),
    borderRadius: responsiveSpacing(12),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: responsiveSpacing(60),
  },
  historyItemBadgeText: {
    color: '#FFFFFF',
    fontSize: normalize(12),
    fontWeight: '600',
  },
  historyItemSubtitle: {
    fontSize: normalize(14),
    lineHeight: normalize(20),
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: responsiveSpacing(60),
  },
  emptyHistoryText: {
    fontSize: normalize(16),
    marginTop: responsiveSpacing(12),
    fontWeight: '500',
  },
  emptyHistorySubtext: {
    fontSize: normalize(14),
    marginTop: responsiveSpacing(4),
    opacity: 0.7,
  },
  selectedIndicator: {
    position: 'absolute',
    top: responsiveSpacing(4),
    right: responsiveSpacing(4),
    width: responsiveSpacing(18),
    height: responsiveSpacing(18),
    borderRadius: responsiveSpacing(9),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
});

export default HumaniseTextScreen; 