import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Share, ActivityIndicator } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../supabaseClient';
import { useAuthUser } from '../../hooks/useAuthUser';

const ReferralScreen = ({ navigation }) => {
  const { uid } = useAuthUser();
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    if (uid) {
      fetchReferralCode();
      fetchCoins();
    }
  }, [uid]);

  const fetchReferralCode = async () => {
    try {
      // First check if code exists in AsyncStorage
      const storedCode = await AsyncStorage.getItem('referralCode');
      
      if (storedCode) {
        setReferralCode(storedCode);
        setLoading(false);
        return;
      }
      
      // If not in storage, fetch from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('uid', uid)
        .single();

      if (error) {
        console.error('Error fetching referral code:', error);
        setLoading(false);
        return;
      }

      if (data && data.referral_code) {
        setReferralCode(data.referral_code);
        // Save to AsyncStorage for future use
        await AsyncStorage.setItem('referralCode', data.referral_code);
      } else {
        // If no referral code exists, generate one
        const newCode = generateReferralCode();
        await updateReferralCode(newCode);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate a random referral code
  const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Update the referral code in Supabase
  const updateReferralCode = async (code) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ referral_code: code })
        .eq('uid', uid);

      if (error) {
        console.error('Error updating referral code:', error);
        return;
      }

      setReferralCode(code);
      await AsyncStorage.setItem('referralCode', code);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchCoins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('uid', uid)
        .single();

      if (error) {
        console.error('Error fetching coins:', error);
        return;
      }

      if (data) {
        setCoins(data.coins || 0);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard.');
  };

  const shareReferralCode = async () => {
    try {
      await Share.share({
        message: `Join me on MatrixAI! Use my referral code: ${referralCode} to get 15 coins when you sign up!`,
      });
    } catch (error) {
      console.error('Error sharing referral code:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Image source={require('../../assets/back.png')} style={styles.backIcon} />
            </TouchableOpacity>

      {/* Blue Area */}
      <View style={styles.blueArea}>
        <Text style={styles.header}>Refer Your Friends</Text>
        <Text style={styles.subHeader}>Get 25 coins for each Invite</Text>
      </View>

      {/* Coin Box Overlapping Blue and White Areas */}
      <View style={styles.coinBoxContainer}>
        <View style={styles.coinBox}>
          <Image source={require('../../assets/coin.png')} style={styles.coinIcon} />
          <View style={styles.coinBox2}>
          <Text style={styles.coinText}>Total Coins</Text>
          <Text style={styles.coinAmount}>{coins}</Text>
          </View>
        </View>
      </View>

      {/* White Area */}
      <View style={styles.whiteArea}>
        {/* Instructions Section */}
        <View style={styles.instructions}>
          <View style={styles.instructionRow}>
            <Image source={require('../../assets/invite-icon.png')} style={styles.icon} />
            <Text style={styles.instructionText}>
              Invite your friend to install the app via link or ask to add code during signup
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <Image source={require('../../assets/gift-icon.png')} style={styles.icon} />
            <Text style={styles.instructionText}>
              When your friend signs up, you will get <Text style={styles.highlight}>25 coins</Text> and they will get{' '}
              <Text style={styles.highlight}>15 coins</Text>
            </Text>
          </View>
        </View>

        {/* Referral Code Section */}
        <View style={styles.referralContainer}>
          <Text style={styles.referralText}>Your referral code</Text>
          {loading ? (
            <ActivityIndicator size="small" color="#003399" />
          ) : (
            <TouchableOpacity style={styles.codeBox} onPress={copyToClipboard}>
              <Text style={styles.code}>{referralCode}</Text>
              <Image source={require('../../assets/copy.png')} style={styles.copyIcon} />
            </TouchableOpacity>
          )}
        </View>

        {/* Invite Button */}
        <TouchableOpacity style={styles.inviteButton} onPress={shareReferralCode}>
          <Text style={styles.inviteButtonText}>Invite Friend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFFFF',
     
  },
  backButton: {
    position: 'absolute',
    top: 70,
    left: 10,
    zIndex: 10,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  blueArea: {
    backgroundColor: '#2158AB',
    padding: 20,
   
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
paddingBottom:60,
  },
  header: {
    fontSize: 18,
    marginTop:90,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'left',
  },
  subHeader: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'left',
    marginTop: 10,
  },
  coinBoxContainer: {
    position: 'absolute',
    top: 180,
    left: '3%',
    right: '3%',
    alignItems: 'center',
    zIndex: 10,
  },
  coinBox: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    flexDirection:'row',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    elevation: 13,
  },
  coinBox2: {
  
    padding: 10,
    flexDirection:'column',
 
 
  },
  coinIcon: {
    width: 50,
    height: 50,

  },
  coinText: {
    fontSize: 16,
    color: '#333',
  },
  coinAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4B4B4BFF',
  },
  whiteArea: {
    flex: 1,
    backgroundColor: '#fff',
   marginTop:10,
    paddingHorizontal: 16,
    paddingTop: 50,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  instructions: {
    backgroundColor: '#eaf3ff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#003399',
  },
  referralContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  referralText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  codeBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#003399',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  code: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  copyIcon: {
    width: 24,
    height: 24,
  },
  inviteButton: {
    backgroundColor: '#FF6600',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ReferralScreen;
