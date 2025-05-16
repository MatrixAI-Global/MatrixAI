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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';
import RNFS from 'react-native-fs';
import { decode } from 'base-64'; // Import decode from base-64 package

import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-picker';
import { useAuthUser } from '../hooks/useAuthUser';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { ThemedView, ThemedText, ThemedCard } from '../components/ThemedView';
import ThemedStatusBar from '../components/ThemedStatusBar';
import { useProfileUpdate } from '../context/ProfileUpdateContext';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
// Convert base64 to byte array - React Native compatible approach
const decodeBase64 = (base64String) => {
  const byteCharacters = decode(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Uint8Array(byteNumbers);
};

const EditProfile = ({ navigation }) => {
  const { uid } = useAuthUser();
  const { t } = useLanguage();
  const { getThemeColors } = useTheme();
  const { triggerUpdate } = useProfileUpdate();
  const colors = getThemeColors();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    gender: '',
    age: '',
    email: '',
    dp_url: '',
  });
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [isEdited, setIsEdited] = useState(false);

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
        const userData = result.data;
        setProfileData({
          ...userData
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
      includeBase64: true, // Request base64 data
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

        // Method 1: Using base64 data directly from the picker result
        if (asset.base64) {
          console.log('Using base64 data directly from picker result');
          const arrayBuffer = decodeBase64(asset.base64);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(filePath, arrayBuffer, {
              contentType: asset.type || 'image/jpeg',
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;
        } 
        // Method 2: Reading file from filesystem (fallback)
        else {
          // For iOS, we need to handle the file:// protocol
          let imageUri = asset.uri;
          if (Platform.OS === 'ios' && !imageUri.startsWith('file://')) {
            imageUri = `file://${imageUri}`;
          }
          
          console.log('Reading file from filesystem');
          // Read the file as base64
          const fileContent = await RNFS.readFile(imageUri, 'base64');
          const arrayBuffer = decodeBase64(fileContent);
          
          // Upload to Supabase storage using the approach that works in other parts of the app
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-uploads')
            .upload(filePath, arrayBuffer, {
              contentType: asset.type || 'image/jpeg',
              cacheControl: '3600'
            });

          if (uploadError) throw uploadError;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);

        console.log('Upload successful, public URL:', publicUrl);
        setProfileData(prev => ({ ...prev, dp_url: publicUrl }));
        setIsEdited(true);
      }
    } catch (error) {
      console.error('Error uploading image:', error.message || error);
      Alert.alert('Error', 'Failed to upload image: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    try {
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
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Trigger profile update to refresh headers
        triggerUpdate();
        
        Alert.alert('Success', t('profileUpdated'));
        fetchUserData();
        setIsEdited(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', t('errorOccurred'));
    }
  };

  const renderField = (label, value, field) => (
    <TouchableOpacity 
      style={[styles.fieldContainer, {backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border}]}
      onPress={() => {
        setEditingField(field);
        setTempValue(value?.toString() || '');
      }}
    >
      <View style={styles.fieldHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name={field === 'name' ? 'person-outline' : field === 'age' ? 'calendar-outline' : 'transgender-outline'} size={20} color={colors.primary} />
        </View>
        <ThemedText style={[styles.fieldLabel, {color: colors.text}]}>{label}</ThemedText>
        <Ionicons name="chevron-forward" size={20} color={colors.text + '80'} />
      </View>
      {editingField === field ? (
        <TextInput
          style={[styles.input, {color: colors.text, borderBottomColor: colors.primary}]}
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
        <ThemedText style={[styles.fieldValue, {color: colors.text}]}>{value || t('notSet')}</ThemedText>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ThemedStatusBar />
      <View style={[styles.header, {backgroundColor: colors.background, borderBottomColor: colors.border}]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back-ios-new" size={24} color="white" />
      </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, {color: colors.text}]}>{t('editProfile')}</ThemedText>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileImageContainer}>
          <View style={[styles.imageWrapper, {backgroundColor: colors.card}]}>
            {uploading ? (
              <ActivityIndicator size="large" color={colors.primary} />
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
              style={[styles.imageEditButton, {backgroundColor: colors.primary}]}
              onPress={handleImagePick}
            >
              <Ionicons name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ThemedCard style={[styles.card, {backgroundColor: colors.card, borderWidth: 0.8, borderColor: colors.border}]}>
          {renderField(t('name'), profileData.name, 'name')}
          {renderField(t('age'), profileData.age, 'age')}
          {renderField(t('gender'), profileData.gender, 'gender')}
          <TouchableOpacity style={[styles.fieldContainer, {backgroundColor: colors.card, borderBottomWidth: 0}]}>
            <View style={styles.fieldHeader}>
              <View style={styles.iconContainer}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
              </View>
              <ThemedText style={[styles.fieldLabel, {color: colors.text}]}>{t('email')}</ThemedText>
            </View>
            <ThemedText style={[styles.fieldValue, {color: colors.text}]}>{profileData.email}</ThemedText>
          </TouchableOpacity>
        </ThemedCard>

        {isEdited && (
          <TouchableOpacity 
            style={[styles.updateButton, {backgroundColor: colors.primary}]} 
            onPress={handleUpdate}
          >
            <Text style={styles.updateButtonText}>{t('updateProfile')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldContainer: {
    flexDirection: 'column',
    paddingVertical: 15,
    width: '100%',
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 15,
  },
  fieldLabel: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    marginLeft: 35,
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
});

export default EditProfile;
