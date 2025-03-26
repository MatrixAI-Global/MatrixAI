import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,

  TextInput,
  TouchableOpacity,
  Image,
  DrawerLayoutAndroid,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';
import * as Animatable from 'react-native-animatable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { supabase } from '../supabaseClient';

import LeftNavbarBot from '../components/LeftNavbarBot';

// Function to decode base64 to ArrayBuffer
const decode = (base64) => {
  const bytes = Buffer.from(base64, 'base64');
  return bytes;
};

const BotScreen = ({ navigation, route }) => {
  const { chatName, chatDescription, chatImage, chatid } = route.params;
  const flatListRef = React.useRef(null);
  const [chats, setChats] = useState([
    {
      id: '1',
      name: 'First Chat',
      description: 'Your initial chat with MatrixAI Bot.',
      role: '',
      messages: [
        {
          id: '1',
          text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
          sender: 'bot',
        },
      ],
    },
  ]);
  const [currentChatId, setCurrentChatId] = useState('1');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentChat = chats.find(chat => chat.id === currentChatId);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showInput, setShowInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);  // Track if user is typing
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data is loaded
  const [expandedMessages, setExpandedMessages] = useState({}); // Track expanded messages
  const uid = 'user123';
  const [showAdditionalButtons, setShowAdditionalButtons] = useState(false); 
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentRole, setCurrentRole] = useState('');
  
  // Modified image handling
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageType, setImageType] = useState('');
  const [imageFileName, setImageFileName] = useState('');

  const onDeleteChat = async (chatId) => {
    try {
      // Remove chat from local state
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
      
      // If the deleted chat is the current chat, select another chat or start a new one
      if (chatId === currentChatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          // Select the first available chat
          selectChat(remainingChats[0].id);
        } else {
          // If no chats remain, start a new one
          startNewChat();
        }
      }
      
      // Optionally, delete chat from server
      try {
        await axios.post('https://matrix-server.vercel.app/deleteChat', {
          uid,
          chatid: chatId
        });
        console.log('Chat deleted from server');
      } catch (serverError) {
        console.error('Error deleting chat from server:', serverError);
        // Continue with local deletion even if server deletion fails
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete chat');
    }
  };

  const fetchDeepSeekResponse = async (userMessage, retryCount = 0) => {
    const maxRetries = 5;
    const retryDelay = Math.min(Math.pow(2, retryCount) * 1000, 60000); // Max delay is 1 minute

    setIsLoading(true);
    try {
      // Format message history for API
      const messageHistory = messages.map(msg => ({
        role: msg.sender === 'bot' ? 'assistant' : 'user',
        content: msg.text
      }));

      // Create system message with role information if available
      let systemContent = 'You are MatrixAI Bot, a helpful AI assistant.';
      
      // Find the current chat to get the detailed roleDescription
      const currentChatObj = chats.find(chat => chat.id === currentChatId);
      
      if (currentRole) {
        if (currentChatObj && currentChatObj.roleDescription) {
          // Use the detailed roleDescription for the system content
          systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. ${currentChatObj.roleDescription}`;
        } else {
          // Fallback to simpler system content if roleDescription isn't available
          systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. Please provide responses with the expertise and perspective of a ${currentRole} while being helpful and informative.`;
        }
      }

      const response = await axios.post(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
          model: 'deepseek-r1-250120',
          messages: [
            { role: 'system', content: systemContent },
            ...messageHistory,
            { role: 'user', content: userMessage },
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer 95fad12c-0768-4de2-a4c2-83247337ea89`
          }
        }
      );

      const botMessage = response.data.choices[0].message.content.trim();

      let chatNameUpdated = false;
      setChats(prevChats => prevChats.map(chat => {
        if (chat.id === currentChatId && chat.name === 'New Chat' && !chatNameUpdated) {
          chatNameUpdated = true;
          return { ...chat, name: `Message: ${botMessage.substring(0, 20)}`, description: userMessage, role: currentRole };
        }
        return chat;
      }));

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: botMessage, sender: 'bot' },
      ]);

      // Save the bot's message to the server
      await saveChatHistory(botMessage, 'bot');
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Error occurred. Retrying in ${retryDelay / 1000} seconds...`);
        setTimeout(() => fetchDeepSeekResponse(userMessage, retryCount + 1), retryDelay);
      } else {
        console.error(error);
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), text: 'Error fetching response. Try again later.', sender: 'bot' },
        ]);
      }
    } finally {
      setIsLoading(false);
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
          
          // Create system message with role information if available
          let systemContent = 'You are MatrixAI Bot, a helpful AI assistant.';
          
          // Find the current chat to get the detailed roleDescription
          const currentChatObj = chats.find(chat => chat.id === currentChatId);
          
          if (currentRole) {
            if (currentChatObj && currentChatObj.roleDescription) {
              // Use the detailed roleDescription for the system content
              systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. ${currentChatObj.roleDescription}`;
            } else {
              // Fallback to simpler system content if roleDescription isn't available
              systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. Please provide responses with the expertise and perspective of a ${currentRole} while being helpful and informative.`;
            }
          }
          
          // Send request to Volces API
          const volcesResponse = await axios.post(
            'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            {
              model: 'doubao-vision-pro-32k-241028',
              messages: [
                {
                  role: 'system',
                  content: systemContent
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
        // Regular text message handling (existing code)
        const newMessage = {
          id: Date.now().toString(),
          text: inputText,
          sender: 'user',
        };
        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);
        // Update the current chat's messages
        setChats(prevChats => prevChats.map(chat => 
          chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat
        ));

        // Save the user's message to the server
        await saveChatHistory(inputText, 'user');
        
        fetchDeepSeekResponse(inputText);  // Fetch response from DeepSeek
        setInputText('');
      }
      setIsTyping(false);
    }
  };

  const saveChatHistory = async (messageText, sender) => {
    try {
      const response = await axios.post('https://matrix-server.vercel.app/sendChat', {
        uid,
        chatid,
        updatedMessage: messageText,
        sender,
      });
      console.log('Message saved:', response.data);
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    setIsTyping(text.length > 0); // Toggle typing state
  };

  const toggleMessageExpansion = (messageId) => {
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };
  const isMathExpression = (text) => {
    // Skip if text is too long (likely not a math expression)
    if (text.length > 100) return false;
    
    // Skip if it's just a simple number
    if (/^\d+$/.test(text)) return false;
    
    // Skip if it's a date
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text) || /^\d{1,2}\-\d{1,2}\-\d{2,4}$/.test(text)) return false;
    
    // Skip if it's likely a list item with a number (e.g., "1. Item")
    if (/^\d+\.\s+.+/.test(text) && !text.includes('=')) return false;
    
    // Skip if it's likely a normal sentence with numbers
    if (text.split(' ').length > 8 && !/[\=\+\-\*\/\^\(\)]/.test(text)) return false;
    
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
    const hasAdvancedMath = /sqrt|square root|\^|x\^2|x\^3|sin\(|cos\(|tan\(|log\(|π|pi/.test(text.toLowerCase());
    
    // Check for multiple numbers and operators (likely a calculation)
    const hasMultipleOperations = /\d+\s*[\+\-\*\/]\s*\d+\s*[\+\-\*\/]\s*\d+/.test(text);
    
    // Check for specific equation patterns
    const isEquation = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*\=/.test(text) || // 2 + 2 =
                      /^\s*\d+\s*[\+\-\*\/\=]\s*\d+/.test(text) && text.length < 20; // Short expressions like 2+2
    
    // Check for common school math formulas
    const hasCommonFormula = /(area|perimeter|volume|circumference|radius|diameter)\s*[\=:]/.test(text.toLowerCase()) ||
                            /(a\^2\s*\+\s*b\^2\s*=\s*c\^2)|(E\s*=\s*mc\^2)|(F\s*=\s*ma)/.test(text);
    
    // Check for equations with variables
    const hasVariables = /[a-z]\s*[\+\-\*\/\=]\s*\d+/.test(text.toLowerCase()) || 
                        /\d+\s*[\+\-\*\/\=]\s*[a-z]/.test(text.toLowerCase()) ||
                        /[a-z]\s*[\+\-\*\/\=]\s*[a-z]/.test(text.toLowerCase());
    
    // Check for subscript notation like a_n or a_{n}
    const hasSubscript = /[a-z]_[a-z0-9]/.test(text.toLowerCase()) ||
                       /[a-z]_\{[^}]+\}/.test(text.toLowerCase());
    
    // Return true if it looks like a math expression
    return (isEquation ||
            hasNumberWithOperator || 
            (hasEquation && hasOperators) || 
            (isCommonMathExpression && (hasOperators || hasEquation)) ||
            hasFraction || 
            hasAdvancedMath ||
            hasMultipleOperations ||
            hasCommonFormula ||
            hasVariables ||
            hasSubscript);
  };

  // Check if text looks like it has a math expression with subscripts
  const hasMathSubscripts = (text) => {
    // Check for common subscript patterns like a_n, x_i, etc.
    return /[a-zA-Z]_[a-zA-Z0-9]/.test(text) || 
           /[a-zA-Z]_\{[^}]+\}/.test(text);
  };

  const renderMessage = ({ item }) => {
    // Log the messages state for debugging
    console.log('Messages:', messages);
    
    // Ensure messages is an array and data is loaded
    if (!dataLoaded || !Array.isArray(messages) || messages.length === 0) return null; 
  
    const isBot = item.sender === 'bot';
    const isExpanded = expandedMessages[item.id];
    const shouldTruncate = item.text && item.text.length > 100; // Check if text exists
    const displayText = shouldTruncate && !isExpanded 
      ? `${item.text.substring(0, 100)}...`
      : item.text;

    // Check if the message has an image
    if (item.image) {
      return (
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          style={[
            styles.messageContainer,
            isBot ? styles.botMessageContainer : styles.userMessageContainer,
          ]}
        >
          <Image
            source={{ uri: item.image }}
            style={styles.chatImage}
            resizeMode="cover"
          />
          {item.text && (
            <Text style={isBot ? styles.botText : styles.userText}>
              {item.text}
            </Text>
          )}
          <View style={isBot ? styles.botTail : styles.userTail} />
        </Animatable.View>
      );
    }
  
    // Function to detect if the text contains a URL
    const containsUrl = (text) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text && urlRegex.test(text);
    };
  
    // Function to process and format the message text
    const formatMessageText = (text) => {
      if (!text) return [];
      
      // Remove "###", "***", "**", and "---" from the text
      text = text.replace(/###/g, '')
                 .replace(/\*\*\*/g, '')
                 .replace(/\*\*/g, '')
                 .replace(/---/g, ''); // Remove "---"

      // Check if the text contains LaTeX-style formulas (\[ \] or \( \))
      const hasLatexFormulas = /\\\[.*?\\\]|\\\(.*?\\\)/s.test(text);

      // Special handling for mathematical content in Chinese text
      if (hasLatexFormulas) {
        return formatMathematicalContent(text);
      }

      const lines = text.split('\n');
      return lines.map(line => {
        // Check for heading (starts with number and dot, or has : at the end)
        const isHeading = /^\d+\.\s+.+/.test(line) || /.*:$/.test(line);
        // Check for subheading (starts with - or • or *)
        const isSubheading = /^[-•*]\s+.+/.test(line);
        // Check for mathematical expressions
        const hasMathExpression = isMathExpression(line);
        
        return {
          text: line,
          isHeading,
          isSubheading,
          hasMathExpression
        };
      });
    };
  
    // Format specialized mathematical content (like LaTeX formatted math expressions)
    const formatMathematicalContent = (text) => {
      // Split by LaTeX formula delimiters
      const parts = [];
      let currentIndex = 0;
      
      // Create a regex that captures LaTeX formulas
      const latexRegex = /(\\\[.*?\\\]|\\\(.*?\\\))/gs;
      let match;
      
      // Detect Chinese mathematical content
      const isChineseMath = /[\u4e00-\u9fa5]/.test(text) && 
                           (text.includes('\\[') || text.includes('\\('));
      
      // Process the text to separate LaTeX formulas from regular text
      while ((match = latexRegex.exec(text)) !== null) {
        // Add text before the formula
        if (match.index > currentIndex) {
          const textBefore = text.substring(currentIndex, match.index);
          const lines = textBefore.split('\n');
          
          lines.forEach(line => {
            if (line.trim()) {
              const isChineseHeading = isChineseMath && 
                                     (/^#+\s+/.test(line) || /^###/.test(line));
              const isChineseSubheading = isChineseMath && 
                                        (/^-\s+\*\*/.test(line) || /^\*\*步骤/.test(line));
              
              parts.push({
                text: line,
                isHeading: isChineseHeading || /^\d+\.\s+.+/.test(line) || /.*:$/.test(line),
                isSubheading: isChineseSubheading || /^[-•*]\s+.+/.test(line),
                hasMathExpression: false,
                isLatexFormula: false,
                isChineseMath: isChineseMath,
                isChineseHeading: isChineseHeading,
                isChineseSubheading: isChineseSubheading
              });
            }
          });
        }
        
        // Add the formula
        parts.push({
          text: match[0],
          isHeading: false,
          isSubheading: false,
          hasMathExpression: true,
          isLatexFormula: true,
          isChineseMath: isChineseMath
        });
        
        currentIndex = match.index + match[0].length;
      }
      
      // Add any remaining text
      if (currentIndex < text.length) {
        const textAfter = text.substring(currentIndex);
        const lines = textAfter.split('\n');
        
        lines.forEach(line => {
          if (line.trim()) {
            const isChineseHeading = isChineseMath && 
                                   (/^#+\s+/.test(line) || /^###/.test(line));
            const isChineseSubheading = isChineseMath && 
                                      (/^-\s+\*\*/.test(line) || /^\*\*步骤/.test(line));
            
            parts.push({
              text: line,
              isHeading: isChineseHeading || /^\d+\.\s+.+/.test(line) || /.*:$/.test(line),
              isSubheading: isChineseSubheading || /^[-•*]\s+.+/.test(line),
              hasMathExpression: isMathExpression(line),
              isLatexFormula: false,
              isChineseMath: isChineseMath,
              isChineseHeading: isChineseHeading,
              isChineseSubheading: isChineseSubheading
            });
          }
        });
      }
      
      return parts;
    };

    // Render LaTeX style formulas
    const renderLatexFormula = (formula, index) => {
      // Remove the LaTeX delimiters
      let cleanFormula = formula.replace(/\\\[|\\\]|\\\(|\\\)/g, '');
      
      // Handle subscripts like a_{n} before other replacements
      cleanFormula = cleanFormula.replace(/([a-zA-Z])_{([^}]+)}/g, '$1ₙ');
      cleanFormula = cleanFormula.replace(/([a-zA-Z])_(\d)/g, (match, p1, p2) => {
        const subscripts = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
          '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return p1 + subscripts[p2];
      });
      
      // Replace LaTeX-style commands with proper math notation
      cleanFormula = cleanFormula
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
        .replace(/\\int/g, '∫')
        .replace(/\\sum/g, '∑')
        .replace(/\\prod/g, '∏')
        .replace(/\\infty/g, '∞')
        .replace(/\\rightarrow/g, '→')
        .replace(/\\leftarrow/g, '←')
        .replace(/\\Rightarrow/g, '⇒')
        .replace(/\\Leftarrow/g, '⇐')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\delta/g, 'δ')
        .replace(/\\epsilon/g, 'ε')
        .replace(/\\zeta/g, 'ζ')
        .replace(/\\eta/g, 'η')
        .replace(/\\theta/g, 'θ')
        .replace(/\\iota/g, 'ι')
        .replace(/\\kappa/g, 'κ')
        .replace(/\\lambda/g, 'λ')
        .replace(/\\mu/g, 'μ')
        .replace(/\\nu/g, 'ν')
        .replace(/\\xi/g, 'ξ')
        .replace(/\\pi/g, 'π')
        .replace(/\\rho/g, 'ρ')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\tau/g, 'τ')
        .replace(/\\upsilon/g, 'υ')
        .replace(/\\phi/g, 'φ')
        .replace(/\\chi/g, 'χ')
        .replace(/\\psi/g, 'ψ')
        .replace(/\\omega/g, 'ω')
        .replace(/\\_\{([^}]+)\}/g, '_$1')
        .replace(/\\in/g, '∈')
        .replace(/\\subset/g, '⊂')
        .replace(/\\supset/g, '⊃')
        .replace(/\\cup/g, '∪')
        .replace(/\\cap/g, '∩')
        .replace(/\\cdot/g, '·')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\equiv/g, '≡')
        .replace(/\\approx/g, '≈')
        .replace(/\\neq/g, '≠')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\partial/g, '∂')
        .replace(/\\nabla/g, '∇')
        .replace(/\\forall/g, '∀')
        .replace(/\\exists/g, '∃');
      
      // Check if we need to handle fractions or square roots
      const hasFraction = /\d+\s*\/\s*\d+/.test(cleanFormula);
      const hasSquareRoot = /√\(([^)]+)\)/.test(cleanFormula) || /√\d+/.test(cleanFormula);
      
      if (hasFraction) {
        const fractionParts = parseFractionFormula(cleanFormula);
        return (
          <View key={`latex-formula-${index}`} style={styles.complexMathContainer}>
            {renderFractionFormula(fractionParts)}
          </View>
        );
      } else if (hasSquareRoot) {
      return (
          <View key={`latex-formula-${index}`} style={styles.complexMathContainer}>
            {renderSquareRoot(cleanFormula)}
          </View>
        );
      } else {
        return (
          <View key={`latex-formula-${index}`} style={styles.complexMathContainer}>
            <Text style={styles.complexMathText}>{cleanFormula}</Text>
          </View>
        );
      }
    };
  
    return (
      <Animatable.View
        animation="fadeInUp"
        duration={800}
        style={[
          styles.messageContainer,
          isBot ? styles.botMessageContainer : styles.userMessageContainer,
        ]}
      >
        {item.image ? ( // Check if the message has an image
          <Image
            source={{ uri: item.image }}
            style={{ width: 200, height: 200, borderRadius: 10 }} // Adjust size as needed
          />
        ) : (
          <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
            {formatMessageText(displayText).map((line, index) => {
              // Handle LaTeX formula
              if (line.isLatexFormula) {
                return renderLatexFormula(line.text, index);
              }
              
              // Handle Chinese mathematical headings and subheadings
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
                
                // Regular Chinese math text
                return (
                  <Text key={`chinese-math-text-${index}`} style={styles.chineseMathText}>
                    {line.text}
                  </Text>
                );
              }
              
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
                    elements.push(<Text key={`text-${index}-${i}`} style={isBot ? styles.botText : styles.userText}>{part}</Text>);
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
                return renderTextWithMath(line, index);
              }
              
              // Handle headings
              else if (line.isHeading) {
                return (
                  <View key={`line-${index}`} style={styles.headingContainer}>
                    <Text style={styles.headingPointer}>➤</Text>
                    <Text style={isBot ? styles.botText : styles.userText}>{line.text}</Text>
                  </View>
                );
              }
              
              // Handle subheadings
              else if (line.isSubheading) {
                return (
                  <View key={`line-${index}`} style={styles.subheadingContainer}>
                    <Text style={styles.subheadingPointer}>•</Text>
                    <Text style={isBot ? styles.botText : styles.userText}>{line.text}</Text>
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
                  <Text key={`line-${index}`} style={isBot ? styles.botText : styles.userText}>
                    {line.text}
                  </Text>
                );
              }
            })}
          </View>
        )}
        {shouldTruncate && (
          <TouchableOpacity
            style={styles.viewMoreButton}
            onPress={() => toggleMessageExpansion(item.id)}
          >
            <Text style={styles.viewMoreText}>
              {isExpanded ? 'View less' : 'View more'}
            </Text>
          </TouchableOpacity>
        )}
        {/* Add Tail */}
        <View style={isBot ? styles.botTail : styles.userTail} />
      </Animatable.View>
    );
  };

  useEffect(() => {
    // Fetch chat history when component mounts
    const fetchChatHistory = async () => {
      try {
        const response = await axios.post('https://matrix-server.vercel.app/getChat', { uid, chatid });
        const history = response.data.messages || []; // Default to an empty array if undefined
        
        // Process the history to handle image URLs
        const processedHistory = history.map(msg => {
          if (msg.text && msg.text.includes('ddtgdhehxhgarkonvpfq.supabase.co/storage/v1/')) {
            return {
              ...msg,
              image: msg.text, // Store the URL as image property
              text: '' // Clear the text since it's an image
            };
          }
          return msg;
        });

        setChats(prevChats => [
          ...prevChats,
          {
            id: Date.now().toString(),
            name: 'First Chat',
            description: 'Your initial chat with MatrixAI Bot.',
            role: '',
            messages: processedHistory,
          },
        ]);
        setCurrentChatId(Date.now().toString());
        setMessages(processedHistory); // Set processed messages from the server
        setDataLoaded(true); // Mark data as loaded
      } catch (error) {
        console.error('Error fetching chat history:', error);
        setDataLoaded(true); // Still mark as loaded even if error
      }
    };

    fetchChatHistory();
  }, []);

  const handleAttach = () => {
    setShowAdditionalButtons(prev => !prev); // Toggle additional buttons visibility
    // Change the icon from plus to cross
  };

  const handleCamera = (navigation) => {
    navigation.navigate('CameraScreen');
  };
  

  
  const selectChat = (chatId) => {
    setCurrentChatId(chatId);
    const selectedChat = chats.find(chat => chat.id === chatId);
    setMessages(selectedChat ? selectedChat.messages : []);
    setCurrentRole(selectedChat?.role || '');
    setIsSidebarOpen(false);
  };

  const startNewChat = () => {
    const newChatId = Date.now().toString();
    const newChat = {
      id: newChatId,
      name: 'New Chat',
      description: '',
      role: '',
      messages: [],
    };
    setChats(prevChats => [newChat, ...prevChats]);
    setCurrentChatId(newChatId);
    setIsLoading(false);
    setMessages([]);
    setCurrentRole('');
    setIsSidebarOpen(false);
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

  // Function to set the current role
  const handleRoleSelection = (role) => {
    let roleDescription = '';
    
    // Provide detailed context for specific roles
    if (role === '🩺 Doctor') {
      roleDescription = ` Licensed medical advisor providing health guidance, symptom analysis, and referrals within Hong Kong's healthcare system. Core responsibilities include assessing symptoms and suggesting possible conditions (e.g., seasonal flu, hypertension), explaining public health guidelines (e.g., DH vaccination schedules, COVID-19 protocols), advising on over-the-counter medications (e.g., Panadol, antihistamines) available in Hong Kong pharmacies, highlighting urgent care options (e.g., Accident & Emergency Departments at QMH or PWH), and promoting lifestyle adjustments for Hong Kong's urban environment (e.g., air pollution management). Key skills & knowledge include familiarity with HK's public/private healthcare systems, awareness of common local health issues (e.g., dengue fever, stress-related illnesses), and fluency in Cantonese medical terms (e.g., 骨痛熱症 for dengue). Common scenarios: "I have a fever after hiking in Lion Rock. Should I worry about dengue?" or "Where can I get a same-day flu vaccine in Kowloon?" Communication style is culturally sensitive, using terms like 睇醫生 (visit a doctor) and referencing local hospitals, while maintaining clear boundaries by emphasizing referrals to HA clinics or private practitioners. Limitations: Forbidden from prescribing antibiotics or diagnosing notifiable diseases (e.g., tuberculosis). Mandatory warning: For suspected COVID-19 symptoms, visit a DH testing centre immediately.`;
    } else if (role === '📚 Teacher') {
      roleDescription = `Educational guide specializing in Hong Kongs curriculum frameworks and exam systems, supporting students in academic achievement and holistic development. Core responsibilities include providing subject-specific tutoring (e.g., DSE Chinese, IGCSE Mathematics), advising on exam strategies for the Hong Kong Diploma of Secondary Education (DSE) or international qualifications (e.g., IB, A-Levels), guiding school selection (e.g., Direct Subsidy Scheme schools vs. international schools), addressing learning challenges in Hong Kong's high-pressure environment (e.g., stress management), and recommending local resources (e.g., HKEdCity platforms, public library programs). Key skills & knowledge include expertise in Hong Kong's curriculum (e.g., Liberal Studies reforms, STEM education initiatives), familiarity with school banding systems and admission criteria, and awareness of extracurricular trends (e.g., coding bootcamps, debate competitions). Common scenarios: "How to improve English writing for DSE Paper 2?" or "What are the best STEM programs for secondary students in Kowloon?" Communication style is encouraging yet pragmatic, using Cantonese terms like 補習 (tutoring) and referencing local exam stressors. Limitations: Forbidden from guaranteeing exam scores or criticizing specific schools. Mandatory reminder: For severe academic stress, consult school social workers or NGOs like the Hong Kong Federation of Youth Groups.`;
    } else if (role === '⚖️ Lawyer') {
      roleDescription = `Licensed legal advisor specializing in Hong Kongs common law system, providing guidance on civil disputes, contractual matters, and regulatory compliance. Core responsibilities include interpreting local ordinances (e.g., Landlord and Tenant Ordinance, Employment Ordinance), advising on dispute resolution pathways (e.g., Small Claims Tribunal, Labour Tribunal), reviewing contracts (e.g., tenancy agreements, employment contracts) for compliance with Hong Kong law, explaining legal procedures for family law cases (e.g., divorce, child custody under Matrimonial Proceedings Ordinance), and highlighting risks in property transactions (e.g., unauthorized structures, mortgage terms). Key skills & knowledge include expertise in Basic Law and Hong Kong's judicial framework, familiarity with the Personal Data (Privacy) Ordinance and Anti-Discrimination Ordinances, practical understanding of court procedures (e.g., filing writs at the District Court), and fluency in Cantonese legal terms (e.g., stamp duty, adverse possession). Common scenarios: "My landlord won't return the security deposit. Can I sue at the Small Claims Tribunal?" or "How to draft a prenuptial agreement valid in Hong Kong?" Communication style is legally precise, citing specific ordinances and case law while maintaining a culturally contextual approach, using terms like 搵律師 (hiring a lawyer) and referencing local practices. Limitations: Forbidden from drafting court pleadings or guaranteeing case outcomes. Mandatory warnings: Fraudulent acts like 假文書 (forged documents) may lead to 14 years' imprisonment under Crimes Ordinance. Always verify solicitor credentials via the Law Society of Hong Kong registry.`;
    } else if (role === '🌱 Psychologist') {
      roleDescription = `Mental health support specialist addressing Hong Kong's urban stressors, offering evidence-based coping strategies and emotional wellness guidance. Core responsibilities include assisting in managing anxiety, depression, and work-life imbalance common in Hong Kong's fast-paced environment, providing techniques for stress relief (e.g., mindfulness apps like Headspace adapted for Cantonese speakers), addressing family dynamics influenced by cross-generational living (e.g., conflicts with elderly parents), and guiding users through crises (e.g., protests-related trauma, pandemic fatigue) with local referral resources. Key skills & knowledge include expertise in Cognitive Behavioral Therapy (CBT) and cross-cultural mental health challenges, familiarity with Hong Kong's mental health infrastructure (e.g., Hospital Authority clinics, NGOs like Mind HK), and awareness of stigma around seeking therapy in Cantonese-speaking communities. Common scenarios: "I feel overwhelmed by my 70-hour workweek in Central. How to cope?" or "How to support a family member with PTSD after social unrest?" Communication style is empathetic and non-judgmental, using local language like 香港人壓力大係好常見，我哋一步步嚟 (Stress is common in Hong Kong; let's tackle it step by step), while being resource-focused by recommending local services (e.g., Suicide Prevention Services' 24-hour hotline: 2382 0000). Limitations: Forbidden from diagnosing psychiatric disorders (e.g., bipolar disorder) or advising on medication. Mandatory warnings: If suicidal thoughts arise, contact Samaritans Hong Kong (2896 0000) immediately.`;
    } else if (role === '🔧 Engineer') {
      roleDescription = `Technical problem-solver specializing in Hong Kong's urban infrastructure, construction challenges, and smart city initiatives, ensuring compliance with local regulations and safety standards. Core responsibilities include advising on building projects under Hong Kong's Buildings Ordinance (e.g., minor works approvals, structural inspections), troubleshooting MTR-aligned engineering issues (e.g., vibration control for buildings near rail lines), guiding retrofitting solutions for aging buildings (e.g., maintenance of unmanaged buildings, waterproofing for rainy seasons), and recommending smart technologies (e.g., IoT for energy efficiency in high-rises, HVAC optimization). Key skills & knowledge include expertise in Hong Kong Construction Standards (e.g., Code of Practice for Structural Use of Concrete), familiarity with BEAM Plus certification for sustainable buildings, and knowledge of unauthorized structures regulations. Common scenarios: "How to fix water leakage in a 40-year-old apartment in Sham Shui Po?" or "What permits are needed to install solar panels on a village house in the New Territories?" Communication style is technically precise with local context, referencing iconic projects like ICC or Tseung Kwan O Cross Bay Link, and maintaining a safety-first tone. Limitations: Forbidden from approving structural designs without a Registered Structural Engineer (RSE) or advising on illegal modifications (e.g., removing load-bearing walls). Mandatory warnings: For slope safety concerns, contact the Geotechnical Engineering Office (GEO) immediately.`;
    } else if (role === '📐 Surveyor') {
      roleDescription = `Licensed professional specializing in Hong Kong's land, construction, and property sectors, ensuring compliance with local ordinances and optimizing value across development projects. General Practice Surveyor (產業測量師): Conducts property valuations, advises on land development under Hong Kong's planning framework, negotiates tenancy terms, and analyzes stamp duty implications. Quantity Surveyor (工料測量師): Prepares Bills of Quantities (BQ), manages cost overruns, resolves claims under Hong Kong Standard Form of Building Contract, and advises on demolition order cost assessments. Building Surveyor (建築測量師): Inspects unmanaged buildings for Mandatory Building Inspection Scheme (MBIS) compliance, assesses unauthorized structures risks, supervises urgent repair orders, and advises on heritage revitalization projects. Key skills & knowledge include expertise in the Rating and Valuation Department (RVD) guidelines, knowledge of first-time buyer incentives, and familiarity with Mandatory Window Inspection Scheme. Common scenarios: "How is the value of a village house in Yuen Long affected by small house policy?" or "How to legalize an unauthorized rooftop structure in Tsuen Wan?" Communication style is data-driven and legally cautious, referencing transaction data from real estate firms and government regulations. Limitations: Forbidden from certifying Occupation Permits without site inspection. Mandatory warnings: Unauthorized alterations may lead to demolition orders under Buildings Ordinance.`;
    } else if (role === '🏤 Architect') {
      roleDescription = `Licensed building design expert specializing in Hong Kong's high-density urban environment, balancing aesthetics, functionality, and compliance with stringent local regulations. Core responsibilities include designing residential and commercial spaces under Buildings Ordinance constraints (e.g., plot ratios, setback requirements), guiding heritage revitalization projects (e.g., converting pre-war shophouses into boutique hotels), optimizing micro-unit layouts for livability, integrating BEAM Plus standards for energy efficiency, and addressing typhoon resilience. Key skills & knowledge include mastery of submitting building plans workflows to the Buildings Department, expertise in subdivided unit legality and fire safety compliance, and fluency in local architectural terminology. Common scenarios: "How to maximize natural light in a 300 sq. ft flat in Causeway Bay?" or "What are the approval steps for converting industrial space into co-living units?" Communication style is practical and creative, citing regulatory standards while referencing iconic designs like PMQ or Tai Kwun. Limitations: Forbidden from approving structural modifications without a Registered Structural Engineer (RSE). Mandatory warnings: Unauthorized alterations may lead to demolition orders under Cap. 123.`;
    } else if (role === '📈 Financial Advisor') {
      roleDescription = `Licensed wealth management expert navigating Hong Kong's dynamic financial landscape, focusing on tax efficiency, retirement planning, and cross-border asset strategies. Core responsibilities include optimizing Mandatory Provident Fund (MPF) portfolios, advising on first-time buyer mortgage strategies, planning for emigration tax implications, mitigating risks in high-yield products (e.g., ELNs or crypto ETFs), and explaining Wealth Management Connect opportunities. Key skills & knowledge include expertise in Hong Kong's tax regime, knowledge of family trusts and offshore setups for asset protection, and familiarity with regulatory product risks. Common scenarios: "Should I invest in HKEX-listed tech stocks or US ETFs?" or "How to reduce tax on rental income from a Kowloon flat?" Communication style is risk-transparent, using localized analogies like comparing investments to property rentals, while ensuring compliance with SFC regulations. Limitations: Forbidden from recommending unregulated shadow banking products or guaranteeing risk-free returns. Mandatory warnings: Virtual asset platforms may lack proper licensing—verify with SFC.`;
    } 
    else {
      roleDescription = `I'll now respond as a ${role}. How can I help you?`;
    }
    
    // Set current role and store the roleDescription internally for use in API calls
    setCurrentRole(role);
    
    // Update the current chat with the selected role
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId ? { ...chat, role, roleDescription } : chat
    ));
    
    // Add a simple message to the user indicating the role has been set
    const userVisibleMessage = `I'll now respond as a ${role}. How can I help you?`;
    const newMessage = {
      id: Date.now().toString(),
      text: userVisibleMessage,
      sender: 'bot',
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Save only the user-visible message to chat history
    saveChatHistory(userVisibleMessage, 'bot');
  };

  // Function to render a single line of text with math expressions highlighted
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity 
        style={[styles.backButton, { marginLeft: isSidebarOpen ? 300 : 0 }]}
        onPress={() => {
          if (isSidebarOpen) {
            setIsSidebarOpen(false);
          } else {
            setIsSidebarOpen(true);
          }
        }}
      >
        {isSidebarOpen ? (
          <MaterialIcons name="arrow-back-ios" size={24} color="#000" style={styles.headerIcon2} />
        ) : (
          <MaterialIcons name="arrow-forward-ios" size={24} color="#000" style={styles.headerIcon} />
        )}
      </TouchableOpacity>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back-ios" size={24} color="#000" style={styles.headerIcon} />
        </TouchableOpacity>
        <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
        <View style={styles.headerTextContainer}>
        
          {currentRole && <Text style={styles.botRole}>{currentRole}</Text>|| <Text style={styles.botRole}>MatrixAI Bot</Text>}
        
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('CallScreen')}>
          <MaterialIcons name="call" size={24} color="#4C8EF7" marginHorizontal={1} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('CameraScreen')}>
          <MaterialCommunityIcons name="video-outline" size={28} color="#4C8EF7" marginHorizontal={10} />
        </TouchableOpacity>
        <TouchableOpacity onPress={startNewChat}>
          <MaterialCommunityIcons name="chat-plus-outline" size={24} color="#4C8EF7" />
        </TouchableOpacity>
     
       
      </View>

      {/* Chat List */}
      <Animatable.View animation="fadeIn" duration={1000} style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chat}
          onContentSizeChange={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          style={{ marginBottom: showAdditionalButtons ? (selectedImage ? 155 : 125) : (selectedImage ? 95 : 70) }}
        />

        {/* Placeholder for New Chat */}
        {messages.length === 0 && dataLoaded && (
          <View style={styles.placeholderContainer}>
            <Image source={require('../assets/matrix.png')} style={styles.placeholderImage} />
            <Text style={styles.placeholderText}>Hi, I'm MatrixAI Bot.</Text>
            <Text style={styles.placeholderText2}>How can I help you today?</Text>
            
            {/* New role selection UI */}
            <Text style={styles.placeholderText3}>You can ask me any question or you</Text>
            <Text style={styles.placeholderText4}>can select the below role:</Text>
            <View style={styles.roleButtonsContainer}>
              <View style={styles.roleButtonRow}>
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('🩺 Doctor')}
                >
                   <Text style={styles.roleButtonText}>🩺</Text>
                  <Text style={styles.roleButtonText}>Doctor</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('📚 Teacher')}
                >
                    <Text style={styles.roleButtonText}>📚</Text>
                  <Text style={styles.roleButtonText}>Teacher</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.roleButtonRow}>
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('⚖️ Lawyer')}
                >
                    <Text style={styles.roleButtonText}>⚖️</Text>
                  <Text style={styles.roleButtonText}>Lawyer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('🌱 Psychologist')}
                >
                    <Text style={styles.roleButtonText}>🌱</Text>
                  <Text style={styles.roleButtonText}>Psychologist</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.roleButtonRow}>
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('🔧 Engineer')}
                >
                    <Text style={styles.roleButtonText}>🔧</Text>
                  <Text style={styles.roleButtonText}>Engineer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('📐 Surveyor')}
                >
                    <Text style={styles.roleButtonText}>📐</Text>
                  <Text style={styles.roleButtonText}>Surveyor</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.roleButtonRow}>
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('🏤 Architect')}
                >
                    <Text style={styles.roleButtonText}>🏤</Text>
                  <Text style={styles.roleButtonText}>Architect</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.roleButton} 
                  onPress={() => handleRoleSelection('📈 Financial Advisor')}
                >
                    <Text style={styles.roleButtonText}>📈</Text>
                  <Text style={styles.roleButtonText}>Financial Advisor</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Animatable.View>
      {/* Loading animation */}
      {isLoading && (
        <View style={[styles.loadingContainer, { 
          bottom: showAdditionalButtons && selectedImage ? 50 : 
                 showAdditionalButtons ? -10 : 
                 selectedImage ? -10 : 
                 -70 
        }]}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
        </View>
      )}
      
      {/* Image Preview (WhatsApp Style) */}
      {selectedImage && (
        <View style={[styles.imagePreviewContainer, { bottom: showAdditionalButtons ? 128 : 68 }]}>
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
      
       <View style={[styles.chatBoxContainer, { bottom: showAdditionalButtons ? 80 : 20}]}>
          <TextInput
            style={[styles.textInput, { textAlignVertical: 'center' }]}
            placeholder={selectedImage ? "Add a caption..." : "Send a message..."}
            placeholderTextColor="#ccc"
            value={inputText}
            onChangeText={handleInputChange}
            onSubmitEditing={handleSendMessage}
            multiline
            numberOfLines={3}
            maxLength={250}
          />
            <TouchableOpacity onPress={handleAttach} style={styles.sendButton}>
                  {showAdditionalButtons ? (
                    <Ionicons name="close" size={24} color="#4C8EF7" />
                  ) : (
                    <MaterialCommunityIcons name="plus" size={24} color="#4C8EF7" />
                  )}
                </TouchableOpacity>
               
                <TouchableOpacity onPress={handleSendMessage} style={styles.sendButton}>
                  <Ionicons name="send" size={24} color="#4C8EF7" />
                </TouchableOpacity>
        </View>

        {showAdditionalButtons && (
             <View style={styles.additionalButtonsContainer}>
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('camera')}>
                        <View style={styles.additionalButton}>
                            <Ionicons name="camera" size={24} color="#4C8EF7" />
                        </View>
                        <Text>Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('gallery')}>
                        <View style={styles.additionalButton}>
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
            </View>
        )}
  

     

      {isSidebarOpen && (
        <TouchableWithoutFeedback onPress={() => setIsSidebarOpen(false)}>
          <LeftNavbarBot
            chats={chats}
            onSelectChat={selectChat}
            onNewChat={startNewChat}
            onClose={() => setIsSidebarOpen(false)}
            onDeleteChat={onDeleteChat}
          />
        </TouchableWithoutFeedback>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    left: 0,
    top: '50%',
    zIndex: 1,
    width:20,
    height:70,
    backgroundColor:'#EDEDEDC8',
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#000',
  },
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
  headerIcon: {
    width: 30,
    height: 30,
    marginHorizontal: 5,
  },
  headerIcon2: {
    marginHorizontal: 5,
  },
  botIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sendButton: {
   padding: 10,
  },
  
  // WhatsApp style image preview container
  imagePreviewContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    width: '70%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#4C8EF7',
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
  headerTextContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  botName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  botRole: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4C8EF7',
    marginTop: 2,
  },
  botDescription: {
    fontSize: 12,
    color: '#666',
  },
  chat: {
    paddingVertical: 10,
  },
 

  messageContainer: {
    maxWidth: '85%',
    marginVertical: 4,
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'column',
    flexShrink: 1,
    overflow: 'hidden',
  },
  botMessageContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#E0E0E0',
    marginLeft: 15,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#4C8EF7',
    marginRight: 15,
  },
  botTail: {
    position: 'absolute',
    left: -10,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E0E0E0',
  },
  userTail: {
    position: 'absolute',
    right: -10,
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#4C8EF7',
  },


  loadingContainer: {
    position: 'absolute',
  
    left: -70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 300,
    height: 300,
  },
  botText: {
    color: '#333',
    fontSize: 16,
  },
  userText: {
    color: '#FFF',
    fontSize: 16,
  },
  textInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    marginHorizontal: 10,
    justifyContent:'center',
    alignSelf:'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  icon: {
    marginHorizontal: 10,
  },
  loading: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginTop: 10,
  },
  viewMoreButton: {
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  viewMoreText: {
    color: '#4C8EF7',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  placeholderContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
    alignItems: 'center',

  },
  placeholderImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  placeholderText2: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  placeholderText3: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  
  },
  placeholderText4: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
   
    marginBottom: 10,
  },
  roleButtonsContainer: {
    marginTop: 10,
    width: '90%',
    alignItems: 'center',
  },
  roleButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  roleButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,

  
    backgroundColor:'#F0F8FF',
    minWidth: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  roleButtonText: {
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
  additionalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: 15, // Adjust based on your layout
    width: '100%',
    paddingHorizontal: 20, // Add padding for spacing
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
  additionalButton: {
    alignItems: 'center',
    backgroundColor:'#D1D1D151',
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
  chatImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 5,
  },
});

export default BotScreen;
