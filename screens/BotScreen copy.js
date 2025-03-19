import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import LottieView from 'lottie-react-native';
import * as Animatable from 'react-native-animatable';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { GestureHandlerRootView, Swipeable, TouchableWithoutFeedback } from 'react-native-gesture-handler';
import ForceDirectedGraph2 from '../components/mindMap2';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AntDesign from 'react-native-vector-icons/AntDesign';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { supabase } from '../supabaseClient';

// Function to decode base64 to ArrayBuffer
const decode = (base64) => {
  const bytes = Buffer.from(base64, 'base64');
  return bytes;
};

// Add a module-scope variable to persist summary call status across mounts
const summaryCalledForAudioId = {};

const BotScreen2 = ({ navigation, route }) => {
  const flatListRef = React.useRef(null);
  const { transcription, XMLData, uid, audioid } = route.params || {};
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data is loaded
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(true); // New state for summary prompt
  const isMounted = useRef(true);
  
  // New state variables for image preview modal
  const [imagePreviewModalVisible, setImagePreviewModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageQuestion, setImageQuestion] = useState('');
  const [imageType, setImageType] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [isQuestionRequired, setIsQuestionRequired] = useState(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);


  useEffect(() => {
    const checkSummaryPreference = async () => {
      if (!isMounted.current || !dataLoaded) return;

      if (!audioid || summaryCalledForAudioId[audioid]) {
        return;
      }

      try {
        const response = await axios.post('https://matrix-server.vercel.app/getSummaryPreference', {
          uid,
          audioid,
        });
        const preference = response.data.preference;

        // Check if chat history is empty
        const chatHistoryIsEmpty = messages.length === 1 && 
          (messages[0]?.text === "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.");

        // If a preference exists ('yes' or 'no') or chat history has data, do not show the prompt
       
      } catch (error) {
        console.error('Error fetching summary preference:', error);
      }
    };

    if (transcription && audioid) {
      checkSummaryPreference();
    }
  }, [transcription, dataLoaded, audioid]);

  const [messages, setMessages] = useState([
    {
      id: '1',
      text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
      sender: 'bot',
    },
    // Add summary request message conditionally
    ...(transcription ? [{
      id: `summary-request-${audioid}`,
      text: "Help me generate a summary of the given transcription",
      sender: 'user',
      fullText: transcription,
    }] : []),
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState({});
  const [fullTranscription, setFullTranscription] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showAdditionalButtons, setShowAdditionalButtons] = useState(false); // New state for additional buttons
  const swipeableRefs = useRef({});

  const toggleMessageExpansion = (messageId) => {
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleAttach = () => {
    setShowAdditionalButtons(prev => !prev); // Toggle additional buttons visibility
    // Change the icon from plus to cross
  };

  // Format message history for API
  const messageHistory = messages.map(msg => ({
    role: msg.sender === 'bot' ? 'assistant' : 'user',
    content: msg.text
  }));

  const handleCamera = (navigation) => {
    navigation.navigate('CameraScreen');
  };

  const saveChatHistory = async (messageText, sender) => {
    try {
      const response = await axios.post('https://matrix-server.vercel.app/sendChat', {
        uid,
        chatid: audioid, // Using audioid as chatid
        updatedMessage: messageText,
        sender,
      });
      console.log('Message saved:', response.data);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        text: inputText,
        sender: 'user',
      };
      setMessages((prev) => [...prev, newMessage]);
      saveChatHistory(inputText, 'user'); // Save user message
      fetchDeepSeekResponse(inputText);
      setInputText('');
      setIsTyping(false);
    }
  };

  const fetchDeepSeekResponse = async (userMessage, retryCount = 0) => {
    const maxRetries = 5;
    const retryDelay = Math.min(Math.pow(2, retryCount) * 1000, 60000);

    setIsLoading(true);
    try {
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...messageHistory,
            { role: 'user', content: userMessage },
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer sk-fed0eb08e6ad4f1aabe2b0c27c643816`
          }
        }
      );

      let botMessage = response.data.choices[0].message.content.trim();
      botMessage = botMessage.replace(/(\*\*|\#\#)/g, "");

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: botMessage, sender: 'bot' },
      ]);
      saveChatHistory(botMessage, 'bot'); // Save bot response
    } catch (error) {
      console.error('Error fetching response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddImage = () => {
    launchImageLibrary({ noData: true }, (response) => {
      if (response.assets) {
        const { uri } = response.assets[0];
        setMessages((prev) => [
          ...prev,
          { 
            id: Date.now().toString(), 
            image: uri,
            sender: 'user' 
          },
        ]);
      }
    });
  };

  // Debounce function
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Debounced input change handler
  const handleInputChange = debounce((text) => {
    setImageQuestion(text);
  }, 300);

  // Image Preview Modal Component
  const ImagePreviewModal = () => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const imageWidth = screenWidth * 0.7;
    const imageHeight = screenHeight * 0.3;
    
    const handleQuickQuestion = (question) => {
      setImageQuestion(question);
      setIsQuestionRequired(false);
    };
    
    const handleConfirm = async () => {
      // Check if question is required and empty
      if (isQuestionRequired && !imageQuestion.trim()) {
        Alert.alert('Question Required', 'Please enter a question about the image before sending.');
        return;
      }
      
      // If we have a valid question or it's not required, proceed
      setImagePreviewModalVisible(false);
      
      if (!selectedImage) return;
      
      try {
        setIsLoading(true);
        
        // Generate a unique image ID
        const imageID = Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
        const fileExtension = imageFileName ? imageFileName.split('.').pop() : 'jpg';
        
        // Read the file as base64
        const fileContent = await RNFS.readFile(selectedImage, 'base64');
        
        // Create file path for Supabase storage
        const filePath = `users/${uid}/Image/${imageID}.${fileExtension}`;
        
        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, decode(fileContent), {
            contentType: imageType || 'image/jpeg',
            upsert: false
          });
          
        if (uploadError) {
          throw new Error(`Upload error: ${uploadError.message}`);
        }
        
        // Get the public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);
        
        // Add the image to messages
        setMessages((prev) => [
          ...prev,
          { 
            id: Date.now().toString(), 
            image: publicUrl,
            sender: 'user' 
          },
        ]);
        
        // Save the image URL to chat history
        await saveChatHistory(publicUrl, 'user');
        
        // Send the image to Volces API
        const VOLCES_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        const VOLCES_API_KEY = '95fad12c-0768-4de2-a4c2-83247337ea89';
        
        const volcesResponse = await axios.post(
          VOLCES_API_URL,
          {
            model: 'doubao-vision-pro-32k-241028',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: imageQuestion || 'What do you see in this image?'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: publicUrl
                    }
                  }
                ]
              }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${VOLCES_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        // Extract the response from Volces API
        const botMessage = volcesResponse.data.choices[0].message.content.trim();
        
        // Add the bot's response to messages
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), text: botMessage, sender: 'bot' },
        ]);
        
        // Save the bot response to chat history
        await saveChatHistory(botMessage, 'bot');
        
      } catch (error) {
        console.error('Error processing image:', error);
        Alert.alert('Error', 'Failed to process image');
        
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), text: 'Error processing image. Please try again.', sender: 'bot' },
        ]);
      } finally {
        setIsLoading(false);
        // Reset state
        setSelectedImage(null);
        setImageQuestion('');
      }
    };
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={imagePreviewModalVisible}
        onRequestClose={() => setImagePreviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setImagePreviewModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>Image Preview</Text>
            
            <View style={styles.imageContainer}>
              {selectedImage && (
                <Image 
                  source={{ uri: selectedImage }} 
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </View>
            
            <TextInput
              style={styles.questionInput}
              value={imageQuestion}
              onChangeText={handleInputChange}
              placeholder="Ask question about your image eg:'What you see in the image'"
              placeholderTextColor="#999"
              multiline
            />
            
            <View style={styles.quickQuestionsContainer}>
              <TouchableOpacity 
                style={styles.quickQuestionButton}
                onPress={() => handleQuickQuestion('What is the solution to this problem or equation shown in the image?')}
              >
                <Text style={styles.quickQuestionText}>What is the solution to this problem or equation shown in the image?</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickQuestionButton}
                onPress={() => handleQuickQuestion('What colors are used in this image and what might they represent?')}
              >
                <Text style={styles.quickQuestionText}>What colors are used in this image and what might they represent?</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickQuestionButton}
                onPress={() => handleQuickQuestion('Describe this image in detail and explain what it might be showing.')}
              >
                <Text style={styles.quickQuestionText}>Describe this image in detail and explain what it might be showing.</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.confirmButton,
                isQuestionRequired && !imageQuestion.trim() ? styles.disabledButton : {}
              ]}
              onPress={handleConfirm}
              disabled={isQuestionRequired && !imageQuestion.trim()}
            >
              <Ionicons name="checkmark" size={24} color="#FFF" />
              <Text style={styles.confirmButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const handleImageOCR = async (source = 'gallery') => {
    const options = {
      mediaType: 'photo',
      quality: 1,
      includeBase64: false,
    };

    try {
      let response;
      
      if (source === 'gallery') {
        response = await launchImageLibrary(options);
      } else if (source === 'camera') {
        response = await launchCamera(options);
      }

      if (response.assets && response.assets.length > 0) {
        const { uri, type, fileName } = response.assets[0];
        
        // Reset question state
        setImageQuestion('');
        setIsQuestionRequired(true);
        
        // Set the selected image and show the modal
        setSelectedImage(uri);
        setImageType(type || 'image/jpeg');
        setImageFileName(fileName || `image_${Date.now()}.jpg`);
        setImagePreviewModalVisible(true);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await axios.post('https://matrix-server.vercel.app/getChat', {
          uid,
          chatid: audioid, // Using audioid as chatid
        });

        const fetchedMessages = response.data.messages || [];
        const hasChatHistory = fetchedMessages.length > 0;

        setMessages((prev) => [
          ...prev,
          ...fetchedMessages.map(msg => ({
            ...msg,
            image: msg.imageUrl || msg.image,
            text: msg.text.replace(/(\*\*|\#\#)/g, ""),
          }))
        ]);

        setDataLoaded(true);
        
        // Only show summary prompt after data is loaded and if there's no chat history
     
      } catch (error) {
        console.error('Error fetching chat history:', error);
        setDataLoaded(true);
       
      }
    };

    // Initially hide the summary prompt while loading
   
    fetchChatHistory();
  }, [audioid]);
  
  const handleGeneratePPT = (message) => {
    navigation.navigate('CreatePPTScreen', {
      message: message.text,
      audioid,
      number: 1,
    });
  };

  const handleGenerateMindmap = (message) => {
    setSelectedMessage(message);
    setIsFullScreen(true);
  };

  // Function to detect if the text is a mathematical expression
  const isMathExpression = (text) => {
    // Skip if text is too long (likely not a math expression)
    if (text.length > 100) return false;
    
    // Skip if it's just a simple number
    if (/^\d+$/.test(text)) return false;
    
    // Skip if it's a date
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text) || /^\d{1,2}\-\d{1,2}\-\d{2,4}$/.test(text)) return false;
    
    // Skip if it's likely a list item with a number (e.g., "1. Item")
    if (/^\d+\.\s+.+/.test(text)) return false;
    
    // Skip if it's likely a normal sentence with numbers
    if (text.split(' ').length > 8 && !/\=/.test(text)) return false;
    
    // Check for equation patterns (must have equals sign)
    const hasEquation = /\=/.test(text);
    
    // Check for mathematical operators
    const hasOperators = /[\+\-\*\/\(\)\[\]\{\}\^×÷]/.test(text);
    
    // Check for number patterns with operators (this is the strongest indicator)
    const hasNumberWithOperator = /\d+\s*[\+\-\*\/\=\(\)\[\]\{\}\^×÷]\s*\d+/.test(text);
    
    // Check for common math expressions at the start of the text
    const isCommonMathExpression = /^(solve|calculate|find|evaluate|simplify|compute)/.test(text.toLowerCase());
    
    // Check for fractions
    const hasFraction = /\d+\s*\/\s*\d+/.test(text) && !/https?:\/\//.test(text); // Exclude URLs
    
    // Check for square roots or exponents or other math functions
    const hasAdvancedMath = /sqrt|square root|\^|x\^2|x\^3|sin\(|cos\(|tan\(|log\(/.test(text.toLowerCase());
    
    // Check for multiple numbers and operators (likely a calculation)
    const hasMultipleOperations = /\d+\s*[\+\-\*\/]\s*\d+\s*[\+\-\*\/]\s*\d+/.test(text);
    
    // Check for specific equation patterns
    const isEquation = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*\=/.test(text) || // 2 + 2 =
                      /^\s*\d+\s*[\+\-\*\/\=]\s*\d+/.test(text) && text.length < 20; // Short expressions like 2+2
    
    // Return true if it looks like a math expression
    return (isEquation ||
            hasNumberWithOperator || 
            (hasEquation && hasOperators) || 
            (isCommonMathExpression && (hasOperators || hasEquation)) ||
            hasFraction || 
            hasAdvancedMath ||
            hasMultipleOperations);
  };

  const renderMessage = ({ item }) => {
    const isBot = item.sender === 'bot';
    const isUser = item.sender === 'user';
    const isExpanded = expandedMessages[item.id];

    // Function to detect if the text contains a URL
    const containsUrl = (text) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text && urlRegex.test(text);
    };

    // Function to process and format the message text
    const formatMessageText = (text) => {
      if (!text) return [];
      
      const lines = text.split('\n');
      return lines.map(line => {
        // Check for heading (starts with number and dot, or has : at the end)
        const isHeading = /^\d+\.\s+.+/.test(line) || /.*:$/.test(line);
        // Check for subheading (starts with - or • or *)
        const isSubheading = /^[-•*]\s+.+/.test(line);
        // Check for mathematical expressions using our new function
        const hasMathExpression = isMathExpression(line);
        
        return {
          text: line,
          isHeading,
          isSubheading,
          hasMathExpression
        };
      });
    };

    const renderLeftActions = () => {
      return (
        <View style={styles.swipeableButtons}>
          <TouchableOpacity
            style={styles.swipeButton}
            onPress={() => handleGenerateMindmap(item)}
          >
            <Ionicons name="git-network-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.swipeButton}
            onPress={() => handleGeneratePPT(item)}
          >
            <AntDesign name="pptfile1" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    };

    // Function to render a single line of text with math expressions highlighted
    const renderTextWithMath = (line, index) => {
      // Use regex to find math expressions in the text
      const mathRegex = /(\d+\s*[\+\-\*\/\=\(\)\[\]\{\}\^×÷]\s*\d+)|(\b\d+\s*[×÷=]\s*\d+\b)/g;
      const matches = line.text.match(mathRegex) || [];
      
      // If we found math expressions, split and format them
      if (matches.length > 0) {
        const parts = line.text.split(mathRegex);
        const elements = [];
        
        parts.forEach((part, i) => {
          if (part) {
            elements.push(
              <Text key={`text-part-${index}-${i}`} style={styles.botText}>
                {part}
              </Text>
            );
          }
          
          if (matches[i]) {
            elements.push(
              <View key={`math-part-${index}-${i}`} style={styles.inlineMathContainer}>
                <Text style={styles.mathText}>{matches[i]}</Text>
              </View>
            );
          }
        });
        
        return (
          <View key={`line-${index}`} style={styles.textLine}>
            {elements}
          </View>
        );
      }
      
      // If no math expressions found, return regular text
      return (
        <Text key={`line-${index}`} style={styles.botText}>
          {line.text}
        </Text>
      );
    };

    return (
      <GestureHandlerRootView>
        <Swipeable
          ref={(ref) => {
            if (ref) {
              swipeableRefs.current[item.id] = ref;
            }
          }}
          renderLeftActions={isBot ? renderLeftActions : null}
          leftThreshold={40}
          rightThreshold={40}
          overshootLeft={false}
          overshootRight={false}
          enabled={isBot}
        >
          <View style={{ flexDirection: isBot ? 'row' : 'row-reverse', alignItems: 'center' }}>
            <Animatable.View
              animation={isBot ? "fadeInUp" : undefined}
              duration={100}
              style={[
                styles.messageContainer,
                isBot ? styles.botMessageContainer : styles.userMessageContainer,
              ]}
            >
              {/* Show image if the user sends an image */}
              {isUser && item.image && (
                <Image source={{ uri: item.image }} style={styles.messageImage} />
              )}

              {/* Show text if the user sends a text message */}
              {isUser && item.text && !containsUrl(item.text) && (
                <Text style={styles.userText}>{item.text}</Text>
              )}

              {/* Bot's message can have both text and images */}
              {isBot && item.image && (
                <Image source={{ uri: item.image }} style={styles.messageImage} />
              )}
              {isBot && item.text && (
                <View style={styles.botTextContainer}>
                  {formatMessageText(item.text).map((line, index) => {
                    // Handle links in the text
                    if (containsUrl(line.text)) {
                      const urlRegex = /(https?:\/\/[^\s]+)/g;
                      const parts = line.text.split(urlRegex);
                      const elements = [];
                      
                      parts.forEach((part, i) => {
                        if (urlRegex.test(part)) {
                          elements.push(
                            <TouchableOpacity 
                              key={`link-${index}-${i}`}
                              onPress={() => Linking.openURL(part)}
                              style={styles.linkContainer}
                            >
                              <Ionicons name="link" size={16} color="#007bff" style={styles.linkIcon} />
                              <Text style={styles.linkText}>{part}</Text>
                            </TouchableOpacity>
                          );
                        } else if (part) {
                          elements.push(<Text key={`text-${index}-${i}`} style={styles.botText}>{part}</Text>);
                        }
                      });
                      
                      return (
                        <View key={`line-${index}`} style={styles.textLine}>
                          {elements}
                        </View>
                      );
                    }
                    
                    // Handle math expressions
                    else if (line.hasMathExpression) {
                      return (
                        <View key={`line-${index}`} style={styles.mathContainer}>
                          <Text style={styles.mathText}>{line.text}</Text>
                        </View>
                      );
                    }
                    
                    // Handle headings
                    else if (line.isHeading) {
                      return (
                        <View key={`line-${index}`} style={styles.headingContainer}>
                          <Text style={styles.headingPointer}>➤</Text>
                          <Text style={styles.headingText}>{line.text}</Text>
                        </View>
                      );
                    }
                    
                    // Handle subheadings
                    else if (line.isSubheading) {
                      return (
                        <View key={`line-${index}`} style={styles.subheadingContainer}>
                          <Text style={styles.subheadingPointer}>•</Text>
                          <Text style={styles.subheadingText}>{line.text}</Text>
                        </View>
                      );
                    }
                    
                    // Regular text - check for inline math expressions
                    else if (isMathExpression(line.text)) {
                      return renderTextWithMath(line, index);
                    }
                    
                    // Plain text with no special formatting
                    else {
                      return (
                        <Text key={`line-${index}`} style={styles.botText}>
                          {line.text}
                        </Text>
                      );
                    }
                  })}
                </View>
              )}
            </Animatable.View>
            <TouchableOpacity
              onPress={() => {
                if (isBot && swipeableRefs.current[item.id]) {
                  swipeableRefs.current[item.id].openLeft();
                }
              }}
            >
              <Ionicons
                name={isBot ? 'arrow-redo-sharp' : ''}
                size={24}
                color="#4588F5FF"
                style={{ marginHorizontal: 5 }}
              />
            </TouchableOpacity>
          </View>
        </Swipeable>
      </GestureHandlerRootView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}  
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image source={require('../assets/back.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
        <View style={styles.headerTextContainer}>
          <Text style={styles.botName}>MatrixAI Bot</Text>
          <Text style={styles.botDescription}>Your virtual assistant</Text>
        </View>
      </View>

      {/* Chat List or Animation */}
      {messages.length === 1 || isApiLoading ? (
        <View style={styles.animationContainer}>
          <LottieView
            source={require('../assets/loading.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chat}
          onContentSizeChange={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          ref={flatListRef}
          style={{ marginBottom: showAdditionalButtons ? 50 : 0 }}
        />
      )}

      {/* Loading Animation */}
      {isLoading && (
        <View style={[styles.loadingContainer, { bottom: showAdditionalButtons ? -50 : -90 }]}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
        </View>
      )}

      {/* Quick Action Buttons */}
      <View style={[styles.quickActionContainer, { bottom: showAdditionalButtons ? 15 : -40 }]}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => transcription && fetchDeepSeekResponse(`Please provide a summary of this text in very structured format in the original language of the transcription: ${transcription}`)}
        >
          <Text style={styles.quickActionText}>Quick Summary</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => transcription && fetchDeepSeekResponse(`Please extract and list the key points from this text in a structured format in the original language of the transcription: ${transcription}`)}
        >
          <Text style={styles.quickActionText}>Key Points</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => transcription && fetchDeepSeekResponse(`Please analyze this text and provide potential solutions or recommendations for any problems or challenges mentioned and in the original language of the transcription: ${transcription}`)}
        >
          <Text style={styles.quickActionText}>Solution</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Input Box */}
      <View style={[styles.chatBoxContainer, { bottom: showAdditionalButtons ? -35 : -90 }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#ccc"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
          multiline
        />
        <TouchableOpacity onPress={handleAttach} style={styles.sendButton}>
          {showAdditionalButtons ? (
            <Ionicons name="close" size={24} color="#4C8EF7" />
          ) : (
            <Ionicons name="add" size={24} color="#4C8EF7" />
          )}
        </TouchableOpacity>
       
        <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#4C8EF7" />
        </TouchableOpacity>
      </View>

      {showAdditionalButtons && (
             <View style={styles.additionalButtonsContainer}>


          <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('camera')}>
            <View style={styles.additionalButton}>
            <Ionicons name="camera" size={24} color="#4C8EF7" />
            </View>
            <Text>Photo</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('gallery')}>
            <View style={styles.additionalButton3}>
            <Ionicons name="image" size={24} color="#4C8EF7" />
            </View>
            <Text>Image</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.additionalButton2}>
            <View style={styles.additionalButton}>
            <Ionicons name="attach" size={24} color="#4C8EF7" />
            </View>
            <Text>Document</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={isFullScreen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsFullScreen(false)}
      >
        <View style={styles.fullScreenContainer}>
          <View style={styles.fullScreenGraphContainer}>
            <ForceDirectedGraph2 message={selectedMessage?.text || ''} uid={uid} audioid={audioid}/>
          </View>
          <TouchableOpacity
            onPress={() => setIsFullScreen(false)}
            style={styles.closeFullScreenButton}
          >
            <Image
              source={require('../assets/close.png')}
              style={styles.closeIcon}
            />
          </TouchableOpacity>
        </View>
      </Modal>

     

      <ImagePreviewModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    marginBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E0E0E0',
  },

  chatBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    alignSelf:'center',
    width: '95%',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'blue',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    marginHorizontal: '5%',
  },
  messageImage: {
    width: 200,  // Adjust width based on your UI design
    height: 200, // Adjust height as needed
    borderRadius: 10,
    marginVertical: 10,
  },
  textInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  sendButton: {
    padding: 10,
  },
  sendIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#4C8EF7',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: '5%',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    zIndex: 100,
    bottom: -60,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mindmapButton: {
    backgroundColor: '#007bff',
  },
  pptButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    maxWidth: '70%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
  },
  botMessageContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0',
    marginLeft: 0,
    marginRight: 10,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#4C8EF7',
    marginRight: 0,
    marginLeft: 10,
  },
  botText: {
    color: '#333',
    fontSize: 16,
  },
  headingText: {
    fontWeight: 'bold',
    fontSize: 17,
    marginVertical: 4,
  },
  subheadingText: {
  
    fontSize: 16,
    marginVertical: 2,
  },
  userText: {
    color: '#FFF',
    fontSize: 16,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 10,
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenGraphContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    marginTop:20,
    marginRight:-10,
    padding: 10,
    overflow: 'hidden',
  },
  closeFullScreenButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6600',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
  },
  closeIcon: {
    width: 20,
    height: 20,
    tintColor: '#fff',
  },
  animationContainer: {
    width: '100%',
    height: 600,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFFFF',
    borderRadius: 20,
    margin: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    zIndex: 1,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',

    left: -200,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 300,
    height: 300,
  },
  headerIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  botIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: 10,
  },
  headerTextContainer: {
    marginLeft: 10,
  },
  botName: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  botDescription: {
    color: '#888',
    fontSize: 14,
  },
  viewMoreText: {
    color: '#007bff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  swipeableButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  swipeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  additionalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: -100, // Adjust based on your layout
    width: '100%',
 
  },
  additionalButton: {
    alignItems: 'center',
    backgroundColor:'#76767651',
    borderRadius:15,
  padding:8,
  },
  additionalButton3: {
    alignItems: 'center',
    alignSelf:'center',
    backgroundColor:'#76767651',
    borderRadius:15,
  padding:8,
  zIndex:30,
  },
  additionalButton2: {
    alignItems: 'center',
    flexDirection:'column',
  },
  additionalIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  summaryPromptContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  summaryPromptText: {
    fontSize: 16,
    marginBottom: 10,
  },
  summaryPromptButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  summaryPromptButton: {
    padding: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
  },
  summaryPromptButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  quickActionContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 10,
  },
  quickActionButton: {

    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    marginHorizontal: 5,
    elevation: 2,
    borderWidth:1,
    borderColor:'#4C8EF7',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  quickActionText: {
    color: '#4C8EF7',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    justifyContent: 'space-between',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
    marginTop: 5,
  },
  imageContainer: {
    height: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
    maxHeight: 80,
    textAlignVertical: 'top',
    width: '100%',
  },
  quickQuestionsContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 15,
    maxHeight: 200,
    width: '100%',
  },
  quickQuestionButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#4C8EF7',
    borderRadius: 10,
    marginBottom: 8,
    width: '100%',
  },
  quickQuestionText: {
    fontSize: 14,
    color: '#4C8EF7',
  },
  confirmButton: {
    backgroundColor: '#4C8EF7',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 5,
    width: '100%',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  botTextContainer: {
    flexDirection: 'column',
  },
  textLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 2,
  },
  mathContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  mathText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  headingPointer: {
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 5,
    color: '#4C8EF7',
  },
  headingText: {
    fontWeight: 'bold',
    fontSize: 17,
    color: '#333',
    flex: 1,
  },
  subheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingLeft: 10,
  },
  subheadingPointer: {
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 5,
    color: '#4C8EF7',
  },
  subheadingText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  linkText: {
    color: '#007bff',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkIcon: {
    marginRight: 5,
  },
  inlineMathContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
});

export default BotScreen2;
