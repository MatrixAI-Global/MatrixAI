import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

export const useAuth = () => {
    const [uid, setUid] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeUser = async () => {
            try {
                let userId = null;
                
                // First try to get current user from Supabase
                const { data: { user }, error } = await supabase.auth.getUser();
                
                if (user?.id) {
                    console.log("Found authenticated user from Supabase:", user.id);
                    userId = user.id;
                    await AsyncStorage.setItem('uid', user.id);
                } else {
                    // Log if Supabase doesn't have a user
                    console.log("No user found in Supabase session", error?.message || "");
                    
                    // Fallback to AsyncStorage
                    const storedUid = await AsyncStorage.getItem('uid');
                    if (storedUid) {
                        console.log("Found stored UID in AsyncStorage:", storedUid);
                        userId = storedUid;
                        
                        // Verify if this stored UID is still valid with Supabase
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session?.user?.id && session.user.id !== storedUid) {
                            console.log("Session UID differs from stored UID, updating to:", session.user.id);
                            userId = session.user.id;
                            await AsyncStorage.setItem('uid', session.user.id);
                        }
                    } else {
                        console.log("No UID found in AsyncStorage");
                    }
                }
                
                // Set the UID in state if we found one
                if (userId) {
                    setUid(userId);
                }
            } catch (error) {
                console.error("Error initializing user:", error);
            } finally {
                setLoading(false);
            }
        };

        initializeUser();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log("Auth state changed:", event, session?.user?.id);
                if (session?.user) {
                    setUid(session.user.id);
                    await AsyncStorage.setItem('uid', session.user.id);
                } else {
                    setUid(null);
                    await AsyncStorage.removeItem('uid');
                }
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    return { uid, loading };
}; 