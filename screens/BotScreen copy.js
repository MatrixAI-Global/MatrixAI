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
  KeyboardAvoidingView,
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
import { useTheme } from '../context/ThemeContext';
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
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();  
  // Initialize messages state first
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
      sender: 'bot',
    },
  ]);

  // New state variables for image preview modal
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageType, setImageType] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState(null);

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

        // If chat is empty and we have transcription, show the prompt
        if (chatHistoryIsEmpty && transcription) {
          setShowSummaryPrompt(true);
        }
      } catch (error) {
        console.error('Error fetching summary preference:', error);
      }
    };

    if (transcription && audioid) {
      checkSummaryPreference();
    }
  }, [transcription, dataLoaded, audioid, messages.length]);

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

  const handleSendMessage = async () => {
    if (inputText.trim() || selectedImage) {
      // If there's an image, process it
      if (selectedImage) {
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
          const newMessage = {
            id: Date.now().toString(),
            image: publicUrl,
            text: inputText.trim() ? inputText : "",
            sender: 'user'
          };
          
          setMessages((prev) => [...prev, newMessage]);
          setSelectedImage(null);
          setInputText('');

          // Save the chat history for the image
          await saveChatHistory(publicUrl, 'user');
          
          // If there's text, use it as the question, otherwise use a default
          const question = inputText.trim() ? inputText : "What do you see in this image?";
          
          // Send request to Volces API
          const volcesResponse = await axios.post(
            'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            {
              model: 'doubao-vision-pro-32k-241028',
              messages: [
                {
                  role: 'system',
                  content: 'You are MatrixAI Bot, a helpful AI assistant.'
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: question
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
                'Authorization': 'Bearer 95fad12c-0768-4de2-a4c2-83247337ea89',
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
          
          // Save the chat history for the bot response
          await saveChatHistory(botMessage, 'bot');
          
          // Clear the image and text
          setSelectedImage(null);
          setInputText('');
          
        } catch (error) {
          console.error('Error processing image:', error);
          Alert.alert('Error', 'Failed to process image');
          
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), text: 'Error processing image. Please try again.', sender: 'bot' },
          ]);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Regular text message handling
        const newMessage = {
          id: Date.now().toString(),
          text: inputText,
          sender: 'user',
        };
        setMessages((prev) => [...prev, newMessage]);
        saveChatHistory(inputText, 'user');
        fetchDeepSeekResponse(inputText);
        setInputText('');
      }
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
        
        // Set the selected image
        setSelectedImage(uri);
        setImageType(type || 'image/jpeg');
        setImageFileName(fileName || `image_${Date.now()}.jpg`);
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

        if (hasChatHistory) {
          // If we have chat history, update messages with fetched messages
          setMessages((prev) => [
            ...prev,
            ...fetchedMessages.map(msg => ({
              ...msg,
              image: msg.imageUrl || msg.image,
              text: msg.text.replace(/(\*\*|\#\#)/g, ""),
            }))
          ]);
        } else {
          // If no chat history, save the initial greeting message to database
          const initialMessage = {
            id: '1',
            text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
            sender: 'bot',
          };
          
          // Save initial message to database
          await saveChatHistory(initialMessage.text, initialMessage.sender);
        }

        setDataLoaded(true);
      } catch (error) {
        console.error('Error fetching chat history:', error);
        setDataLoaded(true);
      }
    };

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

    // Function to detect if text has math subscripts
    const hasMathSubscripts = (text) => {
      return /([a-zA-Z])_(\d)|([a-zA-Z])_n|([a-zA-Z])_i|([a-zA-Z])_j|([a-zA-Z])_k|([a-zA-Z])_a|([a-zA-Z])_x|([a-zA-Z])_\{([^}]+)\}/.test(text);
    };

    // Function to render text with math expressions
    const renderTextWithMath = (line, index) => {
      // Add support for subscript notation
      if (hasMathSubscripts(line.text)) {
        // Process subscripts
        const formattedText = line.text
          .replace(/([a-zA-Z])_(\d)/g, (match, p1, p2) => {
            const subscripts = {
              '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
              '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
            };
            return p1 + subscripts[p2];
          })
          .replace(/([a-zA-Z])_n/g, '$1ₙ')
          .replace(/([a-zA-Z])_i/g, '$1ᵢ')
          .replace(/([a-zA-Z])_j/g, '$1ⱼ')
          .replace(/([a-zA-Z])_k/g, '$1ₖ')
          .replace(/([a-zA-Z])_a/g, '$1ₐ')
          .replace(/([a-zA-Z])_x/g, '$1ₓ')
          .replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1ₙ');
        
        return (
          <View key={`math-line-${index}`} style={styles.mathContainer}>
            <Text style={styles.mathText}>{formattedText}</Text>
          </View>
        );
      }
      
      // Use regex to find math expressions in the text
      const mathRegex = /(\d+\s*[\+\-\*\/\=\(\)\[\]\{\}\^×÷]\s*\d+)|(\b\d+\s*[×÷=]\s*\d+\b)|(sqrt\([^)]+\))|(sin\([^)]+\))|(cos\([^)]+\))|(tan\([^)]+\))|(log\([^)]+\))/g;
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
            // Format the math expression for better readability
            const { formattedMath, hasFraction, hasSquareRoot } = formatMathExpression(matches[i]);
            
            if (hasFraction) {
              // Split the formula to find fractions
              const fractionParts = parseFractionFormula(formattedMath);
              
              elements.push(
                <View key={`math-part-${index}-${i}`} style={styles.mathContainer}>
                  {renderFractionFormula(fractionParts)}
                </View>
              );
            } else if (hasSquareRoot) {
              // Handle square root specially
              elements.push(
                <View key={`math-part-${index}-${i}`} style={styles.mathContainer}>
                  {renderSquareRoot(formattedMath)}
                </View>
              );
            } else {
              elements.push(
                <View key={`math-part-${index}-${i}`} style={styles.mathContainer}>
                  <Text style={styles.mathText}>{formattedMath}</Text>
                </View>
              );
            }
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

    // Parse a math formula to identify fractions
    const parseFractionFormula = (formula) => {
      // Split the formula into parts - operators, numbers, and fractions
      const fractionRegex = /(\d+)\s*\/\s*(\d+)/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = fractionRegex.exec(formula)) !== null) {
        // Add the text before the fraction
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: formula.substring(lastIndex, match.index).trim()
          });
        }
        
        // Add the fraction
        parts.push({
          type: 'fraction',
          numerator: match[1].trim(),
          denominator: match[2].trim()
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add any remaining text
      if (lastIndex < formula.length) {
        parts.push({
          type: 'text',
          content: formula.substring(lastIndex).trim()
        });
      }
      
      return parts.length > 0 ? parts : [{ type: 'text', content: formula }];
    };
    
    // Render a formula with proper fractions
    const renderFractionFormula = (parts) => {
      return (
        <View style={styles.formulaContainer}>
          {parts.map((part, i) => {
            if (part.type === 'text') {
              return (
                <Text key={`formula-part-${i}`} style={styles.mathText}>
                  {part.content}
                </Text>
              );
            } else if (part.type === 'fraction') {
              return (
                <View key={`fraction-${i}`} style={styles.fractionContainer}>
                  <Text style={styles.numerator}>{part.numerator}</Text>
                  <View style={styles.fractionLine} />
                  <Text style={styles.denominator}>{part.denominator}</Text>
                </View>
              );
            }
            return null;
          })}
        </View>
      );
    };
    
    // Render square root notation
    const renderSquareRoot = (formula) => {
      // Extract the content inside the square root
      const rootMatch = formula.match(/√\(([^)]+)\)/);
      const rootContent = rootMatch ? rootMatch[1] : formula.replace(/√/g, '').trim();
      
      return (
        <View style={styles.sqrtContainer}>
          <Text style={styles.sqrtSymbol}>√</Text>
          <View style={styles.sqrtOverline}>
            <View style={styles.sqrtBar} />
            <Text style={styles.mathText}>{rootContent}</Text>
          </View>
        </View>
      );
    };
    
    // Function to format math expressions to be more readable
    const formatMathExpression = (expression) => {
      // Replace * with × for multiplication and add line break
      let formatted = expression.replace(/\*/g, ' ×\n');
      
      // Add line breaks for complex expressions
      formatted = formatted.replace(/([+\-=×])\s*/g, '$1\n');
      
      // Check if the expression has fractions
      const hasFraction = /\d+\s*\/\s*\d+/.test(formatted);
      
      // Check if the expression has square roots
      const hasSquareRoot = /√\(([^)]+)\)/.test(formatted) || /√\d+/.test(formatted);
      
      // Format common mathematical functions
      formatted = formatted.replace(/sqrt\(([^)]+)\)/g, '√($1)');
      formatted = formatted.replace(/square root of (\d+)/gi, '√$1');
      formatted = formatted.replace(/square root/gi, '√');
      
      // Format pi
      formatted = formatted.replace(/\bpi\b/gi, 'π');
      
      // Format trigonometric functions
      formatted = formatted.replace(/\b(sin|cos|tan)\(/g, '$1(');
      
      // Format logarithmic functions
      formatted = formatted.replace(/\blog\(/g, 'log(');
      
      // Handle subscripts like a_{n}
      formatted = formatted.replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1ₙ');
      
      // Handle specific subscripts
      formatted = formatted.replace(/_0/g, '₀');
      formatted = formatted.replace(/_1/g, '₁');
      formatted = formatted.replace(/_2/g, '₂');
      formatted = formatted.replace(/_3/g, '₃');
      formatted = formatted.replace(/_4/g, '₄');
      formatted = formatted.replace(/_5/g, '₅');
      formatted = formatted.replace(/_6/g, '₆');
      formatted = formatted.replace(/_7/g, '₇');
      formatted = formatted.replace(/_8/g, '₈');
      formatted = formatted.replace(/_9/g, '₉');
      formatted = formatted.replace(/_n/g, 'ₙ');
      formatted = formatted.replace(/_i/g, 'ᵢ');
      formatted = formatted.replace(/_j/g, 'ⱼ');
      formatted = formatted.replace(/_k/g, 'ₖ');
      formatted = formatted.replace(/_a/g, 'ₐ');
      formatted = formatted.replace(/_x/g, 'ₓ');
      
      // Handle exponents
      formatted = formatted.replace(/\^2/g, '²');
      formatted = formatted.replace(/\^3/g, '³');
      formatted = formatted.replace(/\^4/g, '⁴');
      formatted = formatted.replace(/\^5/g, '⁵');
      formatted = formatted.replace(/\^6/g, '⁶');
      formatted = formatted.replace(/\^7/g, '⁷');
      formatted = formatted.replace(/\^8/g, '⁸');
      formatted = formatted.replace(/\^9/g, '⁹');
      formatted = formatted.replace(/\^0/g, '⁰');
      
      // Handle variables with exponents
      formatted = formatted.replace(/([a-z])\^2/gi, '$1²');
      formatted = formatted.replace(/([a-z])\^3/gi, '$1³');
      formatted = formatted.replace(/([a-z])\^4/gi, '$1⁴');
      formatted = formatted.replace(/([a-z])\^5/gi, '$1⁵');
      formatted = formatted.replace(/([a-z])\^6/gi, '$1⁶');
      formatted = formatted.replace(/([a-z])\^7/gi, '$1⁷');
      formatted = formatted.replace(/([a-z])\^8/gi, '$1⁸');
      formatted = formatted.replace(/([a-z])\^9/gi, '$1⁹');
      
      // Format common formulas
      formatted = formatted.replace(/a\^2\s*\+\s*b\^2\s*=\s*c\^2/g, 'a² + b² = c²');
      formatted = formatted.replace(/E\s*=\s*mc\^2/g, 'E = mc²');
      formatted = formatted.replace(/F\s*=\s*ma/g, 'F = ma');
      
      // Format area formulas
      formatted = formatted.replace(/area\s*=\s*πr\^2/gi, 'Area = πr²');
      formatted = formatted.replace(/area\s*=\s*π\s*×\s*r\^2/gi, 'Area = π × r²');
      formatted = formatted.replace(/area\s*=\s*l\s*×\s*w/gi, 'Area = L × W');
      
      // Format perimeter formulas
      formatted = formatted.replace(/perimeter\s*=\s*2\s*×\s*\(l\s*\+\s*w\)/gi, 'Perimeter = 2 × (L + W)');
      formatted = formatted.replace(/circumference\s*=\s*2\s*×\s*π\s*×\s*r/gi, 'Circumference = 2 × π × r');
      
      // Clean up excess spaces and line breaks
      formatted = formatted.replace(/\s+/g, ' ').trim();
      
      return { formattedMath: formatted, hasFraction, hasSquareRoot };
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
            {item.image ? (
              <TouchableOpacity onPress={() => handleImageTap(item.image)}>
                <Image
                  source={{ uri: item.image }}
                  style={{ width: 200, height: 200, borderRadius: 10 }}
                />
              </TouchableOpacity>
            ) : (
              <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
                {formatMessageText(item.text).map((line, index) => {
                  if (line.isLatexFormula) {
                    return renderLatexFormula(line.text, index);
                  }
                  
                  if (line.isChineseMath) {
                    if (line.isChineseHeading) {
                      return (
                        <Text key={`chinese-heading-${index}`} style={styles.chineseMathHeading}>
                          {line.text}
                        </Text>
                      );
                    }
                    
                    if (line.isChineseSubheading) {
                      return (
                        <Text key={`chinese-subheading-${index}`} style={styles.chineseMathSubheading}>
                          {line.text}
                        </Text>
                      );
                    }
                    
                    return (
                      <Text key={`chinese-math-text-${index}`} style={styles.chineseMathText}>
                        {line.text}
                      </Text>
                    );
                  }
                  
                  return renderTextWithMath(line, index);
                })}
              </View>
            )}
            <View style={isBot ? styles.botTail : styles.userTail} />
          </Animatable.View>
        </View>
      </Swipeable>
      </GestureHandlerRootView>
    );
  };

  // Function to handle image tap and show fullscreen view
  const handleImageTap = (imageUri) => {
    setFullScreenImage(imageUri);
  };

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      {/* Header */}  
      <View style={[styles.header, {backgroundColor: colors.background2}]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Image source={require('../assets/back.png')} style={[styles.headerIcon, {tintColor: colors.text}]} />
          </TouchableOpacity>
        <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.botName, {color: colors.text}]}>MatrixAI Bot</Text>
          <Text style={[styles.botDescription, {color: colors.text}]  }>Your virtual assistant</Text>
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
          contentContainerStyle={[styles.chat,]}
          onContentSizeChange={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          ref={flatListRef}
          style={{ marginBottom: showAdditionalButtons ? 200 : 100 }}
         
        />
      )}
        <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 10}
      >
      {/* Loading Animation */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
        </View>
      )}

      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <View style={styles.imageIconContainer}>
            <Ionicons name="image-outline" size={24} color="#fff" />
          </View>
          <Text style={styles.imageNameText} numberOfLines={1} ellipsizeMode="middle">
            {imageFileName || "Selected Image"}
          </Text>
          <TouchableOpacity 
            style={styles.removeImageButton}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Action Buttons */}
      <View style={styles.quickActionContainer}>
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
      <View style={styles.chatBoxContainer}>
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
            <Ionicons name="close" size={28} color="#4C8EF7" />
          ) : (
            <Ionicons name="add" size={28} color="#4C8EF7" />
          )}
        </TouchableOpacity>
       
        <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#4C8EF7" />
        </TouchableOpacity>
      </View>

      {showAdditionalButtons && (
             <View style={[styles.additionalButtonsContainer, {backgroundColor: colors.background2}]  }>
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('camera')}>
                        <View style={styles.additionalButton}>
                            <Ionicons name="camera" size={28} color="#4C8EF7" />
                        </View>
                        <Text>Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('gallery')}>
                        <View style={styles.additionalButton}>
                            <Ionicons name="image" size={28} color="#4C8EF7" />
                        </View>
                        <Text>Image</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.additionalButton2}>
                        <View style={styles.additionalButton}>
                            <Ionicons name="attach" size={28} color="#4C8EF7" />
                        </View>
                        <Text>Document</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )}
</KeyboardAvoidingView>

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

      {/* Add the full screen image modal */}
      <Modal
        visible={fullScreenImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenImageContainer}>
          <Image
            source={{ uri: fullScreenImage }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.closeFullScreenButton}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
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
 
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  textInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
  },
  sendButton: {
    padding: 5,
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
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
  },

  botMessageContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0',
    marginLeft: 15, // Add margin to accommodate the tail
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#4C8EF7',
    marginRight: 15, // Add margin to accommodate the tail
  },
  botTail: {
    position: 'absolute',
    left: -10, // Adjust based on the tail image size
    bottom: 0,
    width: 15, // Adjust based on the tail image size
    height: 15, // Adjust based on the tail image size
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E0E0E0', // Match bot message background color
  },
  userTail: {
    position: 'absolute',
    right: -10, // Adjust based on the tail image size
    bottom: 0,
    width: 15, // Adjust based on the tail image size
    height: 15, // Adjust based on the tail image size
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#4C8EF7', // Match user message background color
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
  additionalButton: {
    alignItems: 'center',
    backgroundColor:'#D1D1D151',
    borderRadius:15,
    width:'90%',
    paddingVertical:23,
   padding:28,
  },
  additionalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
paddingVertical:10,
marginBottom:-10,
    backgroundColor: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  additionalButton2: {
    flex: 1, // Allow buttons to take equal space
    alignItems: 'center', // Center the content
  },
  additionalButton3: {
    alignItems: 'center',
    alignSelf:'center',
    backgroundColor:'#76767651',
    borderRadius:15,
    width:'90%',
    paddingVertical:23,
   padding:28,
  zIndex:30,
  },

  additionalIcon: {
    width: 28,
    height: 28,
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
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 10,
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

  botTextContainer: {
    flexDirection: 'column',
    flexShrink: 1,
    width: '100%',
    overflow: 'hidden',
  },
  userTextContainer: {
    flexDirection: 'column',
    flexShrink: 1,
    width: '100%',
    overflow: 'hidden',
  },
  textLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 2,
  },
  mathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 2,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  mathText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#1B5E20',
    letterSpacing: 1,
    flexShrink: 1,
  },
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
 width:'80%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  
  },
  headingPointer: {
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 8,
    color: '#1976D2',
  },
  headingText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#1976D2',
    flex: 1,
  },
  subheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
   
  width:'80%',
  },
  subheadingPointer: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
    color: '#2196F3',
  },
  subheadingText: {
    fontWeight: 'bold',
    fontSize: 12,
    color: '#2196F3',
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
    backgroundColor: '#EAF5FF',
    borderRadius: 12,
    padding: 8,
    marginVertical: 4,
    borderWidth: 2,
    borderColor: '#4C8EF7',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  formulaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  fractionContainer: {
    alignItems: 'center',
    marginHorizontal: 4,
    minWidth: 30,
    paddingHorizontal: 2,
  },
  fractionLine: {
    height: 2,
    backgroundColor: '#1B5E20',
    width: '80%',
    marginVertical: 3,
  },
  numerator: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#1B5E20',
    textAlign: 'center',
    paddingBottom: 2,
  },
  denominator: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#1B5E20',
    textAlign: 'center',
    paddingTop: 2,
  },
  sqrtContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sqrtSymbol: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1B5E20',
    marginRight: 2,
  },
  sqrtOverline: {
    position: 'relative',
    paddingTop: 4,
  },
  sqrtBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#1B5E20',
  },
  complexMathContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 1,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    flexWrap: 'wrap',
    flexShrink: 1,
    overflow: 'hidden',
  },
  complexMathText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1B5E20',
    letterSpacing: 1,
    lineHeight: 26,
    flexShrink: 1,
  },
  chineseMathHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
    marginTop: 12,
    backgroundColor: '#E3F2FD',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  chineseMathSubheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 6,
    marginTop: 8,
    paddingLeft: 12,
    backgroundColor: '#F5F5F5',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chineseMathText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 6,
  },
  imagePreviewContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    width: '70%',
 marginLeft:'15',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#4C8EF7',
    marginBottom: 10,
    zIndex: 5,
  },
  imageIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4C8EF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageNameText: {
    color: '#333',
    fontSize: 14,
    flex: 1,
    marginHorizontal: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#4C8EF7',
    borderRadius: 15,
    padding: 2,
    zIndex: 10,
  },
  fullScreenImageContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '90%',
  },
  keyboardAvoidingView: {
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});

export default BotScreen2;
