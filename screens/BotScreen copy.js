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
  ScrollView,
  Share,
} from 'react-native';
import LottieView from 'lottie-react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
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
import Clipboard from '@react-native-clipboard/clipboard';

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
  const [isInitialLoading, setIsInitialLoading] = useState(true); // New state for initial loading
  const [showSummaryPrompt, setShowSummaryPrompt] = useState(true); // New state for summary prompt
  const isMounted = useRef(true);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();  
  // Initialize messages state with an empty array instead of default message
  const [messages, setMessages] = useState([]);

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
          
          // Send request using matrix-server API
          // We already have the file as base64 from earlier
          const response = await axios.post(
            'https://ddtgdhehxhgarkonvpfq.supabase.co/functions/v1/createContent',
            {
              prompt: question + `\n\n[Image data: ${fileContent}]`
            },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          // Extract the response
          const botMessage = response.data.output.text;
          
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
      // Prepare message history for context
      const contextMessages = messageHistory.slice(-5); // Include last 5 messages for context
      const contextString = contextMessages.map(msg => 
        `${msg.role === 'assistant' ? 'AI' : 'User'}: ${msg.content}`
      ).join('\n');
      
      // Create a prompt with context
      let userMessageContent = userMessage;
      if (contextMessages.length > 0) {
        userMessageContent = "Previous conversation:\n" + contextString + "\n\nUser's new message: " + userMessageContent;
      }

      // Make API call
      const response = await axios.post(
        'https://matrix-server.vercel.app/ask-ai',
        {
          prompt: userMessageContent
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Extract AI response
      let botMessage = response.data.output.text;
      
      // Remove markdown formatting if needed
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
        setIsInitialLoading(true);
        const response = await axios.post('https://matrix-server.vercel.app/getChat', {
          uid,
          chatid: audioid, // Using audioid as chatid
        });

        const fetchedMessages = response.data.messages || [];
        const hasChatHistory = fetchedMessages.length > 0;

        if (hasChatHistory) {
          // If we have chat history, update messages with fetched messages
          setMessages(fetchedMessages.map(msg => ({
            ...msg,
            image: msg.imageUrl || msg.image,
            text: msg.text.replace(/(\*\*|\#\#)/g, ""),
          })));
        } else {
          // If no chat history, create and save the initial greeting message
          const initialMessage = {
            id: '1',
            text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
            sender: 'bot',
          };
          
          // Set the initial message in state
          setMessages([initialMessage]);
          
          // Save initial message to database
          await saveChatHistory(initialMessage.text, initialMessage.sender);
        }

        setDataLoaded(true);
      } catch (error) {
        console.error('Error fetching chat history:', error);
        // Handle 404 or other errors by setting the initial greeting message
        const initialMessage = {
          id: '1',
          text: "Hello.👋 I'm your new friend, MatrixAI Bot. You can ask me any questions.",
          sender: 'bot',
        };
        setMessages([initialMessage]);
        setDataLoaded(true);
      } finally {
        setIsInitialLoading(false);
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

  // Function to process and format the message text
  const formatMessageText = (text) => {
    if (!text) return [];
    
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
        const isChineseHeading = /^#\s+.+/.test(line) || /^\d+\.\s+.+/.test(line);
        const isChineseSubheading = /^[•⁠-]\s+.+/.test(line);
        const isChineseSubSubheading = /^\s+-\s+.+/.test(line);
        const hasMathExpression = isMathExpression(line);
        
        if (line.trim() !== '') {
          result.push({
            text: line,
            isChineseHeading,
            isChineseSubheading,
            isChineseSubSubheading,
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

  const renderMessage = ({ item }) => {
    const isBot = item.sender === 'bot';
    const isUser = item.sender === 'user';
    const isExpanded = expandedMessages[item.id];
    const shouldTruncate = item.text && item.text.length > 100 && !isExpanded;
  
    // Function to handle long press
    const handleLongPress = () => {
      Alert.alert(
        'Message Options',
        '',
        [
          {
            text: 'Copy Text',
            onPress: () => {
              Clipboard.setString(item.text);
              Alert.alert('Success', 'Text copied to clipboard');
            }
          },
          {
            text: 'Share',
            onPress: async () => {
              try {
                await Share.share({
                  message: item.text,
                });
              } catch (error) {
                console.error('Error sharing:', error);
                Alert.alert('Error', 'Failed to share message');
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    };

    // Handle copy text function
    const handleCopyText = () => {
      if (item.text) {
        Clipboard.setString(item.text);
        Alert.alert('Success', 'Text copied to clipboard');
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
      
          <View style={{ flexDirection: isBot ? 'row' : 'row-reverse', alignItems: 'flex-start' }}>
            <View style={[styles.messageWrapperOuter, isBot ? {alignSelf: 'flex-start'} : {alignSelf: 'flex-end'}]}>
              <TouchableOpacity
                onLongPress={handleLongPress}
                delayLongPress={500}
                activeOpacity={1}
              >
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
                        if (line.isTable) {
                          return renderTable(line, index);
                        } else if (line.isChineseHeading) {
                          return (
                            <View key={`chinese-heading-${index}`} style={styles.chineseHeadingContainer}>
                              <Text style={styles.chineseHeadingText}>
                                {line.text.replace(/^#\s+|\d+\.\s+/, '')}
                              </Text>
                            </View>
                          );
                        } else if (line.isChineseSubheading) {
                          return (
                            <View key={`chinese-subheading-${index}`} style={styles.chineseSubheadingContainer}>
                              <Text style={styles.chineseSubheadingPointer}>•</Text>
                              <Text style={styles.chineseSubheadingText}>
                                {line.text.replace(/^[•⁠-]\s+/, '')}
                              </Text>
                            </View>
                          );
                        } else if (line.isChineseSubSubheading) {
                          return (
                            <View key={`chinese-subsubheading-${index}`} style={styles.chineseSubSubheadingContainer}>
                              <Text style={styles.chineseSubSubheadingPointer}>-</Text>
                              <Text style={styles.chineseSubSubheadingText}>
                                {line.text.trim()}
                              </Text>
                            </View>
                          );
                        } else if (line.hasMathExpression) {
                          return renderTextWithMath(line, index);
                        } else {
                          return (
                            <Text key={`text-${index}`} style={isBot ? styles.botText : styles.userText}>
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
                  <View style={isBot ? styles.botTail : styles.userTail} />
                </Animatable.View>
              </TouchableOpacity>
              
              {/* Message action buttons - now outside the bubble */}
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
                <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleGenerateMindmap(item)}
          >
            <Ionicons name="git-network-outline" size={18} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleGeneratePPT(item)}
          >
            <AntDesign name="pptfile1" size={18} color="#666" />
          </TouchableOpacity>
              </View>
            </View>
          </View>
       
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
      <View style={[styles.header, {backgroundColor: colors.background2 , borderColor: colors.border}]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
        <Image source={require('../assets/Avatar/Cat.png')} style={styles.botIcon} />
        <View style={styles.headerTextContainer}>
          <Text style={[styles.botName, {color: colors.text}]}>MatrixAI Bot</Text>
          <Text style={[styles.botDescription, {color: colors.text}]  }>Your virtual assistant</Text>
        </View>
      </View>

      {/* Loading State */}
      {isInitialLoading ? (
        <View style={styles.loadingFullScreenContainer}>
          <LottieView
            source={require('../assets/loading.json')}
            autoPlay
            loop
            style={styles.loadingFullScreenAnimation}
          />
        </View>
      ) : (
        // Chat List or No Messages View
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.chat,]}
          onContentSizeChange={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          onLayout={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
          ref={flatListRef}
          style={{ marginBottom: showAdditionalButtons ? 220 : 120 }}
          ListEmptyComponent={
            !isInitialLoading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet. Start a conversation!</Text>
              </View>
            )
          }
        />
      )}
        <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 10}
      >
      {/* Loading Animation */}
      {isLoading && (
        <View style={[styles.loadingContainer, { 
          bottom: showAdditionalButtons && selectedImage ? 30 : 
                 showAdditionalButtons ? 60 : 
                 selectedImage ? 30 : 
                 -40 
        }]}>
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
    

      {/* Chat Input Box */}
      <View style={styles.chatBoxContainer}>
        <TextInput
          style={[styles.textInput, { textAlignVertical: 'top' }]}
          placeholder="Type a message..."
          placeholderTextColor="#ccc"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
          multiline={true}
          numberOfLines={3}
          maxLength={2000}
          scrollEnabled={true}
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.quickActionContainer , {backgroundColor: colors.background2}]}>
        <TouchableOpacity 
          style={[styles.quickActionButton , {backgroundColor: colors.background2}]}
          onPress={() => transcription && fetchDeepSeekResponse(`Please provide a summary of this text in very structured format in the original language of the transcription: ${transcription}`)}
        >
          <Text style={styles.quickActionText}>Quick Summary</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.quickActionButton , {backgroundColor: colors.background2}]}
          onPress={() => transcription && fetchDeepSeekResponse(`Please extract and list the key points from this text in a structured format in the original language of the transcription: ${transcription}`)}
        >
          <Text style={styles.quickActionText}>Key Points</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.quickActionButton , {backgroundColor: colors.background2}]}
          onPress={() => transcription && fetchDeepSeekResponse(`Please analyze this text and provide potential solutions or recommendations for any problems or challenges mentioned and in the original language of the transcription: ${transcription}`)}
        >
          <Text style={styles.quickActionText}>Solution</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
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
    borderWidth: 2,
    borderColor: '#007bff',
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
    maxHeight: 80, // Limit height for roughly 3 lines
    minHeight: 40,
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
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageContainer: {
    maxWidth: '100%',
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
    position: 'relative',
    overflow: 'visible',
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
  paddingVertical:10,
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
    width: '100%',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
    flex: 1,
  },
  subheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
    paddingLeft: 16,
  },
  subheadingPointer: {
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
    color: '#2196F3',
  },
  subheadingText: {
    fontWeight: 'bold',
    fontSize: 14,
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
    marginBottom: 15,
    bottom: 0,
    left: 0,
    right: 0,
  },
  loadingFullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingFullScreenAnimation: {
    width: 200,
    height: 200,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  chineseHeadingContainer: {
    marginVertical: 12,
    padding: 8,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  chineseHeadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  chineseSubheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    paddingLeft: 16,
  },
  chineseSubheadingPointer: {
    fontSize: 16,
    marginRight: 8,
    color: '#2196F3',
  },
  chineseSubheadingText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  chineseSubSubheadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingLeft: 32,
  },
  chineseSubSubheadingPointer: {
    fontSize: 14,
    marginRight: 8,
    color: '#666',
  },
  chineseSubSubheadingText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  messageWrapperOuter: {
    maxWidth: '80%',
    marginVertical: 5,
  },
  messageActionButtons: {
    flexDirection: 'row',
    marginTop: 2,
    padding: 2,
    marginBottom: 3,
  },
  botMessageActions: {
    alignSelf: 'flex-start',
    marginLeft: 15,
  },
  userMessageActions: {
    alignSelf: 'flex-end',
    marginRight: 10,
  },
  actionButton: {
    padding: 5,
    marginHorizontal: 3,
    backgroundColor: 'transparent',
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

export default BotScreen2;
