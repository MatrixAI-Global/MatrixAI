import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
const FAQItem = ({ question, answer,navigation }) => {
  const [expanded, setExpanded] = useState(false);
  const animation = new Animated.Value(expanded ? 1 : 0);
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();

  const toggleExpand = () => {
    Animated.timing(animation, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);
  };

  const bodyHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  return (
    <TouchableOpacity style={styles.faqItem} onPress={toggleExpand} activeOpacity={0.7}>
      <View style={styles.faqHeader}>
        <Text style={[styles.faqQuestion, {color: colors.text}]}>{question}</Text>
        <Animated.View
          style={{
            transform: [
              {
                rotate: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
        >
          <Ionicons name="chevron-down" size={20} color={colors.text} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.faqBody, { height: bodyHeight }]}>
        <Text style={[styles.faqAnswer, {color: colors.text}]}>{answer}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const CustomerSupportScreen = ({ navigation }) => {
  const { getThemeColors } = useTheme();
  const colors = getThemeColors();
  const faqs = [
    {
      question: 'How do I purchase coins?',
      answer: 'You can purchase coins from the main screen by clicking on the "Buy Coins" button. We accept various payment methods including credit cards and digital wallets.',
    },
    {
      question: 'What is Matrix AI Pro?',
      answer: 'Matrix AI Pro is our premium subscription that gives you access to advanced features, unlimited generations, and priority support.',
    },
    {
      question: 'How can I get a refund?',
      answer: 'If you are not satisfied with your purchase, you can request a refund within 7 days. Please contact our support team with your order details.',
    },
    {
      question: 'Is my payment information secure?',
      answer: 'Yes, we use industry-standard encryption and secure payment processors to protect your payment information.',
    },
  ];

  const supportOptions = [
    {
      icon: 'chatbubbles-outline',
      title: 'Give Feedback',
      description: 'Give feedback to our support team',
        action: () => navigation.navigate('FeedbackScreen'),
    },
    {
      icon: 'mail-outline',
      title: 'Email Support',
      description: 'Get help via email',
      action: () => Linking.openURL('mailto:support@matrixai.com'),
    },
    // {
    //   icon: 'call-outline',
    //   title: 'Phone Support',
    //   description: 'Talk to our team',
    //   action: () => Linking.openURL('tel:+1234567890'),
    // },
  ];

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {backgroundColor: colors.background , borderBottomWidth: 0.8, borderColor: colors.border}]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
                               </TouchableOpacity>
        <Text style={[styles.headerTitle, {color: colors.text}]}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.supportOptionsContainer, {backgroundColor: colors.background2}]}>
          {supportOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.supportOption}
              onPress={option.action}
            >
              <View style={[styles.supportOptionIcon, {backgroundColor: colors.background2}]}>
                <Ionicons name={option.icon} size={24} color="#007AFF" />
              </View>
              <View style={styles.supportOptionContent}>
                <Text style={[styles.supportOptionTitle, {color: colors.text}]}>{option.title}</Text>
                <Text style={[styles.supportOptionDescription, {color: colors.text}]  }>
                  {option.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, {color: colors.text}]}>Frequently Asked Questions</Text>
        <View style={[styles.faqContainer, {backgroundColor: colors.background2}]}>
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} navigation={navigation} colors={colors.text} />
          ))}
        </View>

        {/* <View style={styles.communityCard}>
          <View style={styles.communityIcon}>
            <Ionicons name="people-outline" size={24} color="#007AFF" />
          </View>
          <View style={styles.communityContent}>
            <Text style={styles.communityTitle}>Join our Community</Text>
            <Text style={styles.communityDescription}>
              Get help from other users and share your experience
            </Text>
          </View>
          <TouchableOpacity style={styles.joinButton}>
            <Text style={styles.joinButtonText}>Join Now</Text>
          </TouchableOpacity>
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
   
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#007bff',
   
    marginRight:10,
  },
  headerIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  supportOptionsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  
  },
  supportOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportOptionContent: {
    flex: 1,
    marginLeft: 12,
  },
  supportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',

  },
  supportOptionDescription: {
    fontSize: 12,
  
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  faqContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  faqBody: {
    overflow: 'hidden',
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityContent: {
    flex: 1,
    marginLeft: 16,
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  communityDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  joinButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CustomerSupportScreen; 