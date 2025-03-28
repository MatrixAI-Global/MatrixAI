import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import { useAuthUser } from '../hooks/useAuthUser';
import { useLanguage } from '../context/LanguageContext';
import { LANGUAGES } from '../utils/languageUtils';

const EditProfile = ({ navigation }) => {
  const { uid } = useAuthUser();
  const { t, currentLanguage, changeLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    gender: '',
    age: '',
    email: '',
    dp_url: '',
    preferred_language: '',
  });
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [isEdited, setIsEdited] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const fetchUserData = async () => {
    try {
      const response = await fetch('https://matrix-server.vercel.app/userinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid }),
      });
      const result = await response.json();
      if (result.success) {
        // Set preferred language if it exists in the profile data
        const userData = result.data;
        setProfileData({
          ...userData,
          preferred_language: userData.preferred_language || currentLanguage,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      Alert.alert('Error', 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleImagePick = async () => {
    const options = {
      mediaType: 'photo',
      quality: 1,
    };

    try {
      const result = await ImagePicker.launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setUploading(true);
        const asset = result.assets[0];
        
        // Get file extension from uri
        const fileExt = asset.uri.substring(asset.uri.lastIndexOf('.') + 1);
        
        // Create file name with correct extension
        const filePath = `users/${uid}/profile-${Date.now()}.${fileExt}`;

        // Fetch the image data
        const response = await fetch(asset.uri);
        const imageData = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, imageData, {
            contentType: asset.type || 'image/jpeg',
            cacheControl: '3600'
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);

        setProfileData(prev => ({ ...prev, dp_url: publicUrl }));
        setIsEdited(true);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      // Update the profile including the preferred language
      const response = await fetch('https://matrix-server.vercel.app/edituser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid,
          name: profileData.name,
          age: parseInt(profileData.age),
          gender: profileData.gender,
          dp_url: profileData.dp_url,
          preferred_language: profileData.preferred_language,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // If language was changed, apply it
        if (profileData.preferred_language !== currentLanguage) {
          await changeLanguage(profileData.preferred_language);
        }
        
        Alert.alert('Success', t('profileUpdated'));
        fetchUserData();
        setIsEdited(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', t('errorOccurred'));
    }
  };

  const handleSelectLanguage = async (language) => {
    setProfileData(prev => ({ ...prev, preferred_language: language }));
    setLanguageModalVisible(false);
    setIsEdited(true);
  };

  const renderField = (label, value, field) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            setEditingField(field);
            setTempValue(value?.toString() || '');
          }}
        >
          <Ionicons name="pencil" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
      {editingField === field ? (
        <TextInput
          style={styles.input}
          value={tempValue}
          onChangeText={setTempValue}
          onBlur={() => {
            setProfileData(prev => ({ ...prev, [field]: tempValue }));
            setEditingField(null);
            setIsEdited(true);
          }}
          keyboardType={field === 'age' ? 'numeric' : 'default'}
          autoFocus
        />
      ) : (
        <Text style={styles.fieldValue}>{value || t('notSet')}</Text>
      )}
    </View>
  );

  // Language field with dropdown
  const renderLanguageField = () => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{t('preferredLanguage')}</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setLanguageModalVisible(true)}
        >
          <Ionicons name="pencil" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.fieldValue}>
        {profileData.preferred_language || t('notSet')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Image source={require('../assets/back.png')} style={styles.headerIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('editProfile')}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileImageContainer}>
          <View style={styles.imageWrapper}>
            {uploading ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : (
              <Image
                source={
                  profileData.dp_url
                    ? { uri: profileData.dp_url }
                    : require('../assets/avatar.png')
                }
                style={styles.profileImage}
              />
            )}
            <TouchableOpacity
              style={styles.imageEditButton}
              onPress={handleImagePick}
            >
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          {renderField(t('name'), profileData.name, 'name')}
          {renderField(t('age'), profileData.age, 'age')}
          {renderField(t('gender'), profileData.gender, 'gender')}
          {renderLanguageField()}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{t('email')}</Text>
            <Text style={styles.fieldValue}>{profileData.email}</Text>
          </View>
        </View>

        {isEdited && (
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>{t('updateProfile')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('chooseLanguage')}</Text>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.keys(LANGUAGES)}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.languageItem,
                    profileData.preferred_language === item && styles.selectedLanguageItem,
                  ]}
                  onPress={() => handleSelectLanguage(item)}
                >
                  <Text
                    style={[
                      styles.languageText,
                      profileData.preferred_language === item && styles.selectedLanguageText,
                    ]}
                  >
                    {LANGUAGES[item].name}
                  </Text>
                  {profileData.preferred_language === item && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  profileImageContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  imageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  imageEditButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  editButton: {
    padding: 8,
  },
  input: {
    fontSize: 16,
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    paddingVertical: 4,
  },
  updateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedLanguageItem: {
    backgroundColor: '#007AFF',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  selectedLanguageText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default EditProfile;
