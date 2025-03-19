import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useCoinsSubscription } from '../hooks/useCoinsSubscription';
import { supabase } from '../supabaseClient';

const Header2 = ({ navigation, uid, openDrawer }) => {
 
   
    const [userName, setUserName] = useState('');
    const [dpUrl, setDpUrl] = useState(null);

    useEffect(() => {
        if (uid) {
            fetchUserData();
        }
    }, [uid]);

    const fetchUserData = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('name, dp_url')
                .eq('uid', uid)
                .single();

            if (error) {
                console.error('Error fetching user data:', error);
                return;
            }

            if (data) {
                // Get first name and limit to 10 characters
                const firstName = data.name?.split(' ')[0] || '';
                setUserName(firstName.substring(0, 10));
                
                // Set profile picture URL if it exists
                if (data.dp_url) {
                    setDpUrl(data.dp_url);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    if (!uid) {
        console.log("No UID in Header");
        return <Text>No UID found</Text>;
    }

 

    return (
        <View style={styles.header}>
            {/* Menu Icon */}
         

            {/* Welcome Text with Profile Picture */}
            <View style={styles.rowContainer}>
                <View>
                    <Image 
                        source={dpUrl ? { uri: dpUrl } : require('../assets/Avatar/Cat.png')} 
                        style={styles.icon} 
                    />
                </View>
                <View style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                <Text style={styles.welcomeText}>
                   {userName ? ` ${userName} Kumar Srivastava`: '!'}
                </Text>
                <Text style={styles.welcomeText2}>
                  9289881135
                </Text>
                </View>
            </View>

           
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
 
        padding:5,
      
    },
    menuButton: {
        padding: 5,
    },
    menuIcon: {
        width: 24,
        height: 24,
    },
    rowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        width: 50,
        height: 50,
        marginRight: 3,
        borderWidth: 0.8,
        borderColor: '#C9C9C9',
        borderRadius: 35, // Make the image circular
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    coinContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#C9C9C9',
        borderRadius: 15,
    },
    coinIcon: {
        width: 20,
        height: 20,
        marginRight: 5,
    },
    coinText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FF6600',
    },
    welcomeText2: {
        fontSize: 10,
       marginTop: 2,
       marginLeft: 5,
        color: '#333',
    },
});

export default Header2;
