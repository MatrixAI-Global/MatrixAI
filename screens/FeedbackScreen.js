import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const FeedbackScreen = ({ route, navigation }) => {
  const [issue, setIssue] = useState('');
  const [description, setDescription] = useState('');

  const commonIssues = [
    'Great experience and helpful',
    'Good experience but could be improved',
    'Could be better',
    'Not helpful at all',
    'Other issues',
  ];

  const handleSubmit = () => {
    if (!issue) {
      Alert.alert('Error', 'Please select an issue type');
      return;
    }
    if (!description) {
      Alert.alert('Error', 'Please describe your issue');
      return;
    }

    // Here you would typically make an API call to submit the help request
    Alert.alert(
      'Success',
      'Your request has been submitted. Our team will get back to you shortly.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Image
            source={require('../assets/back.png')}
            style={styles.headerIcon}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Help</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
       

        <Text style={styles.sectionTitle}>What do you think about our app?</Text>
        <View style={styles.issuesContainer}>
          {commonIssues.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.issueButton,
                issue === item && styles.issueButtonSelected,
              ]}
              onPress={() => setIssue(item)}
            >
              <Text
                style={[
                  styles.issueButtonText,
                  issue === item && styles.issueButtonTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Describe your issue</Text>
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={6}
            placeholder="Please provide details about your issue..."
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Request</Text>
        </TouchableOpacity>

      
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
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
  orderInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
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
  orderInfoText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  issuesContainer: {
    marginBottom: 24,
  },
  issueButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  issueButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  issueButtonText: {
    color: '#333',
    fontSize: 14,
  },
  issueButtonTextSelected: {
    color: '#fff',
  },
  textInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textInput: {
    height: 120,
    fontSize: 14,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
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
  supportInfo: {
    flex: 1,
    marginLeft: 12,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  supportText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  callButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 24,
  },
});

export default FeedbackScreen; 