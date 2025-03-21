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
  
  // New state variables for image preview modal
  const [imagePreviewModalVisible, setImagePreviewModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageQuestion, setImageQuestion] = useState('What do you see in the image?');
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
      if (currentRole) {
        systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. Please provide responses with the expertise and perspective of a ${currentRole} while being helpful and informative.`;
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
    if (inputText.trim()) {
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
                return (
                  <View key={`line-${index}`} style={styles.mathContainer}>
                    <Text style={isBot ? styles.botText : styles.userText}>{line.text}</Text>
                  </View>
                );
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
        setChats(prevChats => [
          ...prevChats,
          {
            id: Date.now().toString(),
            name: 'First Chat',
            description: 'Your initial chat with MatrixAI Bot.',
            role: '',
            messages: history,
          },
        ]);
        setCurrentChatId(Date.now().toString());
        setMessages(history); // Set messages from the server
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
    setMessages([]);
    setCurrentRole('');
    setIsSidebarOpen(false);
  };

  // Image Preview Modal Component
  const ImagePreviewModal = () => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const imageWidth = screenWidth * 0.7;
    const imageHeight = screenHeight * 0.3;
    
    const handleQuickQuestion = (question) => {
      setImageQuestion(question);
    };
    
    const handleConfirm = async () => {
      // Ensure we have a question
     
      
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
        
        // Save the chat history for the image
        await saveChatHistory(publicUrl, 'user');
        
        // Use a fixed question to Volces API regardless of what the user typed
        const fixedImageQuestion = "What do you see in the image define in brief";
        
        // Send the image to Volces API
        const VOLCES_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
        const VOLCES_API_KEY = '95fad12c-0768-4de2-a4c2-83247337ea89';
        
        // Create system message with role information if available
        let systemContent = 'You are MatrixAI Bot, a helpful AI assistant.';
        if (currentRole) {
          systemContent = `You are MatrixAI Bot, acting as a ${currentRole}. Please provide responses with the expertise and perspective of a ${currentRole} while being helpful and informative.`;
        }
        
        const volcesResponse = await axios.post(
          VOLCES_API_URL,
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
                    text: fixedImageQuestion
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
        const volcesImageDescription = volcesResponse.data.choices[0].message.content.trim();
        
        // Now send the volcesImageDescription along with the user's question to DeepSeek
        // Only if the user has entered a custom question
        if (imageQuestion && imageQuestion !== 'What do you see in the image?') {
          // Create a message combining the image description and user question
          const combinedPrompt = `[Image Description]: ${volcesImageDescription}\n\n[User Question]: ${imageQuestion}`;
          
          // Send to DeepSeek
          const deepseekResponse = await axios.post(
            'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            {
              model: 'deepseek-r1-250120',
              messages: [
                { role: 'system', content: systemContent },
                ...messages.map(msg => ({
                  role: msg.sender === 'bot' ? 'assistant' : 'user',
                  content: msg.text || '' // Handle image messages which don't have text
                })),
                { role: 'user', content: combinedPrompt },
              ]
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer 95fad12c-0768-4de2-a4c2-83247337ea89`
              }
            }
          );
          
          // Use the DeepSeek response as the bot message
          const botMessage = deepseekResponse.data.choices[0].message.content.trim();
          
          // Add the bot's response to messages
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), text: botMessage, sender: 'bot' },
          ]);
          
          // Save the chat history for the bot response
          await saveChatHistory(botMessage, 'bot');
        } else {
          // If no custom question, just use the Volces response
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), text: volcesImageDescription, sender: 'bot' },
          ]);
          
          // Save the chat history for the bot response
          await saveChatHistory(volcesImageDescription, 'bot');
        }
        
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
        setImageQuestion('What do you see in the image?');
      }
    };
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={imagePreviewModalVisible}
        onRequestClose={() => setImagePreviewModalVisible(false)}
      >
        <TouchableWithoutFeedback>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setImagePreviewModalVisible(false)}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#000" />
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
  style={styles.textInput}
  placeholder="Ask a question about the image..."
  value={imageQuestion}
  onChangeText={(text) => setImageQuestion(text)} // Only update text
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
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Ionicons name="check" size={24} color="#FFF" />
                  <Text style={styles.confirmButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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

  // Function to set the current role
  const handleRoleSelection = (role) => {
    setCurrentRole(role);
    
    // Update the current chat with the selected role
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId ? { ...chat, role } : chat
    ));
    
    // Add a message indicating the role has been set
    const newMessage = {
      id: Date.now().toString(),
      text: `I'll now respond as a ${role}. How can I help you?`,
      sender: 'bot',
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Save this message to chat history
    saveChatHistory(`I'll now respond as a ${role}. How can I help you?`, 'bot');
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
        
          style={{ marginBottom: showAdditionalButtons ? 125 : 70 }}
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
      {isLoading && (
        <View style={[styles.loadingContainer, { bottom: showAdditionalButtons ? -10 : -70 }]}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
        </View>
      )}
      
       <View style={[styles.chatBoxContainer, { bottom: showAdditionalButtons ? 80 : 20}]}>
          <TextInput
            style={[styles.textInput, { textAlignVertical: 'center' }]}
            placeholder="Send a message..."
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

      <ImagePreviewModal />
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
    maxWidth: '80%',
    padding: 10,
    borderRadius: 10,
    marginVertical: 5,
    position: 'relative', // Required for positioning the tail
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
    fontSize: 18,
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
    fontWeight: 'bold',
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

export default BotScreen;
