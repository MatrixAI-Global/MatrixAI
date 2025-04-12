import React, { useEffect, useState, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  BackHandler,
  Linking,
  Share,
  ScrollView,
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
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import LeftNavbarBot from '../components/LeftNavbarBot';
import Clipboard from '@react-native-clipboard/clipboard';

// Function to decode base64 to ArrayBuffer
const decode = (base64) => {
  const bytes = Buffer.from(base64, 'base64');
  return bytes;
};

  const BotScreen = ({ navigation, route }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  // Default fallback values for route params
  const { chatName, chatDescription, chatImage, chatid = Date.now().toString() } = route?.params || {};
  
  // Use ref to track if we've already processed the initial chatid
  const initialChatIdProcessed = useRef(false);
  
  console.log('BotScreen initialized with chatid:', chatid);
  
  const flatListRef = React.useRef(null);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentChat = chats.find(chat => chat.id === currentChatId) || { messages: [] };
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showInput, setShowInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);  // Track if user is typing
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data is loaded
  const [expandedMessages, setExpandedMessages] = useState({}); // Track expanded messages
  const [showAdditionalButtons, setShowAdditionalButtons] = useState(false); 
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentRole, setCurrentRole] = useState('');
  
  // Modified image handling
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageType, setImageType] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Add keyboard state tracking
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Set initial chat ID from route params if available - prevent infinite updates
  useEffect(() => {
    if (!initialChatIdProcessed.current && chatid && chatid !== 'undefined' && chatid !== 'null') {
      console.log('Setting initial chatid from route params:', chatid);
      setCurrentChatId(chatid);
      initialChatIdProcessed.current = true;
    }
  }, [chatid]);

  // Add keyboard event listeners
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

    // Handle back button press for dismissing keyboard
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (keyboardVisible) {
          Keyboard.dismiss();
          return true;
        }
        return false;
      }
    );

    // Cleanup event listeners
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      backHandler.remove();
    };
  }, [keyboardVisible]);

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
      
      // Delete chat from Supabase
      const { error: deleteError } = await supabase
        .from('user_chats')
        .delete()
        .eq('chat_id', chatId);
      
      if (deleteError) {
        console.error('Error deleting chat from Supabase:', deleteError);
        // Continue with local deletion even if server deletion fails
      } else {
        console.log('Chat deleted from Supabase');
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
      let systemContent = 'You are a helpful AI assistant called Matrix AI. Do not reveal any information about the specific AI models you were built with or any personal information. Keep your responses focused only on answering the user query with accurate information. If you are asked to format data in a table, make sure to use proper markdown table format.';
      
      // Find the current chat to get the detailed roleDescription
      const currentChatObj = chats.find(chat => chat.id === currentChatId);
      
      if (currentRole) {
        if (currentChatObj && currentChatObj.roleDescription) {
          // Use the detailed roleDescription for the system content
          systemContent = `You are Matrix AI, acting as a ${currentRole}. ${currentChatObj.roleDescription} Do not reveal any information about the specific AI models you were built with or any personal information. If you are asked to format data in a table, make sure to use proper markdown table format.`;
        } else {
          // Fallback to simpler system content if roleDescription isn't available
          systemContent = `You are Matrix AI, acting as a ${currentRole}. Please provide responses with the expertise and perspective of a ${currentRole} while being helpful and informative. Do not reveal any information about the specific AI models you were built with or any personal information. If you are asked to format data in a table, make sure to use proper markdown table format.`;
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
      try {
        // Get current user session first to ensure we have authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id || 'anonymous';
        
        setIsTyping(true);
        
        // Dismiss keyboard after sending message
        Keyboard.dismiss();
        
        // If there's no current chat ID, create a new chat
        if (!currentChatId) {
          const newChatId = Date.now().toString();
          console.log('Creating new chat before sending message:', newChatId);
          setCurrentChatId(newChatId);
          await startNewChat(newChatId);
          // Wait briefly to ensure the chat is created
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
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
              const filePath = `users/${userId}/Image/${imageID}.${fileExtension}`;
            
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
            
              // Add the image to messages first in the local state
            const newMessage = {
              id: Date.now().toString(),
              image: publicUrl,
              text: inputText.trim() ? inputText : "",
                sender: 'user',
                timestamp: new Date().toISOString()
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
          // Regular text message handling
          try {
            setIsLoading(true);
            
            // Create message object with timestamp
        const newMessage = {
          id: Date.now().toString(),
          text: inputText,
          sender: 'user',
              timestamp: new Date().toISOString()
        };
            
            // Update local state first
        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);
            
            // Update the current chat's messages in local state
        setChats(prevChats => prevChats.map(chat => 
          chat.id === currentChatId ? { ...chat, messages: updatedMessages } : chat
        ));

            // Clear input
            setInputText('');
            setIsTyping(false);

            // Save the user's message to Supabase
        await saveChatHistory(inputText, 'user');
        
            // Fetch response from DeepSeek
            await fetchDeepSeekResponse(inputText);
          } catch (error) {
            console.error('Error handling text message:', error);
            Alert.alert('Error', 'Failed to process message');
            
            // Add error message to the chat
            setMessages(prev => [
              ...prev,
              { 
                id: Date.now().toString(), 
                text: 'Error processing message. Please try again.', 
                sender: 'bot',
                timestamp: new Date().toISOString()
              },
            ]);
          } finally {
            setIsLoading(false);
          }
      }
      setIsTyping(false);
      } catch (error) {
        console.error('Error handling message:', error);
        Alert.alert('Error', 'Failed to send message');
      setIsTyping(false);
      }
    }
  };

  const saveChatHistory = async (messageText, sender) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.error('No authenticated user found');
        return;
      }
      
      const userId = session.user.id;
      
      // Make sure we have a valid chat id
      if (!currentChatId) {
        console.log('No current chat ID, creating a new chat');
        const newChatId = Date.now().toString();
        setCurrentChatId(newChatId);
        
        // Create a new empty chat first
        const timestamp = new Date().toISOString();
        const newChat = {
          chat_id: newChatId,
          user_id: userId,
          name: 'New Chat',
          description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
          role: currentRole || '',
          role_description: '',
          messages: [],
          created_at: timestamp,
          updated_at: timestamp
        };
        
        // Insert the chat before adding the message
        const { error: insertError } = await supabase
          .from('user_chats')
          .insert(newChat);
        
        if (insertError) {
          console.error('Error creating new chat:', insertError);
          return;
        }
        
        // Update local state
        setChats(prevChats => [
          {
            id: newChatId,
            name: 'New Chat',
            description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
            role: currentRole || '',
            roleDescription: '',
            messages: [],
          },
          ...prevChats
        ]);
      }
      
      // Now we proceed with adding the message, using the currentChatId which is now guaranteed to exist
      const chatIdToUse = currentChatId;
      
      // Check if chat exists in the database
      const { data: existingChat, error: chatError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', chatIdToUse)
        .single();
      
      if (chatError && chatError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking chat existence:', chatError);
        return;
      }
      
      const timestamp = new Date().toISOString();
      const newMessage = {
        id: Date.now().toString(),
        text: messageText,
        sender: sender,
        timestamp: timestamp
      };
      
      // Check if we need to update the chat name from 'New Chat' to 'MatrixAI Bot'
      let chatName = existingChat?.name || '';
      const shouldUpdateName = chatName === 'New Chat' && sender === 'user';
      if (shouldUpdateName) {
        chatName = 'MatrixAI Bot';
      }
      
      if (existingChat) {
        // Chat exists, update messages array
        // Limit the number of messages to prevent database size issues
        // Keep only the last 50 messages
        const updatedMessages = [...(existingChat.messages || []), newMessage].slice(-50);
        
        const { error: updateError } = await supabase
          .from('user_chats')
          .update({
            messages: updatedMessages,
            updated_at: timestamp,
            // Update name from 'New Chat' to 'MatrixAI Bot' if this is first user message
            name: shouldUpdateName ? chatName : existingChat.name,
            // Also update description to the latest message for preview
            description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '')
          })
          .eq('chat_id', chatIdToUse);
        
        if (updateError) {
          console.error('Error updating chat:', updateError);
          
          // If error is related to size, try with fewer messages
          if (updateError.message && updateError.message.includes('size')) {
            console.log('Trying with fewer messages due to size constraint');
            
            // Try again with only 10 most recent messages
            const reducedMessages = [...(existingChat.messages || []), newMessage].slice(-10);
            
            const { error: retryError } = await supabase
              .from('user_chats')
              .update({
                messages: reducedMessages,
                updated_at: timestamp,
                name: shouldUpdateName ? chatName : existingChat.name,
                description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '')
              })
              .eq('chat_id', chatIdToUse);
              
            if (retryError) {
              console.error('Error on retry with reduced messages:', retryError);
              return;
            }
          } else {
            return;
          }
        }
        
        console.log('Chat history updated in Supabase');
      } else {
        // This is just a fallback - we should never get here as we create the chat first if it doesn't exist
        console.log('Chat not found, creating a new one with the message');
        
        // Create new chat with only this message to ensure size limits
        const newChat = {
          chat_id: chatIdToUse,
          user_id: userId,
          name: 'MatrixAI Bot', // Always use 'MatrixAI Bot' for new chats with messages
          description: messageText.substring(0, 30) + (messageText.length > 30 ? '...' : ''),
          role: currentRole || '',
          role_description: '',
          messages: [newMessage],
          created_at: timestamp,
          updated_at: timestamp
        };
        
        const { error: insertError } = await supabase
          .from('user_chats')
          .insert(newChat);
        
        if (insertError) {
          console.error('Error creating new chat:', insertError);
          return;
        }
        
        console.log('New chat created in Supabase');
      }
    
      
      // Update the chat in the local state
      setChats(prevChats => prevChats.map(chat => 
        chat.id === chatIdToUse 
          ? { 
              ...chat, 
              messages: [...(chat.messages || []), newMessage],
              name: shouldUpdateName ? chatName : chat.name,
              description: chat.description || messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '')
            } 
          : chat
      ));
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

  // Memoize the message rendering to prevent excessive renders
  const renderMessage = React.useCallback(({ item }) => {
    // Ensure messages is an array and data is loaded
    if (!dataLoaded || !Array.isArray(messages) || messages.length === 0) return null; 
  
    const isBot = item.sender === 'bot';
    const isExpanded = expandedMessages[item.id];
    const shouldTruncate = item.text && item.text.length > 100; // Check if text exists
    const displayText = shouldTruncate && !isExpanded 
      ? `${item.text.substring(0, 100)}...`
      : item.text;

    // Handle copy text function
    const handleCopyText = () => {
      if (item.text) {
        Clipboard.setString(item.text);
        Toast.show({
          type: 'success',
          text1: 'Text copied to clipboard',
          position: 'bottom',
          visibilityTime: 2000,
        });
      }
    };

    // Handle share function
    const handleShareMessage = async () => {
      try {
        await Share.share({
          message: item.text || '',
        });
      } catch (error) {
        console.error('Error sharing:', error);
        Alert.alert('Error', 'Failed to share message');
      }
    };

    // Check if the message has an image
    if (item.image) {
      return (
        <View style={[styles.messageWrapperOuter, isBot ? {alignSelf: 'flex-start'} : {alignSelf: 'flex-end'}]}>
          <Animatable.View
            animation="fadeInUp"
            duration={800}
            style={[
              styles.messageContainer,
              isBot ? styles.botMessageContainer : styles.userMessageContainer,
            ]}
          >
            <TouchableOpacity onPress={() => handleImageTap(item.image)}>
              <Image
                source={{ uri: item.image }}
                style={styles.chatImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            {item.text && (
              <Text style={isBot ? styles.botText : styles.userText}>
                {item.text}
              </Text>
            )}
            <View style={isBot ? styles.botTail : styles.userTail} />
          </Animatable.View>
          
          {/* Message action buttons - outside the bubble */}
          <View style={[
            styles.messageActionButtons,
            isBot ? styles.botMessageActions : styles.userMessageActions
          ]}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleCopyText}
            >
              <Ionicons 
                name="copy-outline" 
                size={18} 
                color="#666" 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleShareMessage}
            >
              <Ionicons 
                name="share-social-outline" 
                size={18} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
        </View>
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
      
      // Detect markdown tables by looking for patterns
      // Tables typically have lines with | characters and separator rows with dashes
      let isInTable = false;
      let currentTable = [];
      let tableHeaders = [];
      let tableData = [];
      let separatorRowFound = false;
      const result = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this line is part of a table (has | characters)
        const isTableRow = line.includes('|');
        const isTableSeparator = isTableRow && line.replace(/\|/g, '').trim().replace(/[^-:]/g, '') !== '';
        
        if (isTableRow) {
          if (!isInTable) {
            isInTable = true;
            tableHeaders = [];
            tableData = [];
            currentTable = [];
            separatorRowFound = false;
          }
          
          currentTable.push(line);
          
          if (isTableSeparator) {
            separatorRowFound = true;
          } else {
            // Parse row data - properly split by | and clean the cells
            const cells = line
              .split('|')
              .map(cell => cell.trim())
              .filter((cell, index, array) => {
                // Keep all cells except potentially empty first and last ones
                if (index === 0 && cell === '' && line.startsWith('|')) return false;
                if (index === array.length - 1 && cell === '' && line.endsWith('|')) return false;
                return true;
              });
            
            if (tableHeaders.length === 0 && !separatorRowFound) {
              // This is the header row
              tableHeaders = cells;
            } else if (separatorRowFound) {
              // This is a data row
              tableData.push(cells);
            }
          }
        } else {
          // End of table
          if (isInTable) {
            if (tableHeaders.length > 0 && tableData.length > 0) {
              result.push({
                isTable: true,
                tableHeaders,
                tableData,
                tableLines: currentTable,
              });
            }
            isInTable = false;
            currentTable = [];
            separatorRowFound = false;
          }
          
          // Process regular text
          const isHeading = /^\d+\.\s+.+/.test(line) || /.*:$/.test(line);
          const isSubheading = /^[-•*]\s+.+/.test(line);
          const hasMathExpression = isMathExpression(line);
          
          if (line.trim() !== '') {
            result.push({
              text: line,
              isHeading,
              isSubheading,
              hasMathExpression,
              isTable: false
            });
          }
        }
      }
      
      // Handle case where the message ends with a table
      if (isInTable && tableHeaders.length > 0 && tableData.length > 0) {
        result.push({
          isTable: true,
          tableHeaders,
          tableData,
          tableLines: currentTable,
        });
      }
      
      return result;
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
      <View style={[styles.messageWrapperOuter, isBot ? {alignSelf: 'flex-start'} : {alignSelf: 'flex-end'}]}>
        <Animatable.View
          animation="fadeInUp"
          duration={800}
          style={[
            styles.messageContainer,
            isBot ? styles.botMessageContainer : styles.userMessageContainer,
          ]}
        >
          <View style={isBot ? styles.botTextContainer : styles.userTextContainer}>
            {formatMessageText(displayText).map((line, index) => {
              // Handle table rendering
              if (line.isTable) {
                return renderTable(line, index);
              }
              
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
          <View style={isBot ? styles.botTail : styles.userTail} />
        </Animatable.View>
        
        {/* Message action buttons - outside the bubble */}
        <View style={[
          styles.messageActionButtons,
          isBot ? styles.botMessageActions : styles.userMessageActions
        ]}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleCopyText}
          >
            <Ionicons 
              name="copy-outline" 
              size={18} 
              color="#666" 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleShareMessage}
          >
            <Ionicons 
              name="share-social-outline" 
              size={18} 
              color="#666" 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [dataLoaded, messages, expandedMessages]);

  // Also memoize the FlatList to prevent unnecessary re-renders
  const memoizedFlatList = React.useMemo(() => (
    <View style={{ flex: 1, position: 'relative' }}>
    <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chat}
          onContentSizeChange={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          ref={flatListRef}
          style={{ marginBottom: showAdditionalButtons ? 135 : 30 }}
        />
    </View>
  ), [messages, renderMessage, showAdditionalButtons]);

  useEffect(() => {
    let chatSubscription;
    
    // Function to fetch all user chats
    const fetchUserChats = async () => {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user?.id) {
          console.error('No authenticated user found');
          
          // For anonymous users, create a local chat and stop trying to fetch from Supabase
          const newChatId = chatid && chatid !== 'undefined' && chatid !== 'null' 
            ? chatid 
            : Date.now().toString();
          
          const localChatObj = {
            id: newChatId,
            name: 'New Chat',
            description: '',
            role: '',
            roleDescription: '',
            messages: [],
          };
          
          setChats([localChatObj]);
          setCurrentChatId(newChatId);
          setMessages([]);
          setDataLoaded(true);
          return; // Exit early for anonymous users
        }
        
        // Rest of the original function continues for authenticated users
        const userId = session.user.id;
        
        // Query all chats for this user
        const { data: userChats, error: chatsError } = await supabase
          .from('user_chats')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        
        if (chatsError) {
          console.error('Error fetching user chats:', chatsError);
          setDataLoaded(true);
          return;
        }
        
        if (userChats && userChats.length > 0) {
          // Process each chat to handle image messages
          const processedChats = userChats.map(chat => {
            const processedMessages = (chat.messages || []).map(msg => {
              if (msg && msg.text && typeof msg.text === 'string' && 
                  msg.text.includes('supabase.co/storage/v1/')) {
            return {
              ...msg,
                  image: msg.text,
                  text: ''
            };
          }
          return msg;
        });

            return {
              id: chat.chat_id,
              name: chat.name || 'Chat',
              description: chat.description || '',
              role: chat.role || '',
              roleDescription: chat.role_description || '',
              messages: processedMessages,
            };
          });
          
          setChats(processedChats);
          
          // If there's a specific chatid from route params, load that chat
          if (chatid && chatid !== 'undefined' && chatid !== 'null') {
            const specificChat = processedChats.find(chat => chat.id === chatid);
            if (specificChat) {
              console.log('Loading specific chat:', chatid);
              setCurrentChatId(chatid);
              setMessages(specificChat.messages || []);
              setCurrentRole(specificChat.role || '');
            } else {
              // If a specific chat ID was requested but not found, create a new one with that ID
              console.log('Creating new chat with ID:', chatid);
              startNewChat(chatid);
              Toast.show({
                type: 'success',
                text1: 'New Chat Created',
                position: 'bottom',
                visibilityTime: 2000,
              });
            }
          } else {
            // No specific chat requested, load the most recent one instead of creating a new one
            const mostRecentChat = processedChats[0];
            console.log('Loading most recent chat:', mostRecentChat.id);
            setCurrentChatId(mostRecentChat.id);
            setMessages(mostRecentChat.messages || []);
            setCurrentRole(mostRecentChat.role || '');
          }
        } else {
          // No chats found for this user, create a new one
          console.log('No chats found, creating a new chat');
          const newChatId = Date.now().toString();
          startNewChat(newChatId);
          Toast.show({
            type: 'success',
            text1: 'New Chat Created',
            position: 'bottom',
            visibilityTime: 2000,
          });
        }
        
        setDataLoaded(true);
        
        // Set up real-time subscription for chat updates
        setupChatSubscription(userId);
      } catch (error) {
        console.error('Error in fetchUserChats:', error);
        setDataLoaded(true);
        
        // Fallback to creating a new chat if there's an error
        const newChatId = Date.now().toString();
        startNewChat(newChatId);
      }
    };
    
    // Setup real-time subscription to chat updates
    const setupChatSubscription = (userId) => {
      // Check if subscription already exists
      if (chatSubscription) {
        chatSubscription.unsubscribe();
      }
      
      chatSubscription = supabase
        .channel('user_chats_changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_chats',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          console.log('Real-time update received:', payload);
          
          // Handle different types of changes
          if (payload.eventType === 'INSERT') {
            handleChatInsert(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            handleChatUpdate(payload.new);
          } else if (payload.eventType === 'DELETE') {
            handleChatDelete(payload.old);
          }
        })
        .subscribe();
    };
    
    // Handle a new chat being inserted
    const handleChatInsert = (newChat) => {
      // Process messages for images
      const processedMessages = newChat.messages.map(msg => {
        if (msg.text && typeof msg.text === 'string' && 
            msg.text.includes('supabase.co/storage/v1/')) {
          return {
            ...msg,
            image: msg.text,
            text: ''
          };
        }
        return msg;
      });
      
      // Add the new chat to the state
      setChats(prevChats => {
        // Check if chat already exists
        const chatExists = prevChats.some(chat => chat.id === newChat.chat_id);
        if (chatExists) return prevChats;
        
        // Add the new chat
        return [{
          id: newChat.chat_id,
          name: newChat.name || 'Chat',
          description: newChat.description || '',
          role: newChat.role || '',
          roleDescription: newChat.role_description || '',
          messages: processedMessages,
        }, ...prevChats];
      });
    };
    
    // Handle a chat being updated
    const handleChatUpdate = (updatedChat) => {
      // Process messages for images
      const processedMessages = updatedChat.messages.map(msg => {
        if (msg.text && typeof msg.text === 'string' && 
            msg.text.includes('supabase.co/storage/v1/')) {
          return {
            ...msg,
            image: msg.text,
            text: ''
          };
        }
        return msg;
      });
      
      // Update the chat in the state
      setChats(prevChats => prevChats.map(chat => 
        chat.id === updatedChat.chat_id 
          ? {
              ...chat,
              name: updatedChat.name || 'Chat',
              description: updatedChat.description || '',
              role: updatedChat.role || '',
              roleDescription: updatedChat.role_description || '',
              messages: processedMessages,
            }
          : chat
      ));
      
      // If this is the current chat, update the messages and role
      if (currentChatId === updatedChat.chat_id) {
        setMessages(processedMessages);
        setCurrentRole(updatedChat.role || '');
      }
    };
    
    // Handle a chat being deleted
    const handleChatDelete = (deletedChat) => {
      setChats(prevChats => prevChats.filter(chat => chat.id !== deletedChat.chat_id));
      
      // If the deleted chat is the current chat, select another chat
      if (currentChatId === deletedChat.chat_id) {
        setChats(prevChats => {
          // Get the remaining chats
          const remainingChats = prevChats.filter(chat => chat.id !== deletedChat.chat_id);
          
          if (remainingChats.length > 0) {
            // Select the most recent chat
            const newCurrentChat = remainingChats[0];
            setCurrentChatId(newCurrentChat.id);
            setMessages(newCurrentChat.messages || []);
            setCurrentRole(newCurrentChat.role || '');
          } else {
            // No chats remain, start a new one
            startNewChat();
          }
          
          return remainingChats;
        });
      }
    };
    
    // Fetch chats on mount
    fetchUserChats();
    
    // Cleanup subscription on unmount
    return () => {
      if (chatSubscription) {
        chatSubscription.unsubscribe();
      }
    };
  }, []);

  // Modify the startNewChat to accept chatId parameter and ensure proper initialization
  const startNewChat = async (customChatId) => {
    try {
      // Generate a new chat ID if none provided
      const newChatId = customChatId || Date.now().toString();
      console.log(`Starting new chat with ID: ${newChatId}`);
      
      // Show toast for user feedback
      Toast.show({
        type: 'success',
        text1: 'New Chat Created',
        position: 'bottom',
        visibilityTime: 2000,
      });
      
      // Get current user session first to ensure we have authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create a local chat object first regardless of authentication
      const timestamp = new Date().toISOString();
      const localChatObj = {
      id: newChatId,
      name: 'New Chat',
      description: '',
      role: '',
        roleDescription: '',
      messages: [],
    };
      
      // Update local state immediately
      setChats(prevChats => [localChatObj, ...prevChats.filter(chat => chat.id !== newChatId)]);
    setCurrentChatId(newChatId);
    setIsLoading(false);
    setMessages([]);
    setCurrentRole('');
    setIsSidebarOpen(false);
      
      // If user is not authenticated, just use the local state
      if (!session?.user?.id) {
        console.log('No authenticated user, using local chat only');
        return;
      }
      
      const userId = session.user.id;
      
      // Check if the chat already exists in Supabase
      const { data: existingChat, error: checkError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', newChatId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking if chat exists:', checkError);
      }
      
      // If chat already exists, just use local updates
      if (existingChat) {
        console.log('Chat already exists in Supabase, using existing data');
        return;
      }
      
      // Create a new chat object for Supabase
      const newChat = {
        chat_id: newChatId,
        user_id: userId,
        name: 'New Chat',
        description: '',
        role: '',
        role_description: '',
        messages: [],
        created_at: timestamp,
        updated_at: timestamp
      };
      
      // Insert the new chat in Supabase
      const { error: insertError } = await supabase
        .from('user_chats')
        .insert(newChat);
      
      if (insertError) {
        console.error('Error creating new chat in Supabase:', insertError);
        // Continue using local state, already set up above
      } else {
        console.log('New chat created in Supabase');
      }
    } catch (error) {
      console.error('Error during new chat creation:', error);
      // Local state has already been updated, so no need to update again
    }
  };

  const handleAttach = () => {
    setShowAdditionalButtons(prev => !prev); // Toggle additional buttons visibility
    // Change the icon from plus to cross
  };

  const handleCamera = (navigation) => {
    navigation.navigate('CameraScreen');
  };
  

  
  const selectChat = async (chatId) => {
    setCurrentChatId(chatId);
    const selectedChat = chats.find(chat => chat.id === chatId);
    
    if (selectedChat) {
      setMessages(selectedChat.messages || []);
      setCurrentRole(selectedChat.role || '');
    } else {
      setMessages([]);
      setCurrentRole('');
    }
    
    setIsSidebarOpen(false);
    
    try {
      // Get the most up-to-date chat data from Supabase
      const { data: chatData, error: chatError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', chatId)
        .single();
      
      if (chatError) {
        console.error('Error fetching selected chat:', chatError);
        return;
      }
      
      if (chatData) {
        // Process messages for images
        const processedMessages = chatData.messages.map(msg => {
          if (msg.text && typeof msg.text === 'string' && 
              msg.text.includes('supabase.co/storage/v1/')) {
            return {
              ...msg,
              image: msg.text,
              text: ''
            };
          }
          return msg;
        });
        
        // Update local state with latest data
        setMessages(processedMessages);
        setCurrentRole(chatData.role || '');
        
        // Update the chat in the local state
        setChats(prevChats => prevChats.map(chat => 
          chat.id === chatId 
            ? { 
                ...chat, 
                messages: processedMessages,
                name: chatData.name,
                description: chatData.description,
                role: chatData.role,
                roleDescription: chatData.role_description
              } 
            : chat
        ));
      }
    } catch (error) {
      console.error('Error selecting chat:', error);
    }
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
  const handleRoleSelection = async (role) => {
    // First ensure we have a current chat
    if (!currentChatId) {
      // Create a new chat if we don't have one
      const newChatId = Date.now().toString();
      await startNewChat(newChatId);
      setCurrentChatId(newChatId);
    }
    
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
      roleDescription = `I'll now a ${role}. How can I help you?`;
    }
    
    // Set current role and store the roleDescription internally for use in API calls
    setCurrentRole(role);
    
    // Update the current chat with the selected role
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId ? { ...chat, role, roleDescription } : chat
    ));
    
    // Add a simple message to the user indicating the role has been set
    const userVisibleMessage = `I'll now a ${role}. How can I help you?`;
    const newMessage = {
      id: Date.now().toString(),
      text: userVisibleMessage,
      sender: 'bot',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    try {
      // Check if the chat exists in the database
      const { data: existingChat, error: checkError } = await supabase
        .from('user_chats')
        .select('*')
        .eq('chat_id', currentChatId)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking if chat exists:', checkError);
      }
      
      if (existingChat) {
        // If the chat exists, update it
        const { error: updateError } = await supabase
          .from('user_chats')
          .update({
            role: role,
            role_description: roleDescription,
            updated_at: new Date().toISOString(),
            messages: [...(existingChat.messages || []), newMessage]
          })
          .eq('chat_id', currentChatId);
        
        if (updateError) {
          console.error('Error updating role in Supabase:', updateError);
        } else {
          console.log('Role updated in Supabase');
        }
      } else {
        // If the chat doesn't exist, create it
        const { error: insertError } = await supabase
          .from('user_chats')
          .insert({
            chat_id: currentChatId,
            user_id: (await supabase.auth.getSession()).data.session.user.id,
            name: 'New Chat',
            description: userVisibleMessage,
            role: role,
            role_description: roleDescription,
            messages: [newMessage],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error creating chat with role in Supabase:', insertError);
        } else {
          console.log('New chat with role created in Supabase');
        }
      }
    } catch (error) {
      console.error('Error saving role to Supabase:', error);
    }
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

  // Function to handle image tap and show fullscreen view
  const handleImageTap = (imageUri) => {
    setFullScreenImage(imageUri);
  };

  // Add a function to render tables
  const renderTable = (tableData, index) => {
    if (!tableData.tableHeaders || !tableData.tableData || 
        tableData.tableHeaders.length === 0 || tableData.tableData.length === 0) {
      return null;
    }
    
    // Calculate column widths based on content
    const columnCount = Math.max(
      tableData.tableHeaders.length,
      ...tableData.tableData.map(row => row.length)
    );
    
    // Determine if table needs horizontal scrolling (more than 3 columns or very long content)
    const hasLongContent = tableData.tableHeaders.some(header => header.length > 15) || 
                           tableData.tableData.some(row => 
                             row.some(cell => cell && cell.length > 15)
                           );
    const needsScroll = columnCount > 3 || hasLongContent;
    
    return (
      <View key={`table-${index}`} style={styles.tableContainer}>
        {needsScroll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <TableContent tableData={tableData} />
          </ScrollView>
        ) : (
          <TableContent tableData={tableData} />
        )}
      </View>
    );
  };

  // Create a separate component for table content
  const TableContent = React.memo(({ tableData }) => {
    return (
      <View>
        {/* Table header row */}
        <View style={styles.tableHeaderRow}>
          {tableData.tableHeaders.map((header, headerIndex) => (
            <View key={`header-${headerIndex}`} style={[
              styles.tableHeaderCell,
              headerIndex === 0 ? styles.tableFirstColumn : null,
              headerIndex === tableData.tableHeaders.length - 1 ? styles.tableLastColumn : null
            ]}>
              <Text style={styles.tableHeaderText}>{header}</Text>
            </View>
          ))}
        </View>
        
        {/* Table data rows */}
        {tableData.tableData.map((row, rowIndex) => (
          <View key={`row-${rowIndex}`} style={[
            styles.tableRow,
            rowIndex % 2 === 0 ? styles.tableEvenRow : styles.tableOddRow
          ]}>
            {row.map((cell, cellIndex) => (
              <View key={`cell-${rowIndex}-${cellIndex}`} style={[
                styles.tableCell,
                cellIndex === 0 ? styles.tableFirstColumn : null,
                cellIndex === row.length - 1 ? styles.tableLastColumn : null
              ]}>
                <Text style={styles.tableCellText}>{cell || ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  });

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      
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
      <View style={[styles.header, {backgroundColor: colors.background2 , borderColor: colors.border ,borderBottomWidth: 1}]}>
      <TouchableOpacity style={styles.backButton2} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
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
       
      </View>

      {/* Chat List */}
      <Animatable.View animation="fadeIn" duration={1000} style={{ flex: 1 }}>
        {memoizedFlatList}

        {/* Placeholder for New Chat */}
        {messages.length === 0 && dataLoaded && (
          <View style={styles.placeholderContainer}>
            <Image source={require('../assets/matrix.png')} style={styles.placeholderImage} />
            <Text style={[styles.placeholderText , {color: colors.text}]}>Hi, I'm MatrixAI Bot.</Text>
            <Text style={[styles.placeholderText2 , {color: colors.text}]}>How can I help you today?</Text>
            
            {/* New role selection UI */}
            <Text style={[styles.placeholderText3 , {color: colors.text}]}>You can ask me any question or you</Text>
            <Text style={[styles.placeholderText4 , {color: colors.text}]}>can select the below role:</Text>
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
     
      
      {/* Image Preview (WhatsApp Style) */}
     

      {/* KeyboardAvoidingView to handle chat input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >

{isLoading && (
        <View style={[styles.loadingContainer, { 
          bottom: showAdditionalButtons && selectedImage ? -60 : 
                 showAdditionalButtons ? 25 : 
                 selectedImage ? -60 : 
                 -85 
        }]}>
          <LottieView
            source={require('../assets/dot.json')}
            autoPlay
            loop
            style={styles.loadingAnimation}
          />
        </View>
      )}
        <View style={styles.inputContentContainer}>
          {!selectedImage && (
            <View style={styles.NewChat}>
              <TouchableOpacity onPress={startNewChat} style={styles.NewChatButton}>
                <MaterialCommunityIcons name="chat-plus-outline" size={24} color="#fff" />
                <Text style={styles.NewChatText}>New Chat</Text>
              </TouchableOpacity>
            </View>
          )}
           {selectedImage && (
        <View style={[styles.imagePreviewContainer]}>
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

          <View style={styles.chatBoxContainer}>
            <TextInput
              style={[styles.textInput, { textAlignVertical: 'top' }]}
              placeholder={selectedImage ? "Add a caption..." : "Send a message..."}
              placeholderTextColor="#ccc"
              value={inputText}
              onChangeText={handleInputChange}
              onSubmitEditing={() => {
                handleSendMessage();
                Keyboard.dismiss();
              }}
              multiline={true}
              numberOfLines={3}
              maxLength={2000}
              scrollEnabled={true}
              returnKeyType="send"
              blurOnSubmit={Platform.OS === 'ios' ? false : true}
            />
            <TouchableOpacity onPress={handleAttach} style={styles.sendButton}>
              {showAdditionalButtons ? (
                <Ionicons name="close" size={28} color="#4C8EF7" />
              ) : (
                <MaterialCommunityIcons name="plus" size={28} color="#4C8EF7" />
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
                  <Text style={{color: colors.text}}>Photo</Text>
                </TouchableOpacity>
                      
                <TouchableOpacity style={styles.additionalButton2} onPress={() => handleImageOCR('gallery')}>
                  <View style={styles.additionalButton}>
                    <Ionicons name="image" size={28} color="#4C8EF7" />
                  </View>
                  <Text style={{color: colors.text}}>Image</Text>
                </TouchableOpacity>
                      
                <TouchableOpacity style={styles.additionalButton2}>
                  <View style={styles.additionalButton}>
                    <Ionicons name="attach" size={28} color="#4C8EF7" />
                  </View>
                  <Text style={{color: colors.text}}>Document</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

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

      {/* Full Screen Image Modal */}
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


  backButton2: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
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
 
  },
  headerIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
   
  },
  headerIcon2: {

  },
  headerIcon3: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    marginBottom: 15,
    left: 0,
    right: 0,
    width: '100%',
  },
  inputContentContainer: {
    width: '100%',
    paddingBottom: 10,
  },
  chatBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 10, // fixed padding is better than '%'
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#007bff',
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  
  NewChat: {
    alignSelf: 'center',
    backgroundColor: '#4C8EF7',
    borderRadius: 10,
    marginBottom: 10,
  },
  NewChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    justifyContent: 'center',

    borderRadius: 20,
  },
  NewChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  botIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sendButton: {
   padding: 5,
  },
  
  // WhatsApp style image preview container
  imagePreviewContainer: {
  marginBottom:5,
  marginLeft:15,
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
    overflow: 'visible', // Changed from 'hidden' to show tails
    position: 'relative',
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
    maxHeight: 80, // Limit height for roughly 3 lines
    minHeight: 40,
    padding: 10,
    fontSize: 16,
    marginHorizontal: 10,
    justifyContent: 'center',
    alignSelf: 'center',
    textAlignVertical: 'top',
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
    top: '40%',
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
    fontSize: 12,
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
    width: '100%',
paddingVertical:10,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    marginBottom:-10,

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
    width:'90%',
   paddingVertical:23,
  padding:28,
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
  closeFullScreenButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageActionButtons: {
    flexDirection: 'row',
    marginTop: 2,
    padding: 2,
  },
  botMessageActions: {
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  userMessageActions: {
    alignSelf: 'flex-end',
    marginRight: 15,
  },
  actionButton: {
    padding: 5,
    marginHorizontal: 3,
  },
  messageWrapperOuter: {
    maxWidth: '85%',
    marginVertical: 4,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginVertical: 10,
    overflow: 'hidden',
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableEvenRow: {
    backgroundColor: '#FFFFFF',
  },
  tableOddRow: {
    backgroundColor: '#F9F9F9',
  },
  tableHeaderCell: {
    minWidth: 100,
    maxWidth: 250,
    padding: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  tableCell: {
    minWidth: 100,
    maxWidth: 250,
    padding: 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  tableFirstColumn: {
    borderLeftWidth: 0,
  },
  tableLastColumn: {
    borderRightWidth: 0,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333333',
  },
  tableCellText: {
    fontSize: 14,
    color: '#555555',
  },
});

export default BotScreen;
