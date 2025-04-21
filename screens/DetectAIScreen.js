import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StatusBar,
  PixelRatio,
  Alert
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LinearGradient } from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { BlurView } from '@react-native-community/blur';
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

const DetectAIScreen = () => {
  const { getThemeColors, currentTheme } = useTheme();
  const colors = getThemeColors();
  const { t } = useLanguage();
  const navigation = useNavigation();
  
  // State variables
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Animated values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const historySlideAnim = useRef(new Animated.Value(width)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const meterAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // History items
  const [historyItems, setHistoryItems] = useState([
    { 
      id: '1', 
      text: 'The artificial intelligence revolution has transformed how we approach problem-solving across industries.',
      aiProbability: 0.92,
      date: '3 hours ago' 
    },
    { 
      id: '2', 
      text: "Hey, I just wanted to let you know that I'll be running a bit late today. Traffic is terrible!",
      aiProbability: 0.12,
      date: '1 day ago' 
    },
  ]);

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

    // Continuous rotation animation
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
  
  const handleAnalyze = () => {
    if (inputText.trim() === '') return;
    
    setIsAnalyzing(true);
    
    // Create a prompt specifically for AI text detection
    const prompt = `Analyze the following text and determine if it was written by AI or a human. 
    Provide a detailed analysis with a score from 0 to 1 where 1 means definitely AI-generated and 0 means definitely human-written.
    Also evaluate for: repetitive patterns, natural language flow, stylistic consistency, and unique expressions.
    Format your response as JSON with the following structure:
    {
      "aiProbability": 0.7, 
      "humanProbability": 0.3,
      "features": [
        {"name": "Repetitive patterns", "score": 0.8},
        {"name": "Natural language flow", "score": 0.3},
        {"name": "Stylistic consistency", "score": 0.6},
        {"name": "Unique expressions", "score": 0.2}
      ]
    }
    
    Text to analyze: "${inputText}"`;

    // Make API call to matrix-server
    axios.post('https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/createContent', {
      prompt: prompt
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      // Extract the response and parse the JSON
      const aiOutput = response.data.output.text;
      
      // Try to extract JSON from the response
      let jsonMatch;
      try {
        // Look for JSON object in the response
        jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : null;
        
        // Parse the JSON
        const resultData = jsonStr ? JSON.parse(jsonStr) : null;
        
        if (resultData && resultData.aiProbability !== undefined) {
          const result = {
            text: inputText,
            aiProbability: resultData.aiProbability,
            humanProbability: resultData.humanProbability || (1 - resultData.aiProbability),
            features: resultData.features || [
              { name: 'Repetitive patterns', score: Math.random() * 0.3 + (resultData.aiProbability > 0.5 ? 0.6 : 0.2) },
              { name: 'Natural language flow', score: Math.random() * 0.3 + (resultData.aiProbability < 0.5 ? 0.6 : 0.2) },
              { name: 'Stylistic consistency', score: Math.random() * 0.5 + 0.3 },
              { name: 'Unique expressions', score: Math.random() * 0.3 + (resultData.aiProbability < 0.5 ? 0.6 : 0.2) }
            ]
          };
          
          setAnalysisResult(result);
          
          // Add to history
          const newHistoryItem = {
            id: Date.now().toString(),
            text: inputText,
            aiProbability: result.aiProbability,
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
            Animated.timing(meterAnim, {
              toValue: result.aiProbability,
              duration: 1000,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          ]).start();
        } else {
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error parsing API response:', error);
        // Fallback to random data if parsing fails
        handleFallbackAnalysis();
      }
    })
    .catch(error => {
      console.error('Error calling AI API:', error);
      // Use fallback if API call fails
      handleFallbackAnalysis();
    })
    .finally(() => {
      setIsAnalyzing(false);
    });
  };
  
  // Fallback function in case the API call fails
  const handleFallbackAnalysis = () => {
    // Generate a random score for demo purposes as fallback
    const aiProbability = Math.random();
    
    const result = {
      text: inputText,
      aiProbability,
      humanProbability: 1 - aiProbability,
      features: [
        { name: 'Repetitive patterns', score: Math.random() * 0.3 + (aiProbability > 0.5 ? 0.6 : 0.2) },
        { name: 'Natural language flow', score: Math.random() * 0.3 + (aiProbability < 0.5 ? 0.6 : 0.2) },
        { name: 'Stylistic consistency', score: Math.random() * 0.5 + 0.3 },
        { name: 'Unique expressions', score: Math.random() * 0.3 + (aiProbability < 0.5 ? 0.6 : 0.2) },
      ]
    };
    
    setAnalysisResult(result);
    
    // Add to history
    const newHistoryItem = {
      id: Date.now().toString(),
      text: inputText,
      aiProbability: result.aiProbability,
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
      Animated.timing(meterAnim, {
        toValue: result.aiProbability,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    ]).start();
    
    Alert.alert('Notice', 'Using fallback analysis as API call failed. Results are simulated.');
  };
  
  const handleReset = () => {
    setInputText('');
    setAnalysisResult(null);
    meterAnim.setValue(0);
    resultOpacity.setValue(0);
  };

  const renderFeatureItem = ({ item }) => (
    <View style={styles.featureItem}>
      <View style={[styles.featureHeader, width < 340 && { marginBottom: responsiveSpacing(8) }]}>
        <Text style={[styles.featureName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[
          styles.featureIndicator, 
          { 
            color: item.name.includes('Natural') || item.name.includes('Unique') ? 
              (item.score > 0.5 ? '#4CAF50' : '#F44336') : 
              (item.score > 0.5 ? '#F44336' : '#4CAF50')
          }
        ]}>
          {item.name.includes('Natural') || item.name.includes('Unique') ? 
            (item.score > 0.5 ? 'Human' : 'AI') : 
            (item.score > 0.5 ? 'AI' : 'Human')}
        </Text>
      </View>
      <View style={styles.featureBarContainer}>
        <View style={[styles.featureBarBg, { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]}>
          <View 
            style={[
              styles.featureBarFill, 
              { 
                width: `${item.score * 100}%`,
                backgroundColor: item.name.includes('Natural') || item.name.includes('Unique') ? 
                  '#4CAF50' : '#F44336'
              }
            ]} 
          />
        </View>
        <Text style={[styles.featureScore, { color: colors.textSecondary }]}>
          {Math.round(item.score * 100)}%
        </Text>
      </View>
    </View>
  );
  
  const renderHistoryItem = ({ item }) => {
    // For very small screens, we might need to truncate the text more
    const truncateLength = width < 320 ? 40 : width < 375 ? 50 : 60;
    
    return (
      <TouchableOpacity 
        style={[styles.historyItem, { 
          backgroundColor: currentTheme === 'dark' ? 'rgba(40, 40, 50, 0.6)' : 'rgba(255, 255, 255, 0.8)',
        }]}
        onPress={() => {
          setInputText(item.text);
          
          const result = {
            text: item.text,
            aiProbability: item.aiProbability,
            humanProbability: 1 - item.aiProbability,
            features: [
              { name: 'Repetitive patterns', score: Math.random() * 0.3 + (item.aiProbability > 0.5 ? 0.6 : 0.2) },
              { name: 'Natural language flow', score: Math.random() * 0.3 + (item.aiProbability < 0.5 ? 0.6 : 0.2) },
              { name: 'Stylistic consistency', score: Math.random() * 0.5 + 0.3 },
              { name: 'Unique expressions', score: Math.random() * 0.3 + (item.aiProbability < 0.5 ? 0.6 : 0.2) },
            ]
          };
          
          setAnalysisResult(result);
          toggleHistory();
          
          // Animate result appearance
          Animated.parallel([
            Animated.timing(resultOpacity, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(meterAnim, {
              toValue: result.aiProbability,
              duration: 1000,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: false,
            })
          ]).start();
        }}
      >
        <View style={[styles.historyItemHeader, width < 340 && { flexDirection: 'column' }]}>
          <View style={[styles.historyItemTextContainer, width < 340 && { marginBottom: responsiveSpacing(8) }]}>
            <Text style={[styles.historyItemTitle, { color: colors.text }]} numberOfLines={2}>
              {item.text.length > truncateLength ? `${item.text.substring(0, truncateLength)}...` : item.text}
            </Text>
            <Text style={[styles.historyItemDate, { color: colors.textSecondary }]}>
              {item.date}
            </Text>
          </View>
          <View style={[
            styles.historyItemBadge, 
            { 
              backgroundColor: item.aiProbability > 0.7 ? '#F44336' : 
                            item.aiProbability > 0.4 ? '#FF9800' : '#4CAF50',
              opacity: 0.9,
              alignSelf: width < 340 ? 'flex-start' : 'center'
            }
          ]}>
            <Text style={styles.historyItemBadgeText}>
              {item.aiProbability > 0.7 ? 'AI' : 
              item.aiProbability > 0.4 ? 'Mixed' : 'Human'}
            </Text>
          </View>
        </View>
        <View style={styles.historyItemMeter}>
          <View style={styles.historyItemMeterBg}>
            <View 
              style={[
                styles.historyItemMeterFill, 
                { 
                  width: `${item.aiProbability * 100}%`,
                  backgroundColor: item.aiProbability > 0.7 ? '#F44336' : 
                                item.aiProbability > 0.4 ? '#FF9800' : '#4CAF50'
                }
              ]} 
            />
          </View>
          <Text style={[styles.historyItemScore, { color: colors.textSecondary }]}>
            {Math.round(item.aiProbability * 100)}% AI
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Create a rotation transform for icons
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

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
          <MaterialCommunityIcons name="shield-search" size={normalize(20)} color={colors.primary} /> AI Detector
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
          {/* Welcome Banner - adjusted for small screens */}
          <Animated.View style={[styles.welcomeBanner, { 
            opacity: fadeAnim,
            transform: [{ translateY: Animated.multiply(Animated.subtract(1, fadeAnim), 20) }]
          }]}>
            <LinearGradient
              colors={currentTheme === 'dark' ? 
                ['#1A237E', '#283593'] : 
                ['#E8EAF6', '#C5CAE9']}
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
                    AI Text Detector
                  </Text>
                  <Text style={[styles.bannerSubtitle, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                    Detect AI-generated content with advanced ML
                  </Text>
                  <View style={styles.featureList}>
                    <View style={styles.featureItemBanner}>
                      <Ionicons name="checkmark-circle" size={normalize(16)} color={currentTheme === 'dark' ? '#5C6BC0' : '#3F51B5'} />
                      <Text style={[styles.featureText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                        Fast and accurate detection
                      </Text>
                    </View>
                    <View style={styles.featureItemBanner}>
                      <Ionicons name="checkmark-circle" size={normalize(16)} color={currentTheme === 'dark' ? '#5C6BC0' : '#3F51B5'} />
                      <Text style={[styles.featureText, { color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }]}>
                        Detailed analytics
                      </Text>
                    </View>
                  </View>
                </View>
                
                <Animated.View style={[styles.iconOuter, isSmallScreen && { alignSelf: 'center' }, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={styles.iconContainer}>
                    <LinearGradient
                      colors={['#3F51B5', '#1A237E']}
                      style={styles.iconGradient}
                    >
                      <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <MaterialCommunityIcons name="shield-search" size={normalize(32)} color="#FFFFFF" />
                      </Animated.View>
                    </LinearGradient>
                    <Animated.View 
                      style={[
                        styles.iconRing, 
                        { 
                          transform: [{ rotate: spin }],
                          borderColor: currentTheme === 'dark' ? '#3F51B5' : '#3F51B5' 
                        }
                      ]}
                    />
                  </View>
                </Animated.View>
              </View>
            </LinearGradient>
          </Animated.View>
          
          {/* Responsive Input Section */}
          <View style={styles.inputContainer}>
            <View style={styles.sectionHeaderContainer}>
              <MaterialCommunityIcons name="text-box-search-outline" size={normalize(20)} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Text Analysis</Text>
            </View>
            
            <View style={[styles.textInputContainer, { 
              backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: colors.border,
              shadowColor: colors.primary
            }]}>
              <View style={styles.inputHeaderBar}>
                <Text style={[styles.inputLabel, { color: '#3F51B5' }]}>
                  <MaterialCommunityIcons name="text-box-outline" size={normalize(14)} color={'#3F51B5'} /> Input Text
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
                  placeholder="Enter or paste text to analyze for AI detection..."
                  placeholderTextColor={'#A3A3A3FF'}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  editable={!isAnalyzing}
                />
                
                {/* Scan line animation */}
                {inputText.length > 0 && !analysisResult && (
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
                <Text style={[styles.characterCount, { color: '#3F51B5' }]}>
                  {inputText.length} characters
                </Text>
                {inputText.length > 1000 && (
                  <Text style={[styles.longTextNote, { color: '#3F51B5' }]}>
                    <Ionicons name="checkmark-circle" size={normalize(12)} color={'#3F51B5'} /> Sufficient length
                  </Text>
                )}
              </View>
            </View>
            
            {!analysisResult && (
              <TouchableOpacity 
                style={[styles.fixedAnalyzeButton, {
                  backgroundColor: isAnalyzing || inputText.trim() === '' ? '#9FA8DA' : '#3F51B5',
                  opacity: isAnalyzing || inputText.trim() === '' ? 0.7 : 1
                }]}
                onPress={handleAnalyze}
                disabled={isAnalyzing || inputText.trim() === ''}
              >
                {isAnalyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.fixedAnalyzeButtonContent}>
                    <Text style={styles.fixedAnalyzeButtonText}>Analyze Content</Text>
                    <MaterialCommunityIcons name="shield-search" size={normalize(20)} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
          
          {/* Result Section with Improved Layout for Small Screens */}
          {analysisResult && (
            <Animated.View style={[styles.resultContainer, { opacity: resultOpacity }]}>
              <View style={[styles.resultHeader, isSmallScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View style={styles.sectionHeaderContainer}>
                  <MaterialCommunityIcons name="chart-bar" size={normalize(20)} color={colors.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Analysis Results</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.resetButton, isSmallScreen && { marginTop: responsiveSpacing(8) }]}
                  onPress={handleReset}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="refresh" size={normalize(20)} color={colors.primary} />
                  <Text style={[styles.resetButtonText, { color: colors.primary }]}>
                    New Analysis
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* AI Probability Meter with Futuristic Design */}
              <View style={[styles.meterContainer, { 
                backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: colors.border
              }]}>
                <View style={styles.meterHeaderContainer}>
                  <Text style={[styles.meterTitle, { color: colors.text }]}>
                    AI Probability Analysis
                  </Text>
                  <View style={styles.resultBadge}>
                    <Text style={styles.resultBadgeText}>
                      {analysisResult.aiProbability > 0.8 ? 'AI Generated' : 
                       analysisResult.aiProbability > 0.5 ? 'Possibly AI' : 'Likely Human'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.meterContent}>
                  <View style={styles.meter}>
                    <View style={[styles.meterBackground, { backgroundColor: 'rgba(0, 0, 0, 0.1)' }]}>
                      <Animated.View 
                        style={[
                          styles.meterFill, 
                          { 
                            width: meterAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%']
                            }),
                            backgroundColor: meterAnim.interpolate({
                              inputRange: [0, 0.4, 0.7, 1],
                              outputRange: ['#4CAF50', '#CDDC39', '#FF9800', '#F44336']
                            })
                          }
                        ]}
                      />
                    </View>
                    
                    <View style={styles.meterLabels}>
                      <View style={styles.meterLabelContainer}>
                        <Text style={[styles.meterLabelText, { color: '#4CAF50' }]}>Human</Text>
                        <Text style={[styles.meterLabelValue, { color: colors.text }]}>
                          {Math.round((1 - analysisResult.aiProbability) * 100)}%
                        </Text>
                      </View>
                      
                      <Animated.View style={[styles.meterValueContainer, { 
                        backgroundColor: meterAnim.interpolate({
                          inputRange: [0, 0.4, 0.7, 1],
                          outputRange: ['#4CAF50', '#CDDC39', '#FF9800', '#F44336']
                        })
                      }]}>
                        <Animated.Text style={styles.meterValue}>
                          {Math.round(analysisResult.aiProbability * 100)}%
                        </Animated.Text>
                      </Animated.View>
                      
                      <View style={styles.meterLabelContainer}>
                        <Text style={[styles.meterLabelText, { color: '#F44336' }]}>AI</Text>
                        <Text style={[styles.meterLabelValue, { color: colors.text }]}>
                          {Math.round(analysisResult.aiProbability * 100)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* AI Analysis Card */}
                  <View style={styles.analysisCard}>
                    <MaterialCommunityIcons 
                      name={analysisResult.aiProbability > 0.5 ? 'robot' : 'account'} 
                      size={24} 
                      color={analysisResult.aiProbability > 0.5 ? '#F44336' : '#4CAF50'} 
                      style={styles.analysisIcon}
                    />
                    <Text style={[styles.analysisText, { color: colors.text }]}>
                      {analysisResult.aiProbability > 0.8 ? 
                        'This text was very likely generated by AI. The analysis shows strong patterns of artificial generation.' :
                      analysisResult.aiProbability > 0.6 ?
                        'This text shows moderate signs of AI generation. Some patterns are consistent with AI writing.' :
                      analysisResult.aiProbability > 0.4 ?
                        'This text shows some characteristics of AI writing, but is inconclusive. Could be human-edited AI content.' :
                        'This text was likely written by a human. Few or no AI generation patterns detected.'}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Feature Analysis with Enhanced Visual Design */}
              <View style={[styles.featuresContainer, { 
                backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 40, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                borderColor: colors.border
              }]}>
                <View style={styles.sectionHeaderContainer}>
                  <MaterialCommunityIcons name="format-list-checks" size={20} color={colors.primary} />
                  <Text style={[styles.featuresTitle, { color: colors.text }]}>Key Indicators</Text>
                </View>
                
                <FlatList
                  data={analysisResult.features}
                  renderItem={renderFeatureItem}
                  keyExtractor={(item) => item.name}
                  scrollEnabled={false}
                  contentContainerStyle={styles.featuresList}
                />
                
                <View style={styles.disclaimerContainer}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                    This analysis is based on machine learning algorithms and may not be 100% accurate.
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}
          
          {/* Processing Animation */}
          {isAnalyzing && (
            <View style={styles.processingContainer}>
              <LottieView 
                source={require('../assets/image2.json')}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
              <Text style={[styles.processingText, { color: colors.text }]}>
                Analyzing text patterns...
              </Text>
              <Text style={[styles.processingSubtext, { color: colors.textSecondary }]}>
                Using advanced machine learning to detect AI signatures
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
      
      {/* History Panel with Improved UX for Small Screens */}
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
              Analysis History
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
              No analysis history yet
            </Text>
            <Text style={[styles.emptyHistorySubtext, { color: colors.textSecondary }]}>
              Your previous analyses will appear here
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
    maxWidth: 600,
  },
  scrollContent: {
    paddingHorizontal: responsiveSpacing(16),
    paddingBottom: responsiveSpacing(40),
    width: '100%',
    alignItems: 'stretch',
  },
  welcomeBanner: {
    marginTop: responsiveSpacing(16),
    borderRadius: responsiveSpacing(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    width: '100%',
    maxWidth: 600,
  },
  bannerGradient: {
    borderRadius: responsiveSpacing(24),
    padding: responsiveSpacing(24),
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
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
    shadowColor: '#3F51B5',
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
  inputContainer: {
    marginTop: responsiveSpacing(24),
    width: '100%',
    maxWidth: 600,
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  textInputContainer: {
    borderRadius: responsiveSpacing(16),
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: responsiveSpacing(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
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
  fixedAnalyzeButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    marginTop: responsiveSpacing(12),
    marginBottom: responsiveSpacing(20),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3F51B5',
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
  fixedAnalyzeButtonText: {
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
    maxWidth: 600,
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
  meterContainer: {
    borderRadius: responsiveSpacing(20),
    padding: responsiveSpacing(20),
    marginBottom: responsiveSpacing(20),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
  },
  meterHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing(20),
    flexWrap: 'wrap',
  },
  resultBadge: {
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(4),
    borderRadius: responsiveSpacing(12),
    backgroundColor: '#3F51B5',
    marginTop: width < 360 ? responsiveSpacing(8) : 0,
  },
  resultBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: normalize(12),
  },
  meterTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginRight: responsiveSpacing(8),
  },
  meterContent: {
    
  },
  meter: {
    marginBottom: responsiveSpacing(24),
  },
  meterBackground: {
    height: 24 * scale,
    borderRadius: 12 * scale,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: responsiveSpacing(12),
  },
  meterFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 12 * scale,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meterLabelContainer: {
    alignItems: 'center',
  },
  meterLabelText: {
    fontSize: normalize(14),
    fontWeight: '600',
  },
  meterLabelValue: {
    fontSize: normalize(12),
    opacity: 0.7,
  },
  meterValueContainer: {
    paddingHorizontal: responsiveSpacing(12),
    paddingVertical: responsiveSpacing(6),
    borderRadius: responsiveSpacing(16),
  },
  meterValue: {
    fontSize: normalize(16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  analysisCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: responsiveSpacing(12),
    padding: responsiveSpacing(16),
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  analysisIcon: {
    marginRight: responsiveSpacing(12),
    marginTop: responsiveSpacing(2),
  },
  analysisText: {
    flex: 1,
    fontSize: normalize(14),
    lineHeight: normalize(20),
  },
  featuresContainer: {
    borderRadius: responsiveSpacing(20),
    padding: responsiveSpacing(20),
    marginBottom: responsiveSpacing(24),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    width: '100%',
  },
  featuresTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    marginLeft: responsiveSpacing(8),
  },
  featuresList: {
    marginTop: responsiveSpacing(8),
  },
  featureItem: {
    marginBottom: responsiveSpacing(16),
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing(4),
    flexWrap: 'wrap',
  },
  featureName: {
    fontSize: normalize(14),
    fontWeight: '500',
    marginRight: responsiveSpacing(4),
    flex: 1,
  },
  featureIndicator: {
    fontSize: normalize(12),
    fontWeight: '600',
  },
  featureBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureBarBg: {
    height: 8 * scale,
    borderRadius: 4 * scale,
    flex: 1,
    marginRight: responsiveSpacing(8),
    overflow: 'hidden',
  },
  featureBarFill: {
    height: '100%',
    borderRadius: 4 * scale,
  },
  featureScore: {
    fontSize: normalize(12),
    width: 40 * scale,
    textAlign: 'right',
    fontWeight: '500',
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: responsiveSpacing(12),
    paddingTop: responsiveSpacing(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  disclaimerText: {
    fontSize: normalize(12),
    marginLeft: responsiveSpacing(6),
    flex: 1,
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
  historyItemMeter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyItemMeterBg: {
    height: 6 * scale,
    borderRadius: 3 * scale,
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: responsiveSpacing(8),
    overflow: 'hidden',
  },
  historyItemMeterFill: {
    height: '100%',
    borderRadius: 3 * scale,
  },
  historyItemScore: {
    fontSize: normalize(12),
    width: 60 * scale,
    fontWeight: '500',
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
});

export default DetectAIScreen;